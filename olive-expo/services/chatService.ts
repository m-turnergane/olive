// olive-expo/services/chatService.ts
// Client service for chat persistence + streaming + scope gating

import { fetch as expoFetch } from "expo/fetch";
import { supabase } from "./supabaseService";
import { parseSSEChunk } from "../utils/sse";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

// ============================================================================
// Helper Functions
// ============================================================================

async function safeReadJSON(res: Response) {
  try {
    return await res.json();
  } catch {
    return { raw: await res.text() };
  }
}

// ============================================================================
// Types
// ============================================================================

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

export interface ScopeCheckResult {
  scope: "in" | "out";
  message?: string;
}

export class ChatServiceError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = "ChatServiceError";
  }
}

/**
 * Create an AbortController with timeout
 * @param timeoutMs Timeout in milliseconds (default: 60000 = 1 minute)
 * @returns AbortController that will abort after timeout
 */
export function createTimeoutController(timeoutMs = 60000): AbortController {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Store timeout ID for cleanup
  (controller as any)._timeoutId = timeout;

  return controller;
}

/**
 * Clean up a timeout controller
 * @param controller AbortController to clean up
 */
export function cleanupController(controller: AbortController): void {
  const timeoutId = (controller as any)._timeoutId;
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Conversation Management
// ============================================================================

/**
 * Create a new conversation
 * @param title Optional title for the conversation
 * @returns The created conversation object
 */
export async function createConversation(
  title?: string
): Promise<Conversation> {
  try {
    const { data, error } = await supabase
      .rpc("create_conversation", {
        p_title: title ?? null,
        p_model: "gpt-5-nano",
      })
      .select()
      .single();

    if (error) {
      throw new ChatServiceError(
        `Failed to create conversation: ${error.message}`,
        error.code
      );
    }

    if (!data) {
      throw new ChatServiceError("No data returned from create_conversation");
    }

    return data as Conversation;
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }
    throw new ChatServiceError(
      `Unexpected error creating conversation: ${error}`
    );
  }
}

/**
 * Fetch conversation history (messages)
 * @param conversationId UUID of the conversation
 * @param limit Maximum number of messages to fetch (default: 50)
 * @returns Array of messages in chronological order
 */
export async function getConversationMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new ChatServiceError(
        `Failed to fetch messages: ${error.message}`,
        error.code
      );
    }

    return (data || []) as Message[];
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }
    throw new ChatServiceError(`Unexpected error fetching messages: ${error}`);
  }
}

/**
 * Fetch user's conversations
 * @param limit Maximum number of conversations to fetch (default: 20)
 * @returns Array of conversations ordered by most recent
 */
export async function getUserConversations(
  limit = 20
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new ChatServiceError(
        `Failed to fetch conversations: ${error.message}`,
        error.code
      );
    }

    return (data || []) as Conversation[];
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }
    throw new ChatServiceError(
      `Unexpected error fetching conversations: ${error}`
    );
  }
}

// ============================================================================
// Streaming Chat
// ============================================================================

/**
 * Send a message and stream the assistant's response
 * @param conversationId UUID of the conversation
 * @param text User's message text
 * @param onToken Callback fired for each token received
 * @param onError Optional callback for handling errors during streaming
 */
