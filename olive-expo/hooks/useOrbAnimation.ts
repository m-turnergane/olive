import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Custom hook for orb animation using React Native Animated API
 * This is a simplified version that doesn't use Skia, suitable for React Native
 */
const useOrbAnimation = (
  amplitude: number,
  isSpeaking: boolean,
  isModelSpeaking: boolean
) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  
  // Smoothed amplitude for smoother animations
  const smoothedAmplitude = useRef(0);

  useEffect(() => {
    // Smooth the amplitude changes
    smoothedAmplitude.current = smoothedAmplitude.current * 0.8 + amplitude * 0.2;

    if (isSpeaking) {
      // Pulsing animation when speaking
      const scale = 1 + smoothedAmplitude.current * 0.4;
      const opacity = 0.7 + smoothedAmplitude.current * 0.3;

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: scale,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: opacity,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Return to idle state
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [amplitude, isSpeaking]);

  return {
    scaleAnim,
    opacityAnim,
    isModelSpeaking,
  };
};

export default useOrbAnimation;

