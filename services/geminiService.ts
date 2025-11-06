// FIX: Removed `LiveSession` from imports as it is not an exported member.
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Chat } from '@google/genai';

// --- Audio Data Encoding/Decoding ---

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Service-level state ---

let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let nextStartTime = 0;
const sources = new Set<AudioBufferSourceNode>();
let chat: Chat | null = null;

function getAiInstance() {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- Live Session Connection ---

interface LiveSessionCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (e: ErrorEvent) => void;
  onMessage: (message: LiveServerMessage) => void;
  onUserAmplitudeChange?: (amplitude: number) => void;
}

// FIX: Removed `Promise<LiveSession>` return type annotation to allow TypeScript to infer it, as `LiveSession` is not an exported type.
export async function connectToLiveSession(callbacks: LiveSessionCallbacks) {
  const ai = getAiInstance();
  
  if (!inputAudioContext) {
      inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  }
  if(!outputAudioContext) {
      outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }

  const outputNode = outputAudioContext.createGain();
  outputNode.connect(outputAudioContext.destination);

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: callbacks.onOpen,
      onclose: callbacks.onClose,
      onerror: callbacks.onError,
      onmessage: async (message: LiveServerMessage) => {
        callbacks.onMessage(message);

        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64EncodedAudioString && outputAudioContext) {
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
          const audioBuffer = await decodeAudioData(
            decode(base64EncodedAudioString),
            outputAudioContext,
            24000,
            1,
          );
          const source = outputAudioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputNode);
          source.addEventListener('ended', () => {
            sources.delete(source);
          });
          source.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
          sources.add(source);
        }

        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
          for (const source of sources.values()) {
            source.stop();
            sources.delete(source);
          }
          nextStartTime = 0;
        }
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: "You are Olive, a compassionate and supportive mental health companion. Your role is to listen attentively, provide evidence-based coping skills from CBT, DBT, and ACT, and guide users through difficult emotions with a calm, gentle, and non-judgmental tone. You are not a therapist, but a helpful guide. Keep your responses concise and empathetic.",
    },
  });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  if (inputAudioContext.state === 'suspended') {
      await inputAudioContext.resume();
  }
  
  const source = inputAudioContext.createMediaStreamSource(stream);
  const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

  scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

    if (callbacks.onUserAmplitudeChange) {
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      callbacks.onUserAmplitudeChange(Math.min(rms * 5, 1.0)); // Scale for better visualization
    }

    const pcmBlob = createBlob(inputData);
    sessionPromise.then((session) => {
      session.sendRealtimeInput({ media: pcmBlob });
    });
  };

  source.connect(scriptProcessor);
  scriptProcessor.connect(inputAudioContext.destination);

  return sessionPromise;
}

// --- Chat Session ---

export function startChatSession(): void {
  const ai = getAiInstance();
  // FIX: Moved `systemInstruction` into a `config` object as required by the API.
  chat = ai.chats.create({
    model: 'gemini-2.5-pro',
    config: {
      systemInstruction: "You are Olive, a compassionate and supportive mental health companion. Your role is to listen attentively, provide evidence-based coping skills from CBT, DBT, and ACT, and guide users through difficult emotions with a calm, gentle, and non-judgmental tone. You are not a therapist, but a helpful guide.",
    }
  });
}

export async function sendChatMessage(message: string): Promise<string> {
  if (!chat) {
    startChatSession();
  }
  if (chat) {
      const response = await chat.sendMessage({ message });
      return response.text;
  }
  throw new Error("Chat session not initialized.");
}