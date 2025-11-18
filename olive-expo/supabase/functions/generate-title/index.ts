// supabase/functions/generate-title/index.ts
// Generates a concise, descriptive title for a conversation based on its messages
// Supports both OpenAI Chat Completions and Responses APIs with anti-generic safeguards

// @ts-ignore - Supabase client from ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

declare const Deno: any;

// @ts-ignore
const OPENAI_API_KEY = (() => {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    console.error(
      "[generate-title] Missing OPENAI_API_KEY environment variable"
    );
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return key;
})();

// Model configuration with fallback support
const OPENAI_TITLE_MODEL = Deno.env.get("OPENAI_TITLE_MODEL") ?? "gpt-5-nano";

const OPENAI_TITLE_API_MODE =
  Deno.env.get("OPENAI_TITLE_API_MODE") ??
  (OPENAI_TITLE_MODEL.includes("gpt-5") ? "responses" : "chat");

const OPENAI_TITLE_FALLBACK_MODEL = Deno.env.get("OPENAI_TITLE_FALLBACK_MODEL"); // e.g., "gpt-4o-mini"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Clean and validate title:
 * - Strip quotes, backticks, and trailing punctuation
 * - Sentence case (capitalize first letter only)
 * - Reject generic/empty titles
 * - Trim to max 60 characters
 */
function cleanTitle(rawTitle: string): string {
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

  // Reject generic titles
  const genericTitles = [
    "new conversation",
    "new chat",
    "untitled conversation",
    "general",
    "random chat",
    "conversation",
    "chat",
  ];
  if (
    !title ||
    title.length < 3 ||
    genericTitles.includes(title.toLowerCase())
  ) {
    return "";
  }

  // Trim to max length
  if (title.length > 60) {
    title = title.substring(0, 57) + "...";
  }

  return title;
}

/**
 * Build a concise context snippet from messages
 * Prioritizes user messages and first assistant response
 */
function buildContextSnippet(
  messages: Array<{ role: string; content: string }>
): string {
  const userLines = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const assistantFirst =
    messages.find((m) => m.role === "assistant")?.content || "";

  const userContext = userLines.join("\n").slice(0, 800);
  const assistantContext = assistantFirst.slice(0, 300);

  return `${userContext}\n${assistantContext}`.trim();
}

/**
 * Call OpenAI Responses API (for GPT-5 models)
 */
async function generateTitleWithResponses(
  model: string,
  snippet: string,
  isRetry: boolean = false
): Promise<{ title: string; usage?: any }> {
  const systemPrompt = `You title conversations for a mental health companion.

Rules:
- 3–6 words, sentence case
- Be specific to the user's topic; NO generic titles
- No quotes or trailing punctuation
- Examples: "Coping with loss of pet", "Anxiety before job interview", "Sleep troubles and stress"`;

  const userPrompt = isRetry
    ? `Title this specific topic in 3–6 words (no generic titles like "New conversation").

Context:
${snippet}

Return ONLY the title.`
    : `Write a title for this conversation context:

${snippet}

Return ONLY the title, nothing else.`;

  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: systemPrompt }],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: userPrompt }],
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
      max_output_tokens: 32,
      reasoning: { effort: "minimal" },
      text: {
        verbosity: "low",
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[generate-title] Responses API error (${response.status}) raw response: ${errorBody}`
    );
    throw new Error(`Responses API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  // Extract text from output_text (convenience field in Responses API)
  const rawText = (data?.output_text ?? "").trim();
  const usage = data.usage;

  return { title: rawText, usage };
}

/**
 * Call OpenAI Chat Completions API (for GPT-4 and other models)
 */
