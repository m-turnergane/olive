import * as React from "react";
import { Animated, StyleSheet, View, Platform } from "react-native";

const { useEffect, useRef, useState } = React;

// Feature detection for Skia
let SkiaCanvas: any = null;
let SkiaCircle: any = null;
let SkiaGroup: any = null;
let SkiaPaint: any = null;
let SkiaRadialGradient: any = null;
let SkiaVec: any = null;
let SkiaBlurMask: any = null;
let isSkiaAvailable = false;

try {
  const SkiaModule = require("@shopify/react-native-skia");
  SkiaCanvas = SkiaModule.Canvas;
  SkiaCircle = SkiaModule.Circle;
  SkiaGroup = SkiaModule.Group;
  SkiaPaint = SkiaModule.Paint;
  SkiaRadialGradient = SkiaModule.RadialGradient;
  SkiaVec = SkiaModule.vec;
  SkiaBlurMask = SkiaModule.BlurMask;

  // Verify that we can actually create a Skia surface (fails on unsupported devices/simulators)
  const SurfaceFactory = SkiaModule.Skia?.Surface;
  const sanitySurface = SurfaceFactory?.MakeOffscreen?.(1, 1);

  const enableSkiaOnIOS =
    Platform.OS === "ios" && process.env.EXPO_PUBLIC_ENABLE_SKIA_IOS === "1";

  if (sanitySurface && (Platform.OS !== "ios" || enableSkiaOnIOS)) {
    if (typeof sanitySurface.dispose === "function") {
      sanitySurface.dispose();
    } else if (typeof sanitySurface.delete === "function") {
      sanitySurface.delete();
    }
    isSkiaAvailable = true;
  } else {
    console.warn(
      enableSkiaOnIOS
        ? "Skia surface creation failed – falling back to Animated orb"
        : "Skia disabled on iOS (simulator/dev) – using Animated orb"
    );
    isSkiaAvailable = false;
  }
} catch (e) {
  console.log("Skia not available, falling back to Animated API", e);
  isSkiaAvailable = false;
}

interface OliveOrbProps {
  intensity?: number; // 0 to 1, maps to audio RMS
  isUserSpeaking?: boolean;
  isModelSpeaking?: boolean;
  size?: number;
}

// Color scheme
const COLOR_PRIMARY = "#5E8C61"; // Sage
const COLOR_SECONDARY = "#97C09E"; // Mint
const COLOR_HIGHLIGHT = "#BAC7B2"; // Light sage
const COLOR_BLUE = "#A7CAE3"; // Blue for model speaking

// ============================================================================
// SKIA VERSION (for dev builds)
// ============================================================================
const OliveOrbSkia: React.FC<OliveOrbProps> = ({
  intensity = 0,
  isUserSpeaking = false,
  isModelSpeaking = false,
  size = 300,
}) => {
  const smoothIntensity = useRef(0);

  useEffect(() => {
    smoothIntensity.current = smoothIntensity.current * 0.7 + intensity * 0.3;
  }, [intensity]);

  const activeColor = isModelSpeaking ? COLOR_BLUE : COLOR_PRIMARY;
  const centerX = size / 2;
  const centerY = size / 2;
  const baseRadius = size * 0.25;
  const intensityScale = 1 + intensity * 0.5;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <SkiaCanvas style={styles.canvas}>
        {/* Outer glow ring (largest, most subtle) */}
        <SkiaGroup>
          <SkiaCircle
            cx={centerX}
            cy={centerY}
            r={baseRadius * 2.2 * intensityScale}
          >
            <SkiaPaint>
              <SkiaRadialGradient
                c={SkiaVec(centerX, centerY)}
                r={baseRadius * 2.2}
                colors={[`${activeColor}15`, `${activeColor}08`, "transparent"]}
                positions={[0, 0.5, 1]}
              />
              <SkiaBlurMask blur={40} style="normal" />
            </SkiaPaint>
          </SkiaCircle>
        </SkiaGroup>

        {/* Secondary glow ring */}
        <SkiaGroup opacity={isUserSpeaking || isModelSpeaking ? 0.8 : 0.4}>
          <SkiaCircle
            cx={centerX}
            cy={centerY}
            r={baseRadius * 1.8 * intensityScale}
          >
            <SkiaPaint>
              <SkiaRadialGradient
                c={SkiaVec(centerX, centerY)}
                r={baseRadius * 1.8}
                colors={[`${activeColor}30`, `${activeColor}15`, "transparent"]}
                positions={[0, 0.6, 1]}
              />
              <SkiaBlurMask blur={25} style="normal" />
            </SkiaPaint>
          </SkiaCircle>
        </SkiaGroup>

        {/* Primary ring (speaking indicator) */}
        <SkiaGroup opacity={isUserSpeaking || isModelSpeaking ? 0.6 : 0.3}>
          <SkiaCircle
            cx={centerX}
            cy={centerY}
            r={baseRadius * 1.4 * intensityScale}
          >
            <SkiaPaint
              style="stroke"
              strokeWidth={2}
              color={`${activeColor}60`}
            >
              <SkiaBlurMask blur={8} style="normal" />
            </SkiaPaint>
          </SkiaCircle>
        </SkiaGroup>

        {/* Main orb - outer layer */}
        <SkiaGroup>
          <SkiaCircle cx={centerX} cy={centerY} r={baseRadius * intensityScale}>
            <SkiaPaint>
              <SkiaRadialGradient
                c={SkiaVec(centerX, centerY)}
                r={baseRadius}
                colors={[
                  COLOR_HIGHLIGHT,
                  COLOR_SECONDARY,
                  activeColor,
                  `${activeColor}80`,
                ]}
                positions={[0, 0.3, 0.7, 1]}
              />
              <SkiaBlurMask blur={15} style="solid" />
            </SkiaPaint>
          </SkiaCircle>
        </SkiaGroup>

        {/* Main orb - core */}
        <SkiaGroup>
          <SkiaCircle
            cx={centerX}
            cy={centerY}
            r={baseRadius * 0.8 * intensityScale}
          >
            <SkiaPaint>
              <SkiaRadialGradient
                c={SkiaVec(centerX * 0.85, centerY * 0.85)}
                r={baseRadius * 0.8}
                colors={[
                  "#FFFFFF",
                  COLOR_HIGHLIGHT,
                  COLOR_SECONDARY,
                  activeColor,
                ]}
                positions={[0, 0.2, 0.5, 1]}
              />
            </SkiaPaint>
          </SkiaCircle>
        </SkiaGroup>

        {/* Center highlight */}
        <SkiaGroup opacity={0.8}>
          <SkiaCircle
            cx={centerX * 0.9}
            cy={centerY * 0.9}
            r={baseRadius * 0.3}
          >
            <SkiaPaint>
              <SkiaRadialGradient
                c={SkiaVec(centerX * 0.9, centerY * 0.9)}
                r={baseRadius * 0.3}
                colors={["#FFFFFF", "transparent"]}
                positions={[0, 1]}
              />
              <SkiaBlurMask blur={10} style="normal" />
            </SkiaPaint>
          </SkiaCircle>
        </SkiaGroup>

        {/* Active pulse ring (when speaking) */}
        {(isUserSpeaking || isModelSpeaking) && (
          <SkiaGroup opacity={0.5 + intensity * 0.5}>
            <SkiaCircle
              cx={centerX}
              cy={centerY}
              r={baseRadius * 1.2 * intensityScale}
            >
              <SkiaPaint style="stroke" strokeWidth={3} color={activeColor}>
                <SkiaBlurMask blur={12} style="outer" />
              </SkiaPaint>
            </SkiaCircle>
          </SkiaGroup>
        )}
      </SkiaCanvas>
    </View>
  );
};

