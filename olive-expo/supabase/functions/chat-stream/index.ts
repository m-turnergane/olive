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
const MCP_FIND_CARE_URL =
  Deno.env.get("MCP_FIND_CARE_URL") ?? "http://localhost:3001";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Tool Definitions
// ============================================================================

const FIND_CARE_TOOL = {
  type: "function",
  function: {
    name: "find_care",
    description:
      "Find mental health care providers (therapists, psychiatrists, counselors) near the user's location, ranked by Google reviews. Use this when user asks for help finding professional care, mentions needing a therapist, or expresses interest in local mental health resources.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Search query or concern type (e.g., "anxiety", "teen therapy", "grief counseling", "psychiatrist")',
        },
        radius_km: {
          type: "number",
          description:
            "Search radius in kilometers (will use user preference if not specified)",
        },
        top_k: {
          type: "number",
          description: "Number of results to return (default: 5)",
          default: 5,
        },
        open_now: {
          type: "boolean",
          description: "Filter for currently open providers (default: false)",
          default: false,
        },
        min_rating: {
          type: "number",
          description: "Minimum Google rating (default: 4.3)",
          default: 4.3,
        },
      },
      required: [],
    },
  },
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
      tools: [FIND_CARE_TOOL], // Enable find_care tool
      tool_choice: "auto", // Let model decide when to use tools
    },
  };
}

async function callOpenAI(
  messages: Array<any>,
  streamMode: boolean = CHAT_STREAM
) {
  const { url, body } = buildOpenAIRequest(messages);
  body.stream = streamMode; // Override stream based on parameter

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

  // Non-streaming path (debug or MODE that doesn't support stream, or tool call handling)
  if (!streamMode) {
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
      return { kind: "json", data, text } as const;
    } else {
      const text = data.choices?.[0]?.message?.content ?? "";
      const toolCalls = data.choices?.[0]?.message?.tool_calls;
      console.log("🔍 Extracted from Chat Completions - length:", text.length);
      console.log("🔍 Tool calls detected:", toolCalls?.length || 0);
      return { kind: "json", data, text, toolCalls } as const;
    }
  }

  // Streaming path
  return { kind: "stream", stream: res.body! } as const;
}

// ============================================================================
// MCP Tool Handlers
// ============================================================================

/**
 * Call MCP find_care server
 */
