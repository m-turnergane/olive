// supabase/functions/generate-title/index.ts
// Generates a concise,  descriptive title for a conversation based on its messages

// @ts-ignore - Supabase client from ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// @ts-ignore
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
// @ts-ignore
const OPENAI_CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5-nano";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
      .limit(5); // First 5 messages usually enough

    if (messagesErr || !messages || messages.length === 0) {
      console.error("Error fetching messages or no messages:", messagesErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No messages to generate title from",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Build title generation prompt
    const prompt = [
      {
        role: "system",
        content: `You are a title generator for conversation threads.

Your task: Create a short, descriptive title (3-6 words max) that captures the main topic of the conversation.

Guidelines:
- Maximum 6 words
- Capitalize first word only (sentence case)
- Be specific and descriptive
- Focus on the main topic or concern
- No quotes, punctuation, or special formatting
- Examples: "Anxiety about job interview", "Coping with loss", "Sleep and stress management"

Return ONLY the title, nothing else.`,
      },
      {
        role: "user",
        content: `Generate a title for this conversation:\n\n${JSON.stringify(
          messages,
          null,
          2
        )}`,
      },
    ];

    // Call OpenAI for title
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          messages: prompt,
          temperature: 0.7, // Slightly creative for varied titles
          max_tokens: 20, // Short title
        }),
      }
    );

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ ok: false, error: "OpenAI API error" }),
        { status: openaiRes.status, headers: corsHeaders }
      );
    }

    const openaiData = await openaiRes.json();
    let title = openaiData.choices?.[0]?.message?.content?.trim() ?? "";

    // Clean up title (remove quotes, trim to max length)
    title = title.replace(/^["']|["']$/g, "").trim();
    if (title.length > 60) {
      title = title.substring(0, 57) + "...";
    }

    if (!title) {
      // Fallback title
      title = "New conversation";
    }

    // Update conversation title
    const { error: updateErr } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversation_id)
      .eq("user_id", user.id); // Ensure ownership

    if (updateErr) {
      console.error("Error updating conversation title:", updateErr);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to update title" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(
      `Title generated for conversation ${conversation_id}: "${title}"`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        title,
        conversation_id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("Generate title error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
