// olive-expo/components/VoiceView.tsx
// Voice interaction view with OpenAI Realtime API integration

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as realtimeService from "../services/realtimeService";
import * as chatService from "../services/chatService";
import { supabase } from "../services/supabaseService";
import useOrbAnimation from "../hooks/useOrbAnimation";
import OliveOrb from "./OliveOrb";

// ============================================================================
// Types
// ============================================================================

interface VoiceViewProps {
  selectedConversationId?: string | null;
  onConversationCreated?: (conversationId: string) => void;
}

interface TranscriptBubble {
  role: "user" | "assistant" | "system";
  text: string;
  id: string;
  isFinal: boolean;
}

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type VoiceTurnState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

// ============================================================================
// VoiceView Component
// ============================================================================

const VoiceView: React.FC<VoiceViewProps> = ({
  selectedConversationId,
  onConversationCreated,
}) => {
  const [micPermission, setMicPermission] = useState<boolean>(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");

  // Voice Turn State Machine
  const [voiceTurnState, setVoiceTurnState] = useState<VoiceTurnState>("IDLE");

  // Audio state for orb animation
  const [amplitude, setAmplitude] = useState(0);

  const realtimeConnection = useRef<realtimeService.RealtimeConnection | null>(
    null
  );

  // Single conversation ID for entire voice session - set once on connect
  const activeConversationId = useRef<string | null>(
    selectedConversationId || null
  );

  // Internal transcript buffers (not displayed, only for persistence)
  const pendingTurn = useRef<{
    userText: string;
    assistantText: string;
  }>({
    userText: "",
    assistantText: "",
  });

  // Orb animation hook - derive from state machine
  const isUserSpeaking = voiceTurnState === "LISTENING";
  const isModelSpeaking = voiceTurnState === "SPEAKING";

  const {
    intensity,
    isUserSpeaking: animIsUserSpeaking,
    isModelSpeaking: animIsModelSpeaking,
  } = useOrbAnimation(
    amplitude,
    isUserSpeaking || isModelSpeaking,
    isModelSpeaking
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // Sync selected conversation ID from props
  useEffect(() => {
    if (selectedConversationId) {
      activeConversationId.current = selectedConversationId;
      console.log(
        "[VoiceView] Synced conversation ID from props:",
        selectedConversationId
      );
    }
  }, [selectedConversationId]);

  // ============================================================================
  // Permission Management
  // ============================================================================

  useEffect(() => {
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    try {
      setIsCheckingPermission(true);

      // Configure audio session for iOS (play-and-record with default-to-speaker)
      // This reduces CoreAudio warnings on simulator
      if (Platform.OS === "ios") {
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
          });
        } catch (audioError) {
          // Non-fatal - simulator may produce warnings but will work
          console.log(
            "[VoiceView] Audio mode setup (simulator warnings expected):",
            audioError
          );
        }
      }

      const { status } = await requestRecordingPermissionsAsync();
      const granted = status === "granted";
      setMicPermission(granted);

      if (!granted) {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in your device settings to use voice chat.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error checking mic permission:", error);
      setMicPermission(false);
    } finally {
      setIsCheckingPermission(false);
    }
  };

  // ============================================================================
  // Conversation Management - ONE conversation per voice session
  // ============================================================================

  /**
   * Initialize conversation for voice session - called ONCE at session start
   * Reuses existing conversation if provided, otherwise creates new one
   */
  const initializeConversation = async (): Promise<string> => {
    // If we already have an active conversation ID, reuse it
    if (activeConversationId.current) {
      return activeConversationId.current;
    }

    // Create new conversation for this voice session
    const newConversation = await chatService.createConversation(
      "Voice conversation"
    );

    // Store it for the entire session
    activeConversationId.current = newConversation.id;

    // Notify parent component
    if (onConversationCreated) {
      onConversationCreated(newConversation.id);
    }

    return newConversation.id;
  };

  // ============================================================================
  // Realtime Connection Management
  // ============================================================================

  const handleConnect = async () => {
    if (!micPermission) {
      Alert.alert(
        "Permission Required",
        "Microphone access is required for voice chat."
      );
      return;
    }

    try {
      setConnectionState("connecting");
      setVoiceTurnState("IDLE");

      // Initialize conversation ONCE for this voice session
      await initializeConversation();
      console.log(
        "[VoiceView] Using conversation ID:",
        activeConversationId.current
      );

      // Reset pending turn
      pendingTurn.current = {
        userText: "",
        assistantText: "",
      };

      // Connect to Realtime API
      const connection = await realtimeService.connectRealtime({
        onTranscript: handleUserTranscript,
        onAssistantText: handleAssistantText,
        onUserSpeechStart: () => {
          console.log("[VoiceView] User started speaking");
          setVoiceTurnState("LISTENING");
          setAmplitude(0.3); // Lower amplitude for user
        },
        onUserSpeechStop: () => {
          console.log("[VoiceView] User stopped speaking");
          setVoiceTurnState("THINKING");
          setAmplitude(0);
        },
        onResponseComplete: handleResponseComplete,
        onSpeakingStart: () => {
          console.log("[VoiceView] Assistant started speaking");
          setVoiceTurnState("SPEAKING");
          setAmplitude(0.7); // Higher amplitude for assistant
        },
        onSpeakingEnd: () => {
          console.log("[VoiceView] Assistant stopped speaking");
          // Don't change state here - wait for response.done
        },
        onError: (error) => {
          console.error("[VoiceView] Realtime error:", error);
          Alert.alert("Connection Error", error.message);
          setConnectionState("error");
          setVoiceTurnState("IDLE");
        },
        onConnect: () => {
          console.log("[VoiceView] Connected to Realtime API");
          setConnectionState("connected");
          setVoiceTurnState("LISTENING");
        },
        onDisconnect: () => {
          console.log("[VoiceView] Disconnected from Realtime API");
          setConnectionState("idle");
          setVoiceTurnState("IDLE");
          setAmplitude(0);
        },
      });

      realtimeConnection.current = connection;
    } catch (error) {
      console.error("[VoiceView] Failed to connect:", error);
      Alert.alert(
        "Connection Failed",
        "Could not connect to voice service. Please try again."
      );
      setConnectionState("error");
      setVoiceTurnState("IDLE");
    }
  };

  const handleDisconnect = async () => {
    if (realtimeConnection.current) {
      await realtimeConnection.current.disconnect();
      realtimeConnection.current = null;
    }

    // Note: We keep activeConversationId intact so if user reconnects
    // in the same session, they continue the same conversation.
    // If they want a new conversation, they should select "New Chat" first.
  };

  // ============================================================================
  // Transcript Handlers (Internal Buffering Only - No UI Display)
  // ============================================================================

  const handleUserTranscript = (text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Final transcript - store in pending turn
      pendingTurn.current.userText = text;
      console.log("[VoiceView] User transcript (final):", text);
    } else {
      // Partial - just log for debugging, don't display
      if (__DEV__) {
        console.debug("[VoiceView] User transcript (partial):", text);
      }
    }
  };

  const handleAssistantText = (text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Final response - store in pending turn
      pendingTurn.current.assistantText = text;
      console.log("[VoiceView] Assistant response (final):", text);
    } else {
      // Streaming - accumulate but don't display
      pendingTurn.current.assistantText += text;
      if (__DEV__) {
        console.debug(
          "[VoiceView] Assistant response (partial):",
          pendingTurn.current.assistantText
        );
      }
    }
  };

  // ============================================================================
  // Turn Management
  // ============================================================================

  const handleResponseComplete = async () => {
    console.log("[VoiceView] Response completed - persisting transcripts");

    try {
      // Use the active conversation ID for this session
      const convId = activeConversationId.current;

      if (!convId) {
        console.error(
          "[VoiceView] No active conversation ID - this should not happen"
        );
        return;
      }

      // Persist user transcript if present
      if (pendingTurn.current.userText.trim()) {
        await chatService.persistMessage(
          convId,
          "user",
          pendingTurn.current.userText
        );
        console.log(
          "[VoiceView] User message persisted to conversation:",
          convId
        );
      }

      // Persist assistant response if present
      if (pendingTurn.current.assistantText.trim()) {
        await chatService.persistMessage(
          convId,
          "assistant",
          pendingTurn.current.assistantText
        );
        console.log(
          "[VoiceView] Assistant message persisted to conversation:",
          convId
        );
      }

      // Trigger title generation after first complete exchange (1 user + 1 assistant)
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", convId);

      if (messages && messages.length === 2) {
        // Exactly 2 messages = first exchange complete
        console.log("[VoiceView] First exchange complete - generating title");
        triggerTitleGeneration(convId);
      }

      // Reset for next turn and transition to LISTENING state
      pendingTurn.current = {
        userText: "",
        assistantText: "",
      };
      setVoiceTurnState("LISTENING");
      setAmplitude(0);
    } catch (error) {
      console.error("[VoiceView] Failed to persist messages:", error);
    }
  };

  // ============================================================================
  // Title Generation
  // ============================================================================

  const triggerTitleGeneration = async (convId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.log("[VoiceView] No session token - skipping title generation");
        return;
      }

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const FN_BASE = `${SUPABASE_URL}/functions/v1`;

      console.log(
        `[VoiceView] Calling generate-title for conversation: ${convId}`
      );

      const response = await fetch(`${FN_BASE}/generate-title`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_id: convId }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[VoiceView] ✅ Title generated: "${result.title}"`);
      } else {
        const errorText = await response.text();
        console.error(
          `[VoiceView] Title generation failed: ${response.status} - ${errorText}`
        );
      }
    } catch (error) {
      console.error("[VoiceView] Failed to generate title:", error);
    }
  };

  // ============================================================================
  // Cleanup
  // ============================================================================

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (realtimeConnection.current) {
        realtimeConnection.current.disconnect();
      }
    };
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  if (isCheckingPermission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E8C61" />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  if (!micPermission) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Microphone Access Required</Text>
        <Text style={styles.errorText}>
          Voice chat requires microphone access. Please enable it in your device
          settings.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={checkMicPermission}
        >
          <Text style={styles.retryButtonText}>Check Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Olive Orb - Interactive (Center of Screen) */}
      <View style={styles.orbContainer}>
        <TouchableOpacity
          onPress={
            connectionState === "idle" || connectionState === "error"
              ? handleConnect
              : handleDisconnect
          }
          disabled={connectionState === "connecting"}
          activeOpacity={0.8}
        >
          <OliveOrb
            intensity={intensity}
            isUserSpeaking={animIsUserSpeaking}
            isModelSpeaking={animIsModelSpeaking}
            size={280}
          />
        </TouchableOpacity>

        {/* Connection State Indicator */}
        <View style={styles.stateContainer}>
          {connectionState === "connecting" && (
            <Text style={styles.stateText}>Connecting...</Text>
          )}
          {connectionState === "connected" && (
            <Text style={[styles.stateText, styles.connectedText]}>
              {voiceTurnState === "LISTENING" && "Listening..."}
              {voiceTurnState === "THINKING" && "Processing..."}
              {voiceTurnState === "SPEAKING" && "Olive is speaking"}
              {voiceTurnState === "IDLE" && "Connected"}
            </Text>
          )}
          {connectionState === "idle" && (
            <Text style={styles.stateText}>Tap to start</Text>
          )}
          {connectionState === "error" && (
            <Text style={[styles.stateText, styles.errorStateText]}>
              Connection error - Tap to retry
            </Text>
          )}
        </View>

        {/* Stop Button (when connected) */}
        {connectionState === "connected" && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleDisconnect}
          >
            <Text style={styles.stopButtonText}>End Session</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#5E8C61",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#5E8C61",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  orbContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  stateContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  stateText: {
    fontSize: 18,
    color: "rgba(27, 58, 47, 0.7)",
    fontWeight: "500",
  },
  connectedText: {
    color: "#5E8C61",
  },
  errorStateText: {
    color: "#DC2626",
  },
  stopButton: {
    marginTop: 20,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default VoiceView;