async function generateTitleWithChat(
  model: string,
  snippet: string,
  isRetry: boolean = false
): Promise<{ title: string; usage?: any }> {
  const systemPrompt = `You title conversations for a mental health companion.

Rules:
- 3–6 words, sentence case
- Be specific to the user's topic; NO generic titles
- No quotes or trailing punctuation
- Examples: "Coping with loss of pet", "Anxiety before job interview", "Sleep troubles and stress"`;

  const userPrompt = isRetry
    ? `Title this specific topic in 3–6 words (no generic titles like "New conversation").

Context:
${snippet}

Return ONLY the title.`
    : `Write a title for this conversation context:

${snippet}

Return ONLY the title, nothing else.`;

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
      max_tokens: 32,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[generate-title] Chat API error (${response.status}) raw response: ${errorBody}`
    );
    throw new Error(`Chat API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const title = data.choices?.[0]?.message?.content?.trim() ?? "";
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

    // Fetch first 8 messages from conversation (more context for better titles)
    const { data: messages, error: messagesErr } = await supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(8);

    if (messagesErr) {
      console.error("Error fetching messages:", messagesErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to fetch messages",
          details: messagesErr.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Defensive: require at least 2 messages (1 user + 1 assistant)
    if (!messages || messages.length < 2) {
      console.log(
        `Not enough messages (${messages?.length ?? 0}) for title generation`
      );
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Not enough messages",
          details:
            "Title generation requires at least 1 user and 1 assistant message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build context snippet (prioritize user messages)
    const snippet = buildContextSnippet(messages);

    console.log(
      `[generate-title] Model: ${OPENAI_TITLE_MODEL}, Mode: ${OPENAI_TITLE_API_MODE}`
    );

    // First attempt: Call OpenAI based on mode
    let rawTitle = "";
    let usage = null;

    try {
      if (OPENAI_TITLE_API_MODE === "responses") {
        const result = await generateTitleWithResponses(
          OPENAI_TITLE_MODEL,
          snippet,
          false
        );
        rawTitle = result.title;
        usage = result.usage;
      } else {
        const result = await generateTitleWithChat(
          OPENAI_TITLE_MODEL,
          snippet,
          false
        );
        rawTitle = result.title;
        usage = result.usage;
      }
    } catch (openaiError: any) {
      console.error("OpenAI API error (first attempt):", openaiError.message);
      // Don't return error yet - try fallback if available
    }

    // Clean and validate title
    let title = cleanTitle(rawTitle);

    // Retry logic: If title is empty/generic, try again with stronger prompt
    if (!title) {
      console.log(
        "[generate-title] First attempt yielded generic/empty title, retrying with stronger prompt..."
      );

      try {
        if (OPENAI_TITLE_API_MODE === "responses") {
          const result = await generateTitleWithResponses(
            OPENAI_TITLE_MODEL,
            snippet,
            true
          );
          rawTitle = result.title;
          usage = result.usage;
        } else {
          const result = await generateTitleWithChat(
            OPENAI_TITLE_MODEL,
            snippet,
            true
          );
          rawTitle = result.title;
          usage = result.usage;
        }

        title = cleanTitle(rawTitle);
      } catch (retryError: any) {
        console.error("OpenAI API error (retry):", retryError.message);
      }
    }

    // Fallback model: If still no title and fallback model is configured
    if (!title && OPENAI_TITLE_FALLBACK_MODEL) {
      console.log(
        `[generate-title] Falling back to ${OPENAI_TITLE_FALLBACK_MODEL}...`
      );

      try {
        // Fallback always uses Chat Completions (more reliable for GPT-4 models)
        const result = await generateTitleWithChat(
          OPENAI_TITLE_FALLBACK_MODEL,
          snippet,
          true
        );
        rawTitle = result.title;
        usage = result.usage;
        title = cleanTitle(rawTitle);
      } catch (fallbackError: any) {
        console.error("OpenAI API error (fallback):", fallbackError.message);
      }
    }

    // Final fallback: Use generic title if all attempts failed
    if (!title) {
      title = "New chat";
      console.warn(
        "[generate-title] All attempts failed, using generic fallback"
      );
    }

    console.log(`[generate-title] Raw: "${rawTitle}" → Cleaned: "${title}"`);
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[generate-title] ✅ Title set for conversation ${conversation_id}: "${title}"`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        title,
        conversation_id,
        usage,
        model: OPENAI_TITLE_MODEL,
        mode: OPENAI_TITLE_API_MODE,
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
