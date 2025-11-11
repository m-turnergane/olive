import { useEffect, useRef } from 'react';

/**
 * Custom hook for orb intensity calculation
 * Maps audio amplitude to visual intensity for OliveOrb component
 */
const useOrbAnimation = (
  amplitude: number,
  isSpeaking: boolean,
  isModelSpeaking: boolean
) => {
  // Smoothed amplitude for smoother animations
  const smoothedAmplitude = useRef(0);
  const intensityRef = useRef(0);

  useEffect(() => {
    // Smooth the amplitude changes with exponential moving average
    smoothedAmplitude.current = smoothedAmplitude.current * 0.7 + amplitude * 0.3;

    if (isSpeaking || isModelSpeaking) {
      // Active speaking - higher intensity
      intensityRef.current = Math.min(1, 0.3 + smoothedAmplitude.current * 0.7);
    } else {
      // Idle - low intensity
      intensityRef.current = 0.1;
    }
  }, [amplitude, isSpeaking, isModelSpeaking]);

  return {
    intensity: intensityRef.current,
    isUserSpeaking: isSpeaking,
    isModelSpeaking,
  };
};

export default useOrbAnimation;

