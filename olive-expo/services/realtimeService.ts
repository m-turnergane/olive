// olive-expo/services/realtimeService.ts
// WebRTC-based OpenAI Realtime API client for React Native
// Handles ephemeral token minting, peer connection, and bidirectional audio/text

// @ts-ignore - react-native-webrtc will be installed via npm
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
  MediaStreamTrack,
  RTCIceCandidate,
} from "react-native-webrtc";
import { supabase } from "./supabaseService";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

// ============================================================================
// Types
// ============================================================================

export interface RealtimeCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onAssistantText: (text: string, isFinal: boolean) => void;
  onSpeakingStart: () => void;
  onSpeakingEnd: () => void;
  onResponseComplete: () => void; // Fired when response.done
  onUserSpeechStart: () => void; // Fired when VAD detects user started speaking
  onUserSpeechStop: () => void; // Fired when VAD detects user stopped speaking
  onError: (error: Error) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export interface EphemeralTokenResponse {
  ok: boolean;
  token: string;
  session_id: string;
  model: string;
  voice: string;
  expires_at?: string;
  error?: string;
}

export interface RealtimeConnection {
  disconnect: () => Promise<void>;
  sendText: (text: string) => void;
  isConnected: () => boolean;
}

// ============================================================================
// Ephemeral Token Management
// ============================================================================

/**
 * Fetch an ephemeral token from the Supabase Edge Function
 * @returns Ephemeral token response with token and session metadata
 */
export async function getEphemeralToken(): Promise<EphemeralTokenResponse> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }

    const jwt = session.access_token;

    const response = await fetch(`${FN_BASE}/realtime-ephemeral`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage =
        errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error("[Realtime] Ephemeral token error:", errorData);
      throw new Error(errorMessage);
    }

    const data: EphemeralTokenResponse = await response.json();

    if (!data.ok || !data.token) {
      const errorMessage = data.error || "Failed to get ephemeral token";
      console.error("[Realtime] Invalid token response:", data);
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error("Failed to fetch ephemeral token:", error);
    throw error;
  }
}

// ============================================================================
// WebRTC Connection Management
// ============================================================================

/**
 * Connect to OpenAI Realtime API via WebRTC
 * @param callbacks Event callbacks for transcription, assistant responses, and connection state
 * @returns RealtimeConnection object with disconnect method
 */
