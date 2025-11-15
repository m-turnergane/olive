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
} from 'react-native-webrtc';
import { supabase } from './supabaseService';

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
      throw new Error('Not authenticated');
    }

    const jwt = session.access_token;

    const response = await fetch(`${FN_BASE}/realtime-ephemeral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error('[Realtime] Ephemeral token error:', errorData);
      throw new Error(errorMessage);
    }

    const data: EphemeralTokenResponse = await response.json();

    if (!data.ok || !data.token) {
      const errorMessage = data.error || 'Failed to get ephemeral token';
      console.error('[Realtime] Invalid token response:', data);
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch ephemeral token:', error);
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
  let dataChannel: any = null;
  let isConnectedFlag = false;

  try {
    // Step 1: Get ephemeral token
    console.log('[Realtime] Fetching ephemeral token...');
    const tokenData = await getEphemeralToken();
    console.log(`[Realtime] Token received for model: ${tokenData.model}, voice: ${tokenData.voice}`);

    // Step 2: Request microphone access
    console.log('[Realtime] Requesting microphone access...');
    localStream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    console.log('[Realtime] Microphone access granted');

    // Step 3: Create RTCPeerConnection
    console.log('[Realtime] Creating peer connection...');
    peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Step 4: Add local audio stream
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      peerConnection.addTrack(audioTrack, localStream);
      console.log('[Realtime] Local audio track added');
    }

    // Step 5: Handle remote audio track (assistant speaking)
    peerConnection.ontrack = (event) => {
      console.log('[Realtime] Remote track received');
      const remoteStream = event.streams[0];
      
      if (remoteStream) {
        // Note: In React Native, we don't have an HTMLAudioElement
        // The audio should play automatically through the device speakers
        // We just need to track the speaking state
        
        const remoteTrack = remoteStream.getAudioTracks()[0];
        if (remoteTrack) {
          remoteTrack.onended = () => {
            console.log('[Realtime] Remote audio ended');
            callbacks.onSpeakingEnd();
          };
          
          // Signal that assistant started speaking
          callbacks.onSpeakingStart();
        }
      }
    };

    // Step 6: Create data channel for text events
    dataChannel = peerConnection.createDataChannel('oai-events');
    
    dataChannel.onopen = () => {
      console.log('[Realtime] Data channel opened');
    };

    dataChannel.onmessage = (event: { data: string }) => {
      try {
        const message = JSON.parse(event.data);
        handleRealtimeMessage(message, callbacks);
      } catch (error) {
        console.warn('[Realtime] Failed to parse data channel message:', error);
      }
    };

    dataChannel.onerror = (error: any) => {
      console.error('[Realtime] Data channel error:', error);
      callbacks.onError(new Error('Data channel error'));
    };

    // Step 7: Create and set local offer
    console.log('[Realtime] Creating SDP offer...');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Step 8: Send offer to OpenAI Realtime endpoint
    const realtimeUrl = `https://api.openai.com/v1/realtime?model=${tokenData.model}`;
    console.log('[Realtime] Sending offer to:', realtimeUrl);

    const response = await fetch(realtimeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.token}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Realtime connection failed: ${response.status} ${errorText}`);
    }

    // Step 9: Set remote description from server answer
    const answerSdp = await response.text();
    console.log('[Realtime] Received answer SDP');
    
    const answer = new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp,
    });
    await peerConnection.setRemoteDescription(answer);

    console.log('[Realtime] Connection established');
    isConnectedFlag = true;
    callbacks.onConnect();

    // Return connection control object
    return {
      disconnect: async () => {
        console.log('[Realtime] Disconnecting...');
        
        if (dataChannel) {
          dataChannel.close();
          dataChannel = null;
        }

        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          localStream = null;
        }

        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }

        isConnectedFlag = false;
        callbacks.onDisconnect();
        console.log('[Realtime] Disconnected');
      },

      sendText: (text: string) => {
        if (dataChannel && dataChannel.readyState === 'open') {
          const message = JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
              instructions: text,
            },
          });
          dataChannel.send(message);
          console.log('[Realtime] Sent text message');
        } else {
          console.warn('[Realtime] Data channel not open, cannot send text');
        }
      },

      isConnected: () => isConnectedFlag,
    };
  } catch (error) {
    console.error('[Realtime] Connection error:', error);
    
    // Cleanup on error
    if (dataChannel) dataChannel.close();
    if (localStream) {
      localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
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
function handleRealtimeMessage(message: any, callbacks: RealtimeCallbacks) {
  const { type } = message;

  switch (type) {
    case 'conversation.item.input_audio_transcription.completed':
      // User's speech transcription (final)
      if (message.transcript) {
        callbacks.onTranscript(message.transcript, true);
      }
      break;

    case 'conversation.item.input_audio_transcription.delta':
      // User's speech transcription (partial)
      if (message.delta) {
        callbacks.onTranscript(message.delta, false);
      }
      break;

    case 'response.audio_transcript.delta':
      // Assistant's text response (streaming)
      if (message.delta) {
        callbacks.onAssistantText(message.delta, false);
      }
      break;

    case 'response.audio_transcript.done':
      // Assistant's text response (complete)
      if (message.transcript) {
        callbacks.onAssistantText(message.transcript, true);
      }
      break;

    case 'response.audio.delta':
      // Assistant is speaking (audio chunk received)
      // Audio is handled by ontrack event, we just track state
      break;

    case 'response.audio.done':
      // Assistant finished speaking
      callbacks.onSpeakingEnd();
      break;

    case 'error':
      console.error('[Realtime] Server error:', message.error);
      callbacks.onError(new Error(message.error?.message || 'Realtime API error'));
      break;

    default:
      // Log unknown events for debugging
      if (__DEV__) {
        console.debug('[Realtime] Unknown event type:', type);
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
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.warn('[Realtime] Microphone permission denied or unavailable:', error);
    return false;
  }
}

