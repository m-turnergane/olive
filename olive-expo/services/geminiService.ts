import { GoogleGenerativeAI } from '@google/generative-ai';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Get API key from environment
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;

let genAI: GoogleGenerativeAI;
let chatSession: any = null;

/**
 * Initialize the Gemini AI instance
 */
function getAiInstance() {
  if (!genAI) {
    if (!API_KEY) {
      throw new Error('EXPO_PUBLIC_GEMINI_API_KEY environment variable not set.');
    }
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

/**
 * System instruction for Olive
 */
const SYSTEM_INSTRUCTION = `You are Olive, a compassionate and supportive mental health companion. Your role is to listen attentively, provide evidence-based coping skills from CBT, DBT, and ACT, and guide users through difficult emotions with a calm, gentle, and non-judgmental tone. You are not a therapist, but a helpful guide. Keep your responses concise and empathetic.`;

/**
 * Start a new chat session
 */
export function startChatSession(): void {
  const ai = getAiInstance();
  const model = ai.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  chatSession = model.startChat({
    history: [],
  });
}

/**
 * Send a message in the chat session
 */
export async function sendChatMessage(message: string): Promise<string> {
  try {
    if (!chatSession) {
      startChatSession();
    }

    const result = await chatSession.sendMessage(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

/**
 * Reset the chat session
 */
export function resetChatSession(): void {
  chatSession = null;
}

// ============================================================================
// VOICE SESSION FUNCTIONALITY
// Note: Voice functionality with Gemini Live API on React Native is complex
// and requires additional implementation with Expo AV and WebSocket connections.
// The following is a simplified placeholder structure.
// ============================================================================

interface VoiceSessionCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onTranscription?: (text: string, isFinal: boolean, isUser: boolean) => void;
  onAudioData?: (audioData: ArrayBuffer) => void;
}

let recording: Audio.Recording | null = null;
let isRecording = false;

/**
 * Request audio recording permissions
 */
export async function requestAudioPermissions(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting audio permissions:', error);
    return false;
  }
}

/**
 * Start voice recording
 * Note: This is a simplified version. Full Gemini Live API integration
 * would require WebSocket connection and real-time audio streaming.
 */
export async function startVoiceRecording(): Promise<void> {
  try {
    // Request permissions
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) {
      throw new Error('Audio recording permission not granted');
    }

    // Configure audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    // Create and start recording
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    recording = newRecording;
    isRecording = true;
  } catch (error) {
    console.error('Error starting voice recording:', error);
    throw error;
  }
}

/**
 * Stop voice recording and get the audio URI
 */
export async function stopVoiceRecording(): Promise<string | null> {
  try {
    if (!recording) {
      return null;
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    isRecording = false;

    return uri;
  } catch (error) {
    console.error('Error stopping voice recording:', error);
    throw error;
  }
}

/**
 * Get recording status
 */
export function getRecordingStatus(): boolean {
  return isRecording;
}

/**
 * Play audio from URI
 */
export async function playAudio(uri: string): Promise<void> {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );

    await sound.playAsync();
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
}

/**
 * Connect to voice session
 * Note: This is a placeholder for the complex Gemini Live API integration.
 * Full implementation would require:
 * 1. WebSocket connection to Gemini Live API
 * 2. Real-time audio streaming
 * 3. Audio format conversion (PCM encoding/decoding)
 * 4. Handling of audio chunks and transcriptions
 * 
 * For MVP, we focus on text-based chat. Voice can be added in future iterations.
 */
export async function connectToVoiceSession(
  callbacks: VoiceSessionCallbacks
): Promise<void> {
  // TODO: Implement full Gemini Live API integration
  // For now, this is a placeholder
  console.warn('Voice session functionality is not yet fully implemented in React Native');
  
  if (callbacks.onError) {
    callbacks.onError(new Error('Voice sessions are not yet supported in the mobile app'));
  }
}

/**
 * Disconnect from voice session
 */
export function disconnectVoiceSession(): void {
  if (recording && isRecording) {
    stopVoiceRecording();
  }
}

