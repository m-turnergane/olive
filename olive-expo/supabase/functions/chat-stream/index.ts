// supabase/functions/chat-stream/index.ts
// Streams OpenAI chat completions, persists messages, triggers summary generation

// @ts-ignore - Supabase client from ESM
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// @ts-ignore - Deno is available in Supabase Edge Runtime
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

    const { conversation_id, user_text } = await req.json();

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

    // 5) Stream from OpenAI
    const openaiReq = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          stream: true,
          messages: openaiMessages,
        }),
      }
    );

    if (!openaiReq.ok) {
      const errorText = await openaiReq.text();
      console.error("OpenAI API error:", errorText);
      return new Response(JSON.stringify({ error: "OpenAI API error" }), {
        status: openaiReq.status,
        headers: corsHeaders,
      });
    }

    // 6) Stream to client AND capture full text for storage
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = openaiReq.body!.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward chunk to client
            controller.enqueue(value);

            // Parse chunk to accumulate response
            const text = decoder.decode(value);
            for (const line of text.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.replace(/^data:\s*/, "").trim();
              if (data === "[DONE]") continue;
              if (data === "") continue;

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content ?? "";
                fullResponse += token;
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

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
      },
    });
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
