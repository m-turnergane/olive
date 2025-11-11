import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { TranscriptionTurn, Speaker } from "../types";
import * as geminiService from "../services/geminiService";
import useOrbAnimation from "../hooks/useOrbAnimation";
import OliveOrb from "./OliveOrb";

const VoiceView: React.FC = () => {
  const [micPermission, setMicPermission] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<
    TranscriptionTurn[]
  >([]);
  const [isModelSpeaking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Simulated amplitude for the orb animation
  const [userAmplitude, setUserAmplitude] = useState(0);
  const [modelAmplitude, setModelAmplitude] = useState(0);

  const isUserSpeaking = userAmplitude > 0.05;
  const isSomeoneSpeaking = isModelSpeaking || isUserSpeaking;
  const finalAmplitude = isModelSpeaking ? modelAmplitude : userAmplitude;

  const {
    intensity,
    isUserSpeaking: animIsUserSpeaking,
    isModelSpeaking: animIsModelSpeaking,
  } = useOrbAnimation(finalAmplitude, isSomeoneSpeaking, isModelSpeaking);

  // Check for microphone permissions
  useEffect(() => {
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    try {
      const hasPermission = await geminiService.requestAudioPermissions();
      setMicPermission(hasPermission);

      if (!hasPermission) {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in your device settings to use voice chat.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error checking mic permission:", error);
    }
  };

  // Scroll to bottom when new transcriptions arrive
  useEffect(() => {
    if (transcriptionHistory.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [transcriptionHistory]);

  // Note: Full voice session functionality with Gemini Live API is complex on mobile
  // This is a simplified placeholder that shows the UI structure
  useEffect(() => {
    if (micPermission) {
      // Add a system message explaining voice is not yet fully implemented
      setTranscriptionHistory([
        {
          speaker: Speaker.System,
          text: "Voice chat is currently in development for mobile. Please use the Chat tab for text-based conversations with Olive.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [micPermission]);

  return (
    <View style={styles.container}>
      {/* Transcription History */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.transcriptionContainer}
        contentContainerStyle={styles.transcriptionContent}
      >
        {transcriptionHistory.map((turn, index) => {
          const isUser = turn.speaker === Speaker.User;
          const isSystem = turn.speaker === Speaker.System;

          return (
            <View
              key={index}
              style={[
                styles.transcriptionBubble,
                isUser && styles.userBubble,
                !isUser && !isSystem && styles.modelBubble,
                isSystem && styles.systemBubble,
              ]}
            >
              <Text
                style={[
                  styles.transcriptionText,
                  isUser && styles.userText,
                  isSystem && styles.systemText,
                ]}
              >
                {turn.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Jarvis-Style Animated Orb */}
      <View style={styles.orbContainer}>
        <OliveOrb
          intensity={intensity}
          isUserSpeaking={animIsUserSpeaking}
          isModelSpeaking={animIsModelSpeaking}
          size={320}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  transcriptionContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transcriptionContent: {
    paddingTop: 16,
    paddingBottom: 200, // Space for the orb
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
  modelBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
  },
  systemBubble: {
    alignSelf: "center",
    backgroundColor: "#FEE2E2",
    width: "90%",
    maxWidth: "90%",
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
  orbContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 320,
    height: 320,
    marginLeft: -160,
    marginTop: -160,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
});

export default VoiceView;