export async function connectRealtime(
  callbacks: RealtimeCallbacks
): Promise<RealtimeConnection> {
  let peerConnection: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let localAudioTrack: MediaStreamTrack | null = null;
  let dataChannel: any = null;
  let isConnectedFlag = false;

  // State object for cooldown management (shared across message handler calls)
  const cooldownState = {
    timeout: null as NodeJS.Timeout | null,
    isInCooldown: false,
  };

  try {
    // Step 1: Get ephemeral token
    console.log("[Realtime] Fetching ephemeral token...");
    const tokenData = await getEphemeralToken();
    console.log(
      `[Realtime] Token received for model: ${tokenData.model}, voice: ${tokenData.voice}`
    );

    // Step 2: Request microphone access
    console.log("[Realtime] Requesting microphone access...");
    localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    console.log("[Realtime] Microphone access granted");

    // Step 3: Create RTCPeerConnection
    console.log("[Realtime] Creating peer connection...");
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Step 4: Add local audio stream and store track reference
    localAudioTrack = localStream.getAudioTracks()[0];
    if (localAudioTrack) {
      peerConnection.addTrack(localAudioTrack, localStream);
      console.log("[Realtime] Local audio track added");
    }

    // Step 5: Handle remote audio track (assistant speaking)
    (peerConnection as any).ontrack = (event: any) => {
      console.log("[Realtime] Remote track received");
      // Remote audio plays automatically in React Native
      // Event handling is done via data channel messages
    };

    // Step 6: Create data channel for text events
    dataChannel = peerConnection.createDataChannel("oai-events");

    dataChannel.onopen = () => {
      console.log("[Realtime] Data channel opened");
    };

    dataChannel.onmessage = (event: { data: string }) => {
      try {
        const message = JSON.parse(event.data);
        handleRealtimeMessage(
          message,
          callbacks,
          localAudioTrack,
          cooldownState
        );
      } catch (error) {
        console.warn("[Realtime] Failed to parse data channel message:", error);
      }
    };

    dataChannel.onerror = (error: any) => {
      console.error("[Realtime] Data channel error:", error);
      callbacks.onError(new Error("Data channel error"));
    };

    // Step 7: Create and set local offer
    console.log("[Realtime] Creating SDP offer...");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Step 8: Send offer to OpenAI Realtime endpoint
    const realtimeUrl = `https://api.openai.com/v1/realtime?model=${tokenData.model}`;
    console.log("[Realtime] Sending offer to:", realtimeUrl);

    const response = await fetch(realtimeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.token}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Realtime connection failed: ${response.status} ${errorText}`
      );
    }

    // Step 9: Set remote description from server answer
    const answerSdp = await response.text();
    console.log("[Realtime] Received answer SDP");

    const answer = new RTCSessionDescription({
      type: "answer",
      sdp: answerSdp,
    });
    await peerConnection.setRemoteDescription(answer);

    console.log("[Realtime] Connection established");
    isConnectedFlag = true;
    callbacks.onConnect();

    // Return connection control object
    return {
      disconnect: async () => {
        console.log("[Realtime] Disconnecting...");

        // Clear cooldown timer
        if (cooldownState.timeout) {
          clearTimeout(cooldownState.timeout);
          cooldownState.timeout = null;
        }

        if (dataChannel) {
          dataChannel.close();
          dataChannel = null;
        }

        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          localStream = null;
        }

        if (localAudioTrack) {
          localAudioTrack.stop();
          localAudioTrack = null;
        }

        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }

        isConnectedFlag = false;
        callbacks.onDisconnect();
        console.log("[Realtime] Disconnected");
      },

      sendText: (text: string) => {
        if (dataChannel && dataChannel.readyState === "open") {
          const message = JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["text", "audio"],
              instructions: text,
            },
          });
          dataChannel.send(message);
          console.log("[Realtime] Sent text message");
        } else {
          console.warn("[Realtime] Data channel not open, cannot send text");
        }
      },

      isConnected: () => isConnectedFlag,
    };
  } catch (error) {
    console.error("[Realtime] Connection error:", error);

    // Cleanup on error
    if (cooldownState.timeout) clearTimeout(cooldownState.timeout);
    if (dataChannel) dataChannel.close();
    if (localStream) {
      localStream
        .getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
    }
    if (localAudioTrack) localAudioTrack.stop();
    if (peerConnection) peerConnection.close();

    callbacks.onError(error as Error);
    throw error;
  }
}

// ============================================================================
// Realtime Message Handlers
// ============================================================================

/**
 * Handle incoming Realtime API events from data channel
 */
function handleRealtimeMessage(
  message: any,
  callbacks: RealtimeCallbacks,
  localAudioTrack: MediaStreamTrack | null,
  cooldownState: { timeout: NodeJS.Timeout | null; isInCooldown: boolean }
) {
  const { type } = message;

  switch (type) {
    // Session events
    case "session.created":
    case "session.updated":
      // Session lifecycle - already logged connection
      break;

    // Input audio buffer events (user speaking)
    case "input_audio_buffer.speech_started":
      // User started speaking - VAD detected
      if (!cooldownState.isInCooldown) {
        callbacks.onUserSpeechStart();
      }
      break;

    case "input_audio_buffer.speech_stopped":
      // User stopped speaking - VAD detected
      callbacks.onUserSpeechStop();

      // Start cooldown to avoid false triggers
      if (cooldownState.timeout) {
        clearTimeout(cooldownState.timeout);
      }
      cooldownState.isInCooldown = true;
      cooldownState.timeout = setTimeout(() => {
        cooldownState.isInCooldown = false;
      }, 300); // 300ms cooldown
      break;

    case "input_audio_buffer.committed":
      // Audio buffer committed after user stopped
      // With create_response:true, server will auto-trigger response
      break;

    case "input_audio_buffer.cleared":
      // Buffer was cleared (e.g., due to interruption)
      break;

    // Conversation item events
    case "conversation.item.created":
      // New conversation item (user or assistant message)
      break;

    case "conversation.item.truncated":
      // Item was truncated (interruption)
      break;

    case "conversation.item.deleted":
      // Item was deleted
      break;

    case "conversation.item.input_audio_transcription.completed":
      // User's speech transcription (final)
      if (message.transcript) {
        const trimmedTranscript = message.transcript.trim();
        // Only accept meaningful transcripts (≥3 chars)
        if (trimmedTranscript.length >= 3) {
          callbacks.onTranscript(trimmedTranscript, true);
        } else {
          console.log(
            "[Realtime] Discarded short transcript:",
            trimmedTranscript
          );
        }
      }
      break;

    case "conversation.item.input_audio_transcription.failed":
      console.warn("[Realtime] Transcription failed:", message.error);
      break;

    // Response events (assistant)
    case "response.created":
      // Response generation started
      break;

    case "response.output_item.added":
      // Output item added to response
      break;

    case "response.content_part.added":
      // Content part added
      break;

    case "response.content_part.done":
      // Content part completed
      break;

    case "response.output_item.done":
      // Output item completed
      break;

    case "response.done":
      // Response fully completed - re-enable mic and signal finalization
      if (localAudioTrack) {
        localAudioTrack.enabled = true;
        console.log("[Realtime] Mic re-enabled after response.done");
      }
      callbacks.onResponseComplete();
      break;

    case "response.cancelled":
      // Response was cancelled - re-enable mic
      if (localAudioTrack) {
        localAudioTrack.enabled = true;
        console.log("[Realtime] Mic re-enabled after response.cancelled");
      }
      break;

    case "response.failed":
      console.error("[Realtime] Response failed:", message.error);
      // Re-enable mic on failure
      if (localAudioTrack) {
        localAudioTrack.enabled = true;
      }
      callbacks.onError(new Error(message.error?.message || "Response failed"));
      break;

    // Audio transcript events (text version of audio)
    case "response.audio_transcript.delta":
      // Assistant's text response (streaming)
      if (message.delta) {
        callbacks.onAssistantText(message.delta, false);
      }
      break;

    case "response.audio_transcript.done":
      // Assistant's text response (complete)
      if (message.transcript) {
        callbacks.onAssistantText(message.transcript, true);
      }
      break;

    // Audio buffer events
    case "response.audio.delta":
      // Assistant audio chunk - first delta means audio started
      // Mute mic when assistant starts speaking
      if (localAudioTrack && localAudioTrack.enabled) {
        localAudioTrack.enabled = false;
        console.log("[Realtime] Mic muted on first audio delta");
      }
      break;

    case "response.audio.done":
      // Assistant finished speaking audio - DON'T unmute here
      // Wait for response.done instead to ensure full completion
      callbacks.onSpeakingEnd();
      break;

    case "response.audio_transcript.started":
      // Assistant started generating audio transcript
      break;

    case "response.started":
      // Response started - mute mic immediately
      if (localAudioTrack) {
        localAudioTrack.enabled = false;
        console.log("[Realtime] Mic muted on response.started");
      }
      callbacks.onSpeakingStart();
      break;

    // Rate limits
    case "rate_limits.updated":
      // Rate limit info updated - can log if needed
      break;

    // Errors
    case "error":
      console.error("[Realtime] Server error:", message.error);
      callbacks.onError(
        new Error(message.error?.message || "Realtime API error")
      );
      break;

    default:
      // Log truly unknown events for debugging
      if (__DEV__) {
        console.debug("[Realtime] Unhandled event type:", type);
      }
      break;
  }
}

// ============================================================================
// Permissions Helper
// ============================================================================

/**
 * Check if microphone permissions are granted
 * @returns true if permission granted, false otherwise
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    // In React Native, we need to use expo-audio for permission checks
    // This is a fallback that attempts to access the microphone
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.warn(
      "[Realtime] Microphone permission denied or unavailable:",
      error
    );
    return false;
  }
}
