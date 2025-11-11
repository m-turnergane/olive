import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Paint,
  RadialGradient,
  vec,
  BlurMask,
} from '@shopify/react-native-skia';

interface OliveOrbProps {
  intensity?: number; // 0 to 1, maps to audio RMS
  isUserSpeaking?: boolean;
  isModelSpeaking?: boolean;
  size?: number;
}

const OliveOrb: React.FC<OliveOrbProps> = ({
  intensity = 0,
  isUserSpeaking = false,
  isModelSpeaking = false,
  size = 300,
}) => {
  // Animation values
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Smoothed intensity for fluid transitions
  const smoothIntensity = useRef(0);

  useEffect(() => {
    smoothIntensity.current = smoothIntensity.current * 0.7 + intensity * 0.3;
  }, [intensity]);

  // Breathing animation (idle state)
  useEffect(() => {
    if (!isUserSpeaking && !isModelSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      breatheAnim.setValue(0);
    }
  }, [isUserSpeaking, isModelSpeaking]);

  // Pulse animation (speaking state)
  useEffect(() => {
    if (isUserSpeaking || isModelSpeaking) {
      Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        })
      ).start();

      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      pulseAnim.setValue(0);
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [isUserSpeaking, isModelSpeaking]);

  // Color scheme
  const COLOR_PRIMARY = '#5E8C61'; // Sage
  const COLOR_SECONDARY = '#97C09E'; // Mint
  const COLOR_HIGHLIGHT = '#BAC7B2'; // Light sage
  const COLOR_BLUE = '#A7CAE3'; // Blue for model speaking

  const activeColor = isModelSpeaking ? COLOR_BLUE : COLOR_PRIMARY;
  const centerX = size / 2;
  const centerY = size / 2;

  // Dynamic sizing based on intensity and animations
  const breatheScale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const glowIntensity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const baseRadius = size * 0.25;
  const intensityScale = 1 + intensity * 0.5;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={styles.canvas}>
        {/* Outer glow ring (largest, most subtle) */}
        <Group>
          <Circle cx={centerX} cy={centerY} r={baseRadius * 2.2 * intensityScale}>
            <Paint>
              <RadialGradient
                c={vec(centerX, centerY)}
                r={baseRadius * 2.2}
                colors={[
                  `${activeColor}15`,
                  `${activeColor}08`,
                  'transparent',
                ]}
                positions={[0, 0.5, 1]}
              />
              <BlurMask blur={40} style="normal" />
            </Paint>
          </Circle>
        </Group>

        {/* Secondary glow ring */}
        <Group opacity={(isUserSpeaking || isModelSpeaking) ? 0.8 : 0.4}>
          <Circle cx={centerX} cy={centerY} r={baseRadius * 1.8 * intensityScale}>
            <Paint>
              <RadialGradient
                c={vec(centerX, centerY)}
                r={baseRadius * 1.8}
                colors={[
                  `${activeColor}30`,
                  `${activeColor}15`,
                  'transparent',
                ]}
                positions={[0, 0.6, 1]}
              />
              <BlurMask blur={25} style="normal" />
            </Paint>
          </Circle>
        </Group>

        {/* Primary ring (speaking indicator) */}
        <Group opacity={(isUserSpeaking || isModelSpeaking) ? 0.6 : 0.3}>
          <Circle cx={centerX} cy={centerY} r={baseRadius * 1.4 * intensityScale}>
            <Paint style="stroke" strokeWidth={2} color={`${activeColor}60`}>
              <BlurMask blur={8} style="normal" />
            </Paint>
          </Circle>
        </Group>

        {/* Main orb - outer layer */}
        <Group>
          <Circle cx={centerX} cy={centerY} r={baseRadius * intensityScale}>
            <Paint>
              <RadialGradient
                c={vec(centerX, centerY)}
                r={baseRadius}
                colors={[
                  COLOR_HIGHLIGHT,
                  COLOR_SECONDARY,
                  activeColor,
                  `${activeColor}80`,
                ]}
                positions={[0, 0.3, 0.7, 1]}
              />
              <BlurMask blur={15} style="solid" />
            </Paint>
          </Circle>
        </Group>

        {/* Main orb - core */}
        <Group>
          <Circle cx={centerX} cy={centerY} r={baseRadius * 0.8 * intensityScale}>
            <Paint>
              <RadialGradient
                c={vec(centerX * 0.85, centerY * 0.85)}
                r={baseRadius * 0.8}
                colors={[
                  '#FFFFFF',
                  COLOR_HIGHLIGHT,
                  COLOR_SECONDARY,
                  activeColor,
                ]}
                positions={[0, 0.2, 0.5, 1]}
              />
            </Paint>
          </Circle>
        </Group>

        {/* Center highlight */}
        <Group opacity={0.8}>
          <Circle cx={centerX * 0.9} cy={centerY * 0.9} r={baseRadius * 0.3}>
            <Paint>
              <RadialGradient
                c={vec(centerX * 0.9, centerY * 0.9)}
                r={baseRadius * 0.3}
                colors={['#FFFFFF', 'transparent']}
                positions={[0, 1]}
              />
              <BlurMask blur={10} style="normal" />
            </Paint>
          </Circle>
        </Group>

        {/* Active pulse ring (when speaking) */}
        {(isUserSpeaking || isModelSpeaking) && (
          <Group opacity={0.5 + intensity * 0.5}>
            <Circle cx={centerX} cy={centerY} r={baseRadius * 1.2 * intensityScale}>
              <Paint style="stroke" strokeWidth={3} color={activeColor}>
                <BlurMask blur={12} style="outer" />
              </Paint>
            </Circle>
          </Group>
        )}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    flex: 1,
  },
});

export default OliveOrb;

