// supabase/functions/chat-stream/index.ts
// Streams OpenAI chat completions, persists messages, triggers summary generation

// declare minimal Deno global for TypeScript (Supabase Edge provides Deno at runtime)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore - Supabase client from ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5-nano";
const OPENAI_API_MODE = (
  Deno.env.get("OPENAI_API_MODE") ?? "chat"
).toLowerCase(); // 'chat' | 'responses'
const CHAT_STREAM = (Deno.env.get("CHAT_STREAM") ?? "true") === "true";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// OpenAI API Helpers - Robust multi-mode support
// ============================================================================

function buildOpenAIRequest(
  messages: Array<{ role: string; content: string }>
) {
  if (OPENAI_API_MODE === "responses") {
    // Responses API (unified). Streaming is enabled via stream:true
    return {
      url: "https://api.openai.com/v1/responses",
      body: {
        model: OPENAI_CHAT_MODEL,
        // Map chat-style messages to a simple prompt for MVP
        input:
          messages
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join("\n") + "\nASSISTANT:",
        stream: CHAT_STREAM,
      },
    };
  }
  // Chat Completions API (classic chat)
  return {
    url: "https://api.openai.com/v1/chat/completions",
    body: {
      model: OPENAI_CHAT_MODEL,
      messages,
      stream: CHAT_STREAM,
    },
  };
}