// ============================================================================
// ANIMATED VERSION (fallback for Expo Go)
// ============================================================================
const OliveOrbAnimated: React.FC<OliveOrbProps> = ({
  intensity = 0,
  isUserSpeaking = false,
  isModelSpeaking = false,
  size = 300,
}) => {
  // Animation values
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

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

  const activeColor = isModelSpeaking ? COLOR_BLUE : COLOR_PRIMARY;

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
    outputRange: [0.3, 0.8],
  });

  const baseSize = size * 0.5;
  const intensityScale = 1 + intensity * 0.3;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer glow rings */}
      <Animated.View
        style={[
          styles.orbRing,
          {
            width: baseSize * 2.5 * intensityScale,
            height: baseSize * 2.5 * intensityScale,
            borderRadius: (baseSize * 2.5 * intensityScale) / 2,
            backgroundColor: `${activeColor}10`,
            opacity: glowIntensity,
            transform: [{ scale: breatheScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orbRing,
          {
            width: baseSize * 2 * intensityScale,
            height: baseSize * 2 * intensityScale,
            borderRadius: (baseSize * 2 * intensityScale) / 2,
            backgroundColor: `${activeColor}20`,
            opacity: glowIntensity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      {/* Main orb */}
      <Animated.View
        style={[
          styles.orbCore,
          {
            width: baseSize * intensityScale,
            height: baseSize * intensityScale,
            borderRadius: (baseSize * intensityScale) / 2,
            backgroundColor: activeColor,
            transform: [{ scale: Animated.multiply(breatheScale, pulseScale) }],
          },
        ]}
      >
        {/* Inner highlight */}
        <View
          style={[
            styles.orbHighlight,
            {
              backgroundColor: COLOR_HIGHLIGHT,
            },
          ]}
        />
      </Animated.View>

      {/* Active pulse ring (when speaking) */}
      {(isUserSpeaking || isModelSpeaking) && (
        <Animated.View
          style={[
            styles.orbRing,
            styles.pulseRing,
            {
              width: baseSize * 1.5 * intensityScale,
              height: baseSize * 1.5 * intensityScale,
              borderRadius: (baseSize * 1.5 * intensityScale) / 2,
              borderColor: activeColor,
              borderWidth: 3,
              opacity: Animated.multiply(
                pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 0.2],
                }),
                glowIntensity
              ),
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      )}
    </View>
  );
};

// ============================================================================
// MAIN EXPORT (with feature detection)
// ============================================================================
const OliveOrb: React.FC<OliveOrbProps> = (props) => {
  const [useSkia, setUseSkia] = useState(isSkiaAvailable);

  useEffect(() => {
    // Double-check Skia availability on mount
    if (isSkiaAvailable && !SkiaCanvas) {
      console.log("Skia detection mismatch, falling back to Animated");
      setUseSkia(false);
    }
  }, []);

  // Use Skia version if available, otherwise fallback to Animated
  return useSkia ? (
    <OliveOrbSkia {...props} />
  ) : (
    <OliveOrbAnimated {...props} />
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  canvas: {
    flex: 1,
  },
  // Animated version styles
  orbRing: {
    position: "absolute",
  },
  orbCore: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLOR_PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  orbHighlight: {
    width: "40%",
    height: "40%",
    borderRadius: 1000,
    opacity: 0.5,
    position: "absolute",
    top: "15%",
    left: "15%",
  },
  pulseRing: {
    borderWidth: 3,
    backgroundColor: "transparent",
  },
});

export default OliveOrb;
