// supabase/functions/realtime-ephemeral/index.ts
// Mints ephemeral tokens for OpenAI Realtime API (WebRTC voice sessions)
// Never exposes the main API key to the client

// @ts-ignore - Supabase client from ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ============================================================================
// Environment Configuration
// ============================================================================

// @ts-ignore
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
// @ts-ignore
const REALTIME_ENABLE = Deno.env.get("REALTIME_ENABLE") ?? "true";
// @ts-ignore
const REALTIME_SERVER = Deno.env.get("REALTIME_SERVER") ?? "openai";
// @ts-ignore
const REALTIME_MODEL =
  Deno.env.get("REALTIME_MODEL") ?? "gpt-4o-mini-realtime-preview-2024-12-17";
// @ts-ignore
const REALTIME_VOICE_DEFAULT = Deno.env.get("REALTIME_VOICE_DEFAULT") ?? "shimmer";
// @ts-ignore
const REALTIME_VOICE_FEMALE = Deno.env.get("REALTIME_VOICE_FEMALE") ?? "shimmer";
// @ts-ignore
const REALTIME_VOICE_MALE = Deno.env.get("REALTIME_VOICE_MALE") ?? "alloy";
// @ts-ignore
const REALTIME_TURN_DETECTION =
  Deno.env.get("REALTIME_TURN_DETECTION") ?? "server_vad";
// @ts-ignore
const AZURE_OPENAI_ENDPOINT = Deno.env.get("AZURE_OPENAI_ENDPOINT");
// @ts-ignore
const AZURE_OPENAI_API_VERSION =
  Deno.env.get("AZURE_OPENAI_API_VERSION") ?? "2025-04-01-preview";
// @ts-ignore
const LOG_LEVEL = Deno.env.get("LOG_LEVEL") ?? "info";

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Thera System Prompt (Voice-optimized)
// ============================================================================

const THERA_SYSTEM_PROMPT = `You are "Olive", an AI mental health companion. You are empathetic, confidential, culturally sensitive, and supportive. You are **not** a licensed clinician.

Core style: warm, validating, collaborative; brief, natural spoken language; avoid jargon. Offer evidence-based micro-skills (CBT reframing, grounding, paced breathing, behavioral activation, self-compassion) as suggestions, not commands.

Safety: If user mentions self-harm, harm to others, or acute crisis, respond with care; encourage immediate support and offer crisis/resource options.

Boundaries: Avoid medical, legal, or financial directives; redirect gently.

Adaptation: Mirror the user's tone and reading level; respect cultural/identity cues.

Keep answers concise in voice (1–3 sentences per turn unless user invites more).`;

// ============================================================================
// Logging Utility
// ============================================================================

function log(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: any
) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[LOG_LEVEL as keyof typeof levels] ?? 1;
  const messageLevel = levels[level];

  if (messageLevel >= currentLevel) {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`);
  }
}

// ============================================================================
// Main Handler
// ============================================================================

// @ts-ignore
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Fail closed if realtime is disabled
    if (REALTIME_ENABLE === "false") {
      log("warn", "Realtime voice is disabled via REALTIME_ENABLE");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Voice features are currently disabled",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fail closed if no API key
    if (!OPENAI_API_KEY) {
      log("error", "OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with user's JWT
    // @ts-ignore
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get("SUPABASE_URL")!,
      // @ts-ignore
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      log("warn", "Unauthorized request");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    log("info", `Minting ephemeral token for user ${user.id}`);
    log("debug", `Using model: ${REALTIME_MODEL}, server: ${REALTIME_SERVER}`);

    // Fetch user preferences to determine voice selection
    const { data: prefsData } = await supabase
      .from("user_preferences")
      .select("data")
      .eq("user_id", user.id)
      .single();

    const userPrefs = prefsData?.data || {};
    const voiceGender = userPrefs.voice_gender ?? "female"; // default female
    const selectedVoice =
      voiceGender === "male" ? REALTIME_VOICE_MALE : REALTIME_VOICE_FEMALE;

    log(
      "debug",
      `User voice preference: ${voiceGender}, selected voice: ${selectedVoice}`
    );

    // Construct session request body
    const sessionRequest = {
      model: REALTIME_MODEL,
      voice: selectedVoice,
      modalities: ["audio", "text"],
      instructions: THERA_SYSTEM_PROMPT.substring(0, 16000), // Trim to ~16k tokens
      turn_detection: {
        type: REALTIME_TURN_DETECTION,
        threshold: 0.5,
        silence_duration_ms: 900,
      },
    };

    // Determine sessions endpoint based on server type
    let sessionsUrl: string;
    let authHeader: string;

    if (REALTIME_SERVER === "azure") {
      if (!AZURE_OPENAI_ENDPOINT) {
        log(
          "error",
          "AZURE_OPENAI_ENDPOINT required when REALTIME_SERVER=azure"
        );
        return new Response(
          JSON.stringify({ ok: false, error: "Azure configuration missing" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Azure Realtime sessions URL
      // Format: https://{endpoint}/openai/realtime/sessions?api-version={version}
      sessionsUrl = `${AZURE_OPENAI_ENDPOINT}/openai/realtime/sessions?api-version=${AZURE_OPENAI_API_VERSION}`;
      authHeader = `Bearer ${OPENAI_API_KEY}`;
    } else {
      // OpenAI standard sessions endpoint
      sessionsUrl = "https://api.openai.com/v1/realtime/sessions";
      authHeader = `Bearer ${OPENAI_API_KEY}`;
    }

    log("debug", `Calling sessions endpoint: ${sessionsUrl}`);

    // Call OpenAI/Azure sessions API
    const openaiRes = await fetch(sessionsUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionRequest),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      log("error", `Sessions API error (${openaiRes.status})`, {
        error: errorText,
      });

      // Parse error for better debugging
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorText;
      } catch {
        // errorText is not JSON, use as-is
      }

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to create Realtime session",
          message: errorDetails,
          status: openaiRes.status,
          details: errorText,
        }),
        {
          status: openaiRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sessionData = await openaiRes.json();
    log("info", `Ephemeral token minted for user ${user.id}`);

    // Extract ephemeral token (client_secret.value) and session info
    const ephemeralToken = sessionData.client_secret?.value;

    if (!ephemeralToken) {
      log("error", "No ephemeral token in sessions response", { sessionData });
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid sessions response" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return token + session metadata to client
    return new Response(
      JSON.stringify({
        ok: true,
        token: ephemeralToken,
        session_id: sessionData.id,
        model: sessionData.model,
        voice: sessionData.voice,
        expires_at: sessionData.expires_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    log("error", "Ephemeral token minting error", { error: String(e) });
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