async function invokeFindCare(
  args: any,
  userLocation?: { city?: string; lat?: number; lng?: number },
  searchRadius?: number,
  userId?: string
): Promise<any> {
  try {
    // Check if MCP_FIND_CARE_URL is configured
    if (!MCP_FIND_CARE_URL) {
      console.error("❌ MCP_FIND_CARE_URL not configured");
      return {
        error: "Care provider search is not configured. Please contact support.",
        providers: [],
      };
    }

    // Merge user preferences with tool arguments
    const mcpArgs = {
      query: args.query || "therapist mental health",
      location: userLocation
        ? userLocation.lat && userLocation.lng
          ? { lat: userLocation.lat, lng: userLocation.lng }
          : { city: userLocation.city || "Mississauga, ON" }
        : { city: "Mississauga, ON" },
      radius_km: args.radius_km || searchRadius || 35,
      top_k: args.top_k || 5,
      open_now: args.open_now || false,
      min_rating: args.min_rating || 4.3,
    };

    console.log("🔍 Calling MCP find_care:", JSON.stringify(mcpArgs));
    console.log("🔍 MCP URL:", MCP_FIND_CARE_URL);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`${MCP_FIND_CARE_URL}/invoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: "find_care",
          arguments: mcpArgs,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MCP server error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log(
        "✅ MCP find_care returned:",
        result.providers?.length || 0,
        "providers"
      );

      // Cache geocoded coordinates if we had a city and MCP geocoded it
      if (
        userId &&
        userLocation?.city &&
        !userLocation.lat &&
        result.geocoded_location
      ) {
        try {
          const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          await supabaseClient
            .from("user_preferences")
            .upsert({
              user_id: userId,
              data: {
                location: {
                  city: userLocation.city,
                  lat: result.geocoded_location.lat,
                  lng: result.geocoded_location.lng,
                },
              },
            })
            .eq("user_id", userId);

          console.log("✅ Cached geocoded location for user");
        } catch (cacheError) {
          console.error("⚠️ Failed to cache geocoded location:", cacheError);
          // Don't fail the whole request if caching fails
        }
      }

      return result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === "AbortError") {
        console.error("❌ MCP find_care timeout after 10s");
        return {
          error: "The care provider search is taking too long. Please try again in a moment.",
          providers: [],
        };
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error("❌ MCP find_care error:", error);
    
    // Return graceful error instead of throwing
    return {
      error: `Unable to search for care providers at this time: ${error.message || "Unknown error"}. The service may be temporarily unavailable.`,
      providers: [],
    };
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

    const { conversation_id, user_text, stream } = await req.json();
    console.log(
      "🔍 Received request - conversation_id:",
      conversation_id,
      "user_text:",
      user_text,
      "stream:",
      stream
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

    // 5) Call OpenAI with tool support - loop until no more tool calls
    console.log(
      "🔍 About to call OpenAI - MODE:",
      OPENAI_API_MODE,
      "STREAM:",
      CHAT_STREAM,
      "MODEL:",
      OPENAI_CHAT_MODEL
    );

    let conversationMessages = [...openaiMessages];
    let toolCallLoop = 0;
    const MAX_TOOL_LOOPS = 3;
    let finalResult: any = null;
    let toolResults: any[] = [];
    const shouldStream =
      typeof stream === "boolean" ? stream : CHAT_STREAM;

    while (toolCallLoop < MAX_TOOL_LOOPS) {
      // First call: try streaming. Subsequent calls: non-streaming for tool handling
      const useStreaming = toolCallLoop === 0 && shouldStream;
      const result = await callOpenAI(conversationMessages, useStreaming);

      console.log("🔍 OpenAI result kind:", result.kind, "loop:", toolCallLoop);

      if (result.kind === "error") {
        console.error("OpenAI error:", JSON.stringify(result.error, null, 2));
        finalResult = result;
        break;
      }

      if (result.kind === "stream") {
        // Streaming response - no tool calls expected in first streaming response
        // (We'd need to parse stream for tool calls, which is complex)
        // For MVP, return stream directly
        console.log(
          "🔍 Returning streaming response (no tool handling in stream mode)"
        );
        finalResult = result;
        break;
      }

      if (result.kind === "json") {
        const { data, text, toolCalls } = result;

        // Check if model called any tools
        if (
          toolCalls &&
          toolCalls.length > 0 &&
          toolCallLoop < MAX_TOOL_LOOPS - 1
        ) {
          console.log("🔍 Processing", toolCalls.length, "tool call(s)");

          // Add assistant message with tool calls to conversation
          conversationMessages.push({
            role: "assistant",
            content: text || null,
            tool_calls: toolCalls,
          });

          // Execute each tool call
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

            console.log(`🔍 Executing tool: ${toolName}`, toolArgs);

            if (toolName === "find_care") {
              try {
                const toolResult = await invokeFindCare(
                  toolArgs,
                  prefs?.data?.location,
                  prefs?.data?.search_radius_km,
                  user.id
                );

                // Add tool result to conversation
                conversationMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(toolResult),
                });

                // Store for client
                toolResults.push({
                  tool: toolName,
                  result: toolResult,
                });

                console.log(`✅ Tool ${toolName} executed successfully`);
              } catch (error) {
                console.error(`❌ Tool ${toolName} error:`, error);
                conversationMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: String(error) }),
                });
              }
            }
          }

          // Loop to get model's response with tool results
          toolCallLoop++;
          continue;
        }

        // No tool calls - this is the final response
        console.log("🔍 No tool calls, final response");
        finalResult = { kind: "text", text, toolResults };
        break;
      }

      toolCallLoop++;
    }

    const result = finalResult;

    // If it's a JSON error from OpenAI, surface it to the client clearly
    if (result.kind === "error") {
      console.error("OpenAI API error:", result.error);
      console.log("🔍 Returning 502 error response");
      return new Response(JSON.stringify(result), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If it's non-streaming text (debug mode or after tool calls), store + return JSON
    if (result.kind === "text") {
      const full = result.text ?? "";
      const tools = result.toolResults || [];
      console.log("🔍 Non-streaming path - text length:", full.length);
      console.log("🔍 Tool results:", tools.length);

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

      // Auto-generate title after first full exchange (best-effort)
      try {
        const { data: conv } = await supabase
          .from("conversations")
          .select("title")
          .eq("id", conversation_id)
          .single();

        const { data: msgCount } = await supabase
          .from("messages")
          .select("id", { count: "exact" })
          .eq("conversation_id", conversation_id);

        const needsTitle =
          !conv?.title ||
          conv.title === "Untitled conversation" ||
          conv.title === "New chat";
        const hasFullExchange = msgCount && msgCount.length >= 2;

        if (needsTitle && hasFullExchange) {
          console.log(
            "🔍 Auto-generating title for conversation:",
            conversation_id
          );
          await fetch(
            new URL(req.url).origin + "/functions/v1/generate-title",
            {
              method: "POST",
              headers: {
                ...corsHeaders,
                Authorization: req.headers.get("Authorization")!,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ conversation_id }),
            }
          );
        }
      } catch (e) {
        console.error("Title generation failed:", e);
      }
      console.log("🔍 Returning JSON response with text");
      return new Response(JSON.stringify({ text: full, tools }), {
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

  // Location for find_care tool
  if (prefs?.location) {
    if (prefs.location.city) {
      facts.push(`User location: ${prefs.location.city}.`);
    } else if (prefs.location.lat && prefs.location.lng) {
      facts.push(
        `User location: (${prefs.location.lat.toFixed(
          4
        )}, ${prefs.location.lng.toFixed(4)}).`
      );
    }

    if (prefs.search_radius_km) {
      facts.push(`Preferred search radius: ${prefs.search_radius_km}km.`);
    }
  }

  if (Array.isArray(memories) && memories.length > 0) {
    facts.push("Important context from past conversations:");
    for (const m of memories as Array<{ fact: string; confidence: number }>) {
      facts.push(`  - ${m.fact} (confidence: ${m.confidence.toFixed(2)})`);
    }
  }

  return facts.length ? `Context facts:\n${facts.join("\n")}` : "";
}