export async function sendMessageStream(
  conversationId: string,
  text: string,
  onToken: (token: string) => void,
  onError?: (error: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    // Get JWT token for authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new ChatServiceError("Not authenticated", "UNAUTHORIZED", 401);
    }

    const jwt = session.access_token;

    // Call streaming Edge Function using Expo's streaming fetch
    const response = await expoFetch(`${FN_BASE}/chat-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_text: text,
      }),
      signal,
    });

    if (!response.ok) {
      // Server returns JSON with {kind:'error', status, error:{...}}
      const err = await safeReadJSON(response);
      console.error("Streaming error:", err);
      const errorMessage =
        err?.error?.error?.message ||
        err?.error?.message ||
        `HTTP ${response.status}`;
      throw new ChatServiceError(errorMessage, "HTTP_ERROR", response.status);
    }

    // If server chose non-streaming (debug mode), it returns JSON {text}
    if (response.headers.get("Content-Type")?.includes("application/json")) {
      const j = await response.json();
      if (j?.text) {
        onToken(j.text); // one-shot append
      }
      return;
    }

    // Otherwise expect SSE stream
    if (!response.body) {
      throw new ChatServiceError("No response body", "NO_BODY");
    }

    // Parse SSE stream using Expo's streaming fetch
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines from buffer
        const lines = buffer.split("\n");
        // Keep last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data:")) {
            continue;
          }

          const payload = line.replace(/^data:\s*/, "").trim();

          // Skip [DONE] marker and empty payloads
          if (payload === "[DONE]" || !payload) {
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
            const token = parsed.choices?.[0]?.delta?.content;

            if (token) {
              onToken(token);
            }
          } catch (parseError) {
            // Ignore malformed JSON chunks (common in streaming)
            if (__DEV__) {
              console.debug("Failed to parse SSE chunk:", payload);
            }
          }
        }
      }

      // Process any remaining buffered content
      if (buffer.trim()) {
        const tokens = parseSSEChunk(buffer);
        tokens.forEach(onToken);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (onError) {
      onError(
        error instanceof ChatServiceError
          ? error
          : new ChatServiceError(`Stream error: ${error}`)
      );
    } else {
      throw error;
    }
  }
}

// ============================================================================
// Scope Gating
// ============================================================================

/**
 * Check if user message is within Olive's support scope
 * Uses a cheap classifier to determine if the topic is appropriate
 * @param text User's message text
 * @returns true if in scope, false if out of scope
 */
export async function isInScope(text: string): Promise<boolean> {
  try {
    // Get JWT token for authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new ChatServiceError("Not authenticated", "UNAUTHORIZED", 401);
    }

    const jwt = session.access_token;

    // Call gate Edge Function (no streaming, regular fetch is fine)
    const response = await expoFetch(`${FN_BASE}/gate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        user_text: text,
      }),
    });

    if (!response.ok) {
      // On error, fail open (assume in scope to avoid blocking legitimate requests)
      console.warn(
        `Gate API error: ${response.status}, defaulting to in-scope`
      );
      return true;
    }

    const result: ScopeCheckResult = await response.json();

    return result.scope === "in";
  } catch (error) {
    // On error, fail open (assume in scope)
    console.warn("Scope check error, defaulting to in-scope:", error);
    return true;
  }
}

/**
 * Get a friendly deflection message for out-of-scope topics
 * @param topic Optional topic detected (for customization)
 * @returns A warm, empathetic deflection message
 */
export function getDeflectionMessage(topic?: string): string {
  const deflections = [
    "I appreciate you thinking of me, but I'm not qualified to help with that. I'm here for emotional support and wellbeing conversations. Is there something on your mind I can help you process?",

    "That's outside my area of expertise. I'm designed to support you with emotional wellbeing, stress, and mental health concerns. What's been on your mind lately?",

    "I'd love to help, but that's not something I'm trained for. I'm here to support you with your feelings and mental wellbeing. How have you been feeling recently?",
  ];

  // Return a random deflection for variety
  return deflections[Math.floor(Math.random() * deflections.length)];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delete a conversation (cascades to messages via DB constraints)
 * @param conversationId UUID of the conversation to delete
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      throw new ChatServiceError(
        `Failed to delete conversation: ${error.message}`,
        error.code
      );
    }
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }
    throw new ChatServiceError(
      `Unexpected error deleting conversation: ${error}`
    );
  }
}

/**
 * Update conversation title
 * @param conversationId UUID of the conversation
 * @param title New title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId);

    if (error) {
      throw new ChatServiceError(
        `Failed to update conversation: ${error.message}`,
        error.code
      );
    }
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }
    throw new ChatServiceError(
      `Unexpected error updating conversation: ${error}`
    );
  }
}

/**
 * Persist a message to the database (client-side persistence)
 * Use this after streaming completes to save assistant responses
 * @param conversationId UUID of the conversation
 * @param role Message role (user, assistant, system, tool)
 * @param content Message content
 * @param tokensIn Optional tokens in (for analytics)
 * @param tokensOut Optional tokens out (for analytics)
 */
export async function persistMessage(
  conversationId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  tokensIn = 0,
  tokensOut = 0
): Promise<Message> {
  try {
    const { data, error } = await supabase
      .rpc("add_message", {
        p_conversation_id: conversationId,
        p_role: role,
        p_content: content,
        p_tokens_in: tokensIn,
        p_tokens_out: tokensOut,
      })
      .select()
      .single();

    if (error) {
      throw new ChatServiceError(
        `Failed to persist message: ${error.message}`,
        error.code
      );
    }

    if (!data) {
      throw new ChatServiceError("No data returned from add_message");
    }

    return data as Message;
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw error;
    }
    throw new ChatServiceError(`Unexpected error persisting message: ${error}`);
  }
}
