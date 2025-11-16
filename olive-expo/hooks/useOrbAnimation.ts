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
    // Guard against NaN and infinity - clamp amplitude to valid range
    const clampedAmplitude = Number.isFinite(amplitude) 
      ? Math.max(0, Math.min(1, amplitude)) 
      : 0;

    // Smooth the amplitude changes with exponential moving average
    smoothedAmplitude.current = smoothedAmplitude.current * 0.7 + clampedAmplitude * 0.3;

    // Ensure smoothed value is also finite
    if (!Number.isFinite(smoothedAmplitude.current)) {
      smoothedAmplitude.current = 0;
    }

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

