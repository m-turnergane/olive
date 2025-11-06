import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveServerMessage } from '@google/genai';
import { connectToLiveSession } from '../services/geminiService';
import { TranscriptionTurn, Speaker } from '../types';
import useOrbAnimation from '../hooks/useOrbAnimation';

const VoiceView: React.FC = () => {
  const [micPermission, setMicPermission] = useState<PermissionState | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'closed'>('idle');
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const transcriptionContainerRef = useRef<HTMLDivElement>(null);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userAmplitude, setUserAmplitude] = useState(0);
  const [modelAmplitude, setModelAmplitude] = useState(0);

  const isUserSpeaking = userAmplitude > 0.05;
  const isSomeoneSpeaking = isModelSpeaking || isUserSpeaking;
  const finalAmplitude = isModelSpeaking ? modelAmplitude : userAmplitude;

  useOrbAnimation(canvasRef, finalAmplitude, isSomeoneSpeaking, isModelSpeaking);

  // Generate placeholder amplitude for model when it speaks
  useEffect(() => {
    let animationFrameId: number;
    if (isModelSpeaking) {
      const animate = (time: number) => {
        // Create a gentle pulsing effect using a sine wave
        const pulse = (Math.sin(time / 250) + 1) / 2; // Slower pulse
        setModelAmplitude(0.1 + pulse * 0.3); // Varies between 0.1 and 0.4
        animationFrameId = requestAnimationFrame(animate);
      };
      animationFrameId = requestAnimationFrame(animate);
    } else {
      setModelAmplitude(0);
    }
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isModelSpeaking]);


  const connect = useCallback(async () => {
    setSessionStatus('connecting');
    try {
      await connectToLiveSession({
        onOpen: () => setSessionStatus('connected'),
        onClose: () => setSessionStatus('closed'),
        onError: (e) => {
          console.error(e);
          setSessionStatus('error');
          setTranscriptionHistory(prev => [...prev, { speaker: Speaker.System, text: "Connection error. Please refresh the page.", timestamp: Date.now() }]);
        },
        onUserAmplitudeChange: (amplitude) => {
          setUserAmplitude(amplitude);
        },
        onMessage: (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
            setIsModelSpeaking(true);
          }

          if (message.serverContent?.outputTranscription) {
            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
          } else if (message.serverContent?.inputTranscription) {
            currentInputTranscription.current += message.serverContent.inputTranscription.text;
          }

          if(message.serverContent?.turnComplete) {
              const fullInput = currentInputTranscription.current.trim();
              const fullOutput = currentOutputTranscription.current.trim();
              
              setTranscriptionHistory(prev => {
                  let newHistory = [...prev];
                  if (fullInput) {
                      newHistory.push({ speaker: Speaker.User, text: fullInput, timestamp: Date.now() });
                  }
                  if (fullOutput) {
                      newHistory.push({ speaker: Speaker.Model, text: fullOutput, timestamp: Date.now() });
                  }
                  return newHistory;
              });

              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
              setIsModelSpeaking(false);
          }
        },
      });
    } catch (error) {
      console.error("Failed to connect to Gemini:", error);
      setSessionStatus('error');
      setTranscriptionHistory(prev => [...prev, { speaker: Speaker.System, text: "Failed to initialize session. Check microphone permissions and refresh.", timestamp: Date.now() }]);
    }
  }, []);

  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        if ('permissions' in navigator) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(permissionStatus.state);
          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state);
          };
        }
      } catch (e) {
        console.error("Could not query microphone permissions:", e);
        // Fallback for browsers that might not support query
        setMicPermission('prompt');
      }
    };
    checkMicPermission();
  }, []);

  useEffect(() => {
    if (micPermission === 'granted' && sessionStatus === 'idle') {
      connect();
    }
  }, [micPermission, sessionStatus, connect]);

  useEffect(() => {
    if (transcriptionContainerRef.current) {
      transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
    }
  }, [transcriptionHistory]);

  return (
    <div className="flex flex-col h-full items-center justify-center p-4 pt-20 relative overflow-hidden">
      <div className="flex-1 w-full max-w-2xl overflow-y-auto mb-4" ref={transcriptionContainerRef}>
        {transcriptionHistory.map((turn, index) => (
          <div key={index} className={`mb-4 ${turn.speaker === Speaker.User ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-3 rounded-xl shadow-md max-w-lg ${
                turn.speaker === Speaker.User ? 'bg-olive-sage text-white' : 
                turn.speaker === Speaker.Model ? 'bg-white text-olive-accent' : 
                'bg-red-900 text-white text-center w-full'
            }`}>
              {turn.text}
            </div>
          </div>
        ))}
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none w-full max-w-md h-[40vh]">
         <canvas ref={canvasRef} className="w-full h-full" />
      </div>

    </div>
  );
};

export default VoiceView;