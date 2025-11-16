// supabase/functions/generate-title/index.ts
// Generates a concise, descriptive title for a conversation based on its messages
// Supports both OpenAI Chat Completions and Responses APIs

// @ts-ignore - Supabase client from ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// @ts-ignore
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// @ts-ignore
const OPENAI_CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5-nano";

// @ts-ignore
const OPENAI_TITLE_MODEL = Deno.env.get("OPENAI_TITLE_MODEL") ?? OPENAI_CHAT_MODEL;

// @ts-ignore - Auto-detect API mode based on model name
const OPENAI_TITLE_API_MODE = Deno.env.get("OPENAI_TITLE_API_MODE") ?? 
  (OPENAI_TITLE_MODEL.includes("gpt-5") ? "responses" : "chat");

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Normalize title text:
 * - Strip quotes, backticks, and extra punctuation
 * - Sentence case (capitalize first letter only)
 * - Trim to max 60 characters
 */
function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  
  // Strip quotes and backticks
  let title = rawTitle.replace(/^["'`]+|["'`]+$/g, "").trim();
  
  // Remove trailing punctuation except question marks
  title = title.replace(/[.,;:!]+$/, "");
  
  // Sentence case: lowercase everything, then capitalize first letter
  title = title.toLowerCase();
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  // Trim to max length
  if (title.length > 60) {
    title = title.substring(0, 57) + "...";
  }
  
  return title;
}

/**
 * Call OpenAI Chat Completions API
 */
async function generateTitleWithChat(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ title: string; usage?: any }> {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 20,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Chat API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const title = data.choices?.[0]?.message?.content?.trim() ?? "";
  const usage = data.usage;

  return { title, usage };
}

/**
 * Call OpenAI Responses API
 */
async function generateTitleWithResponses(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ title: string; usage?: any }> {
  const input = [
    {
      role: "system",
      content: [{ type: "text", text: systemPrompt }],
    },
    {
      role: "user",
      content: [{ type: "text", text: userPrompt }],
    },
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      input,
      max_output_tokens: 20,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Responses API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  
  // Extract text from output_text array
  const outputText = data.output_text || [];
  const title = outputText.map((item: any) => item.text || "").join("").trim();
  const usage = data.usage;

  return { title, usage };
}

// @ts-ignore
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { conversation_id } = await req.json();

    // Authenticate user
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

    // Fetch first few messages from conversation
    const { data: messages, error: messagesErr } = await supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(5);

    if (messagesErr) {
      console.error("Error fetching messages:", messagesErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to fetch messages",
          details: messagesErr.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Defensive: require at least 2 messages (1 user + 1 assistant)
    if (!messages || messages.length < 2) {
      console.log(`Not enough messages (${messages?.length ?? 0}) for title generation`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Not enough messages",
          details: "Title generation requires at least 1 user and 1 assistant message",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompts
    const systemPrompt = `You are a title generator for conversation threads.

Your task: Create a short, descriptive title (3-6 words max) that captures the main topic of the conversation.

Guidelines:
- Maximum 6 words
- Capitalize first word only (sentence case)
- Be specific and descriptive
- Focus on the main topic or concern
- No quotes, punctuation, or special formatting
- Examples: "Anxiety about job interview", "Coping with loss", "Sleep and stress management"

Return ONLY the title, nothing else.`;

    const userPrompt = `Generate a title for this conversation:\n\n${JSON.stringify(messages, null, 2)}`;

    console.log(`[generate-title] Model: ${OPENAI_TITLE_MODEL}, Mode: ${OPENAI_TITLE_API_MODE}`);

    // Call OpenAI based on mode
    let rawTitle = "";
    let usage = null;

    try {
      if (OPENAI_TITLE_API_MODE === "responses") {
        const result = await generateTitleWithResponses(OPENAI_TITLE_MODEL, systemPrompt, userPrompt);
        rawTitle = result.title;
        usage = result.usage;
      } else {
        const result = await generateTitleWithChat(OPENAI_TITLE_MODEL, systemPrompt, userPrompt);
        rawTitle = result.title;
        usage = result.usage;
      }
    } catch (openaiError: any) {
      console.error("OpenAI API error:", openaiError.message);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "OpenAI API error",
          details: openaiError.message,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize title
    let title = normalizeTitle(rawTitle);

    // Fallback if empty
    if (!title) {
      title = "New conversation";
    }

    console.log(`[generate-title] Raw: "${rawTitle}" → Normalized: "${title}"`);
    if (usage) {
      console.log(`[generate-title] Usage:`, JSON.stringify(usage));
    }

    // Update conversation title (RLS-safe: user must own the conversation)
    const { error: updateErr } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversation_id)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("Error updating conversation title:", updateErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to update title",
          details: updateErr.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-title] ✅ Title set for conversation ${conversation_id}: "${title}"`);

    return new Response(
      JSON.stringify({
        ok: true,
        title,
        conversation_id,
        usage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("Generate title error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Internal server error",
        details: String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
