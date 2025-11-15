// olive-expo/components/VoiceView.tsx
// Voice interaction view with OpenAI Realtime API integration

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
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
  const [transcripts, setTranscripts] = useState<TranscriptBubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    selectedConversationId || null
  );

  // Audio state for orb animation
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const realtimeConnection = useRef<realtimeService.RealtimeConnection | null>(
    null
  );

  // Track partial transcripts for streaming
  const currentUserTranscript = useRef<string>("");
  const currentAssistantTranscript = useRef<string>("");
  const userTranscriptId = useRef<string>("");
  const assistantTranscriptId = useRef<string>("");

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

      // Connect to Realtime API
      const connection = await realtimeService.connectRealtime({
        onTranscript: handleUserTranscript,
        onAssistantText: handleAssistantText,
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
  // Transcript Handlers
  // ============================================================================

  const handleUserTranscript = async (text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Final transcript - persist to database
      console.log("[VoiceView] User transcript (final):", text);
      currentUserTranscript.current = text;

      // Update UI with final transcript
      setTranscripts((prev) => {
        const filtered = prev.filter((t) => t.id !== userTranscriptId.current);
        return [
          ...filtered,
          {
            role: "user",
            text,
            id: userTranscriptId.current || `user-${Date.now()}`,
            isFinal: true,
          },
        ];
      });

      // Persist to database
      try {
        const convId = await getOrCreateConversation();
        await chatService.persistMessage(convId, "user", text);
        console.log("[VoiceView] User message persisted");
      } catch (error) {
        console.error("[VoiceView] Failed to persist user message:", error);
      }

      // Reset for next transcript
      currentUserTranscript.current = "";
      userTranscriptId.current = "";
    } else {
      // Partial transcript - update UI only
      console.log("[VoiceView] User transcript (partial):", text);
      currentUserTranscript.current = text;

      if (!userTranscriptId.current) {
        userTranscriptId.current = `user-${Date.now()}`;
      }

      setTranscripts((prev) => {
        const filtered = prev.filter((t) => t.id !== userTranscriptId.current);
        return [
          ...filtered,
          {
            role: "user",
            text,
            id: userTranscriptId.current,
            isFinal: false,
          },
        ];
      });
    }

    // Auto-scroll
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleAssistantText = async (text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Final response - persist to database
      console.log("[VoiceView] Assistant response (final):", text);
      currentAssistantTranscript.current = text;

      // Update UI with final response
      setTranscripts((prev) => {
        const filtered = prev.filter(
          (t) => t.id !== assistantTranscriptId.current
        );
        return [
          ...filtered,
          {
            role: "assistant",
            text,
            id: assistantTranscriptId.current || `assistant-${Date.now()}`,
            isFinal: true,
          },
        ];
      });

      // Persist to database
      try {
        const convId = await getOrCreateConversation();
        await chatService.persistMessage(convId, "assistant", text);
        console.log("[VoiceView] Assistant message persisted");

        // Trigger title generation after first exchange
        if (
          transcripts.filter((t) => t.role === "user" && t.isFinal).length === 1
        ) {
          triggerTitleGeneration(convId);
        }
      } catch (error) {
        console.error(
          "[VoiceView] Failed to persist assistant message:",
          error
        );
      }

      // Reset for next response
      currentAssistantTranscript.current = "";
      assistantTranscriptId.current = "";
    } else {
      // Partial response - update UI only
      currentAssistantTranscript.current += text;

      if (!assistantTranscriptId.current) {
        assistantTranscriptId.current = `assistant-${Date.now()}`;
      }

      setTranscripts((prev) => {
        const filtered = prev.filter(
          (t) => t.id !== assistantTranscriptId.current
        );
        return [
          ...filtered,
          {
            role: "assistant",
            text: currentAssistantTranscript.current,
            id: assistantTranscriptId.current,
            isFinal: false,
          },
        ];
      });
    }

    // Auto-scroll
    scrollViewRef.current?.scrollToEnd({ animated: true });
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
      {/* Transcription History */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.transcriptionContainer}
        contentContainerStyle={styles.transcriptionContent}
      >
        {transcripts.length === 0 && connectionState === "idle" && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Tap the orb below to start a voice conversation with Olive
            </Text>
          </View>
        )}

        {transcripts.map((transcript) => (
          <View
            key={transcript.id}
            style={[
              styles.transcriptionBubble,
              transcript.role === "user" && styles.userBubble,
              transcript.role === "assistant" && styles.assistantBubble,
              transcript.role === "system" && styles.systemBubble,
              !transcript.isFinal && styles.partialBubble,
            ]}
          >
            <Text
              style={[
                styles.transcriptionText,
                transcript.role === "user" && styles.userText,
                transcript.role === "system" && styles.systemText,
                !transcript.isFinal && styles.partialText,
              ]}
            >
              {transcript.text}
            </Text>
            {!transcript.isFinal && (
              <Text style={styles.streamingIndicator}>...</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Olive Orb - Interactive */}
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
    position: "relative",
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
  transcriptionContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transcriptionContent: {
    paddingTop: 16,
    paddingBottom: 300, // Space for the orb
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: "rgba(27, 58, 47, 0.6)",
    textAlign: "center",
    lineHeight: 24,
  },
  transcriptionBubble: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#5E8C61",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F0F4F1",
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.15)",
  },
  systemBubble: {
    alignSelf: "center",
    backgroundColor: "#FEE2E2",
    width: "90%",
    maxWidth: "90%",
  },
  partialBubble: {
    opacity: 0.8,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#0C221B",
  },
  userText: {
    color: "#FFFFFF",
  },
  systemText: {
    color: "#DC2626",
    textAlign: "center",
  },
  partialText: {
    fontStyle: "italic",
  },
  streamingIndicator: {
    fontSize: 14,
    color: "rgba(0, 0, 0, 0.4)",
    marginTop: 4,
  },
  orbContainer: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  stateContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  stateText: {
    fontSize: 16,
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
    marginTop: 16,
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default VoiceView;
