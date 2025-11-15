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
} from "react-native";
import { Audio } from "expo-av";
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
  const [conversationId, setConversationId] = useState<string | null>(
    selectedConversationId || null
  );

  // Audio state for orb animation
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  const realtimeConnection = useRef<realtimeService.RealtimeConnection | null>(
    null
  );

  // Internal transcript buffers (not displayed, only for persistence)
  const currentUserTranscript = useRef<string>("");
  const currentAssistantTranscript = useRef<string>("");

  // Turn management to prevent duplicate response.create
  const currentTurnId = useRef<string>("");
  const hasTriggeredResponse = useRef<boolean>(false);

  // Orb animation hook
  const {
    intensity,
    isUserSpeaking: animIsUserSpeaking,
    isModelSpeaking: animIsModelSpeaking,
  } = useOrbAnimation(
    amplitude,
    isUserSpeaking || isAssistantSpeaking,
    isAssistantSpeaking
  );

  // ============================================================================
  // Permission Management
  // ============================================================================

  useEffect(() => {
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    try {
      setIsCheckingPermission(true);
      const { status } = await Audio.requestPermissionsAsync();
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
  // Conversation Management
  // ============================================================================

  const getOrCreateConversation = async (): Promise<string> => {
    if (conversationId) {
      return conversationId;
    }

    // Create new conversation
    const newConversation = await chatService.createConversation(
      "Voice conversation"
    );
    setConversationId(newConversation.id);

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

      // Ensure we have a conversation ID
      const convId = await getOrCreateConversation();

      // Start a new turn
      currentTurnId.current = Date.now().toString();
      hasTriggeredResponse.current = false;
      currentUserTranscript.current = "";
      currentAssistantTranscript.current = "";

      // Connect to Realtime API
      const connection = await realtimeService.connectRealtime({
        onTranscript: handleUserTranscript,
        onAssistantText: handleAssistantText,
        onUserTurnEnd: handleUserTurnEnd,
        onResponseComplete: handleResponseComplete,
        onSpeakingStart: () => {
          console.log("[VoiceView] Assistant started speaking");
          setIsAssistantSpeaking(true);
          setAmplitude(0.7); // Higher amplitude for assistant
        },
        onSpeakingEnd: () => {
          console.log("[VoiceView] Assistant stopped speaking");
          setIsAssistantSpeaking(false);
          setAmplitude(0);
        },
        onError: (error) => {
          console.error("[VoiceView] Realtime error:", error);
          Alert.alert("Connection Error", error.message);
          setConnectionState("error");
        },
        onConnect: () => {
          console.log("[VoiceView] Connected to Realtime API");
          setConnectionState("connected");
          setIsUserSpeaking(true);
          setAmplitude(0.3); // Lower amplitude for user
        },
        onDisconnect: () => {
          console.log("[VoiceView] Disconnected from Realtime API");
          setConnectionState("idle");
          setIsUserSpeaking(false);
          setIsAssistantSpeaking(false);
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
    }
  };

  const handleDisconnect = async () => {
    if (realtimeConnection.current) {
      await realtimeConnection.current.disconnect();
      realtimeConnection.current = null;
    }
  };

  // ============================================================================
  // Transcript Handlers (Internal Buffering Only - No UI Display)
  // ============================================================================

  const handleUserTranscript = (text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Final transcript - store in buffer
      currentUserTranscript.current = text;
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
      // Final response - store in buffer
      currentAssistantTranscript.current = text;
      console.log("[VoiceView] Assistant response (final):", text);
    } else {
      // Streaming - accumulate but don't display
      currentAssistantTranscript.current += text;
      if (__DEV__) {
        console.debug(
          "[VoiceView] Assistant response (partial):",
          currentAssistantTranscript.current
        );
      }
    }
  };

  // ============================================================================
  // Turn Management
  // ============================================================================

  const handleUserTurnEnd = () => {
    console.log("[VoiceView] User turn ended (VAD detected)");

    // Trigger response.create exactly once per turn
    if (!hasTriggeredResponse.current && realtimeConnection.current) {
      hasTriggeredResponse.current = true;
      realtimeConnection.current.triggerResponse();
      console.log(
        "[VoiceView] Triggered response.create for turn:",
        currentTurnId.current
      );
    }
  };

  const handleResponseComplete = async () => {
    console.log("[VoiceView] Response completed - persisting transcripts");

    try {
      const convId = await getOrCreateConversation();

      // Persist user transcript
      if (currentUserTranscript.current.trim()) {
        await chatService.persistMessage(
          convId,
          "user",
          currentUserTranscript.current
        );
        console.log("[VoiceView] User message persisted");
      }

      // Persist assistant response
      if (currentAssistantTranscript.current.trim()) {
        await chatService.persistMessage(
          convId,
          "assistant",
          currentAssistantTranscript.current
        );
        console.log("[VoiceView] Assistant message persisted");
      }

      // Trigger title generation after first complete exchange
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", convId);

      if (messages && messages.length <= 2) {
        triggerTitleGeneration(convId);
      }

      // Reset for next turn
      currentUserTranscript.current = "";
      currentAssistantTranscript.current = "";
      currentTurnId.current = Date.now().toString();
      hasTriggeredResponse.current = false;
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

      if (!session?.access_token) return;

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const FN_BASE = `${SUPABASE_URL}/functions/v1`;

      await fetch(`${FN_BASE}/generate-title`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_id: convId }),
      });

      console.log("[VoiceView] Title generation triggered");
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
              {isAssistantSpeaking ? "Olive is speaking" : "Listening..."}
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