async function callOpenAI(messages: Array<{ role: string; content: string }>) {
  const { url, body } = buildOpenAIRequest(messages);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // If OpenAI returned an error (like "model not found"), read & bubble up
  if (!res.ok) {
    let errJSON: any = {};
    try {
      errJSON = await res.json();
    } catch {
      errJSON = { error: await res.text() };
    }
    // return a JSON response (client must handle this as non-streaming)
    return { kind: "error", status: res.status, error: errJSON } as const;
  }

  // Non-streaming path (debug or MODE that doesn't support stream)
  if (!CHAT_STREAM) {
    const data = await res.json();
    console.log(
      "🔍 Raw OpenAI response:",
      JSON.stringify(data).substring(0, 500)
    );

    if (OPENAI_API_MODE === "responses") {
      // Responses API: text lives under top-level output (varies by response type)
      const text =
        data.output_text ??
        data.output?.[0]?.content?.[0]?.text?.value ??
        data.content
          ?.map((c: any) => c.text?.value)
          .filter(Boolean)
          .join("") ??
        "";
      console.log("🔍 Extracted from Responses API - length:", text.length);
      return { kind: "text", text } as const;
    } else {
      const text = data.choices?.[0]?.message?.content ?? "";
      console.log("🔍 Extracted from Chat Completions - length:", text.length);
      return { kind: "text", text } as const;
    }
  }

  // Streaming path
  return { kind: "stream", stream: res.body! } as const;
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
    console.log("🔍 chat-stream handler started");

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

    const { conversation_id, user_text } = await req.json();
    console.log(
      "🔍 Received request - conversation_id:",
      conversation_id,
      "user_text:",
      user_text
    );

    // 1) Authenticate user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 2) Persist user message
    const { data: userMsg, error: msgErr } = await supabase
      .rpc("add_message", {
        p_conversation_id: conversation_id,
        p_role: "user",
        p_content: user_text,
      })
      .select()
      .single();

    if (msgErr) {
      console.error("Error persisting user message:", msgErr);
      return new Response(JSON.stringify({ error: "Failed to save message" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 3) Gather context: last N turns + summary + preferences + memories
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: summaryRow } = await supabase
      .from("conversation_summaries")
      .select("summary")
      .eq("conversation_id", conversation_id)
      .maybeSingle();

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: memories } = await supabase
      .from("user_memories")
      .select("fact, confidence")
      .eq("user_id", user.id)
      .order("last_refreshed_at", { ascending: false })
      .limit(5);

    // 4) Construct messages with prompts + context
    const systemPrompt = SYSTEM_PROMPT;
    const devPrompt = DEVELOPER_PROMPT;
    const runtimeFacts = buildRuntimeFacts(prefs?.data, memories ?? []);

    const history = (lastMsgs ?? []).reverse(); // chronological order

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: devPrompt },
      ...(summaryRow?.summary
        ? [
            {
              role: "system",
              content: `Conversation summary so far:\n${summaryRow.summary}`,
            },
          ]
        : []),
      ...(runtimeFacts ? [{ role: "system", content: runtimeFacts }] : []),
      ...history.map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : m.role,
        content: m.content,
      })),
      { role: "user", content: user_text },
    ];

    // 5) Call OpenAI with robust error handling
    console.log(
      "🔍 About to call OpenAI - MODE:",
      OPENAI_API_MODE,
      "STREAM:",
      CHAT_STREAM,
      "MODEL:",
      OPENAI_CHAT_MODEL
    );
    const result = await callOpenAI(openaiMessages);

    // 🔍 DEBUG: Log the result type and payload
    console.log("🔍 OpenAI result kind:", result.kind);
    if (result.kind === "error") {
      console.error(
        "OpenAI error payload:",
        JSON.stringify(result.error, null, 2)
      );
    }
    if (result.kind === "text") {
      console.log("OpenAI text response (length):", result.text?.length || 0);
      console.log(
        "OpenAI text response (preview):",
        result.text?.substring(0, 100)
      );
    }

    // If it's a JSON error from OpenAI, surface it to the client clearly
    if (result.kind === "error") {
      console.error("OpenAI API error:", result.error);
      console.log("🔍 Returning 502 error response");
      return new Response(JSON.stringify(result), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If it's non-streaming text (debug mode), store + return JSON
    if (result.kind === "text") {
      const full = result.text ?? "";
      console.log("🔍 Non-streaming path - text length:", full.length);
      await supabase.rpc("add_message", {
        p_conversation_id: conversation_id,
        p_role: "assistant",
        p_content: full,
      });
      console.log("🔍 Message stored, kicking summarizer");
      // Kick summarizer (best-effort)
      try {
        await fetch(new URL(req.url).origin + "/functions/v1/summarize", {
          method: "POST",
          headers: {
            ...corsHeaders,
            Authorization: req.headers.get("Authorization")!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ conversation_id }),
        });
      } catch (e) {
        console.error("Summarizer failed:", e);
      }
      console.log("🔍 Returning JSON response with text");
      return new Response(JSON.stringify({ text: full }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Return OpenAI stream directly to client
    // Note: Transfer-Encoding is automatically handled by the runtime/proxy
    console.log("🔍 Entering streaming path (result.kind === 'stream')");
    console.log("🔍 Returning OpenAI stream directly to client");

    return new Response(result.stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        // DO NOT set Transfer-Encoding - let the proxy handle it
      },
    });

    // TODO: Re-implement persistence with proper stream handling
    // For now, messages in streaming mode won't be persisted server-side

    /* DISABLED WRAPPER - causing "No response body" error
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = result.stream.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward chunk to client
            controller.enqueue(value);

            // Parse chunk to accumulate response
            const chunk = decoder.decode(value);
            // Support both SSE formats: Chat Completions and Responses API
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              if (data === "") continue;

              try {
                const j = JSON.parse(data);
                // Chat Completions delta
                const t = j.choices?.[0]?.delta?.content;
                if (t) fullResponse += t;
                // Responses API: try common text delta locations
                const t2 =
                  j.output_text_delta ??
                  j.delta ??
                  j.content?.[0]?.delta?.text?.value ??
                  "";
                if (t2) fullResponse += t2;
              } catch (e) {
                // Ignore parse errors for malformed chunks
              }
            }
          }

          controller.close();

          // 7) Persist assistant message
          if (fullResponse.trim()) {
            await supabase.rpc("add_message", {
              p_conversation_id: conversation_id,
              p_role: "assistant",
              p_content: fullResponse.trim(),
            });

            // 8) Trigger rolling summary update (fire and forget)
            fetch(new URL(req.url).origin + "/functions/v1/summarize", {
              method: "POST",
              headers: {
                ...corsHeaders,
                Authorization: req.headers.get("Authorization")!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ conversation_id }),
            }).catch((e) => console.error("Failed to trigger summarize:", e));
          }
        } catch (e) {
          console.error("Stream error:", e);
          controller.error(e);
        }
      },
    });
    
    // END DISABLED WRAPPER */
  } catch (e) {
    console.error("Chat stream error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

// ============================================================================
// SYSTEM PROMPT - Core identity and safety guardrails
// ============================================================================

const SYSTEM_PROMPT = `You are Olive, a warm, empathetic AI companion focused on emotional support and mental wellbeing.

Core Principles:
- Lead with empathy, validation, and active listening
- Encourage healthy coping strategies and self-care
- Provide a safe, non-judgmental space for users to express themselves
- Help users process emotions and develop emotional awareness

Your Strengths:
- Emotional support and validation
- Stress management techniques
- Mindfulness and grounding exercises
- Journaling prompts and reflection
- General wellbeing conversations
- Encouragement and motivation

Important Boundaries:
- You are NOT a therapist, doctor, lawyer, or financial advisor
- You do NOT diagnose mental health conditions
- You do NOT prescribe medications or treatments
- You do NOT provide medical, legal, or financial advice
- You do NOT replace professional care when it's needed

Crisis Protocol:
If a user expresses suicidal thoughts, self-harm, or crisis-level distress:
1. Express genuine concern and care
2. Encourage them to reach crisis resources immediately:
   - National Suicide Prevention Lifeline: 988 (US)
   - Crisis Text Line: Text HOME to 741741
   - International: findahelpline.com
3. Remind them that professionals are available 24/7
4. Stay supportive but reinforce the importance of professional help

Tone:
- Warm, friendly, and authentic
- Conversational but professional
- Adapt to user's emotional state
- Use "I" statements to show empathy ("I hear that you're feeling...")
- Avoid clinical or overly formal language`;

// ============================================================================
// DEVELOPER PROMPT - Technical constraints and conversation style
// ============================================================================

const DEVELOPER_PROMPT = `Technical Guidelines:

Response Style:
- Keep responses concise (2-4 short paragraphs unless user needs more)
- Ask open-ended questions to encourage reflection
- Offer specific, actionable suggestions when appropriate
- Mirror the user's communication style (formal vs casual)

When Users Ask for Out-of-Scope Topics:
- Politely acknowledge the question
- Explain what you CAN help with
- Redirect toward emotional/wellbeing aspects if relevant
- Suggest they consult appropriate professionals

Example Redirects:
- Medical: "I'm not qualified to give medical advice, but I can help you think through how this is affecting you emotionally. Would that be helpful?"
- Legal: "For legal matters, you'll want to consult with a lawyer. I'm here if you want to talk about the stress or anxiety this situation is causing."
- Financial: "I can't give financial advice, but I can help you work through the stress around money concerns if that would be useful."

Memory & Context:
- Reference past conversations when relevant (memories will be provided in context)
- Use user's preferred name/pronouns if specified
- Build continuity across sessions
- Remember coping strategies that worked for the user

Safety:
- Always prioritize user safety
- Escalate to crisis resources when appropriate
- Never minimize serious concerns
- Maintain professional boundaries while being warm`;

// ============================================================================
// RUNTIME CONTEXT BUILDER
// ============================================================================

function buildRuntimeFacts(
  prefs?: any,
  memories?: { fact: string; confidence: number }[]
): string {
  const facts: string[] = [];

  if (prefs?.nickname) {
    facts.push(`User prefers to be called "${prefs.nickname}".`);
  }

  if (prefs?.pronouns) {
    facts.push(`User's pronouns: ${prefs.pronouns}.`);
  }

  if (prefs?.tone) {
    facts.push(`User prefers a ${prefs.tone} conversational tone.`);
  }

  if (Array.isArray(memories) && memories.length > 0) {
    facts.push("Important context from past conversations:");
    for (const m of memories as Array<{ fact: string; confidence: number }>) {
      facts.push(`  - ${m.fact} (confidence: ${m.confidence.toFixed(2)})`);
    }
  }

  return facts.length ? `Context facts:\n${facts.join("\n")}` : "";
}
