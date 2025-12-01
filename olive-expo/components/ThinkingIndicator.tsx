import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Easing,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ThinkingIndicatorProps {
  text: string;
  containerStyle?: StyleProp<ViewStyle>;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const SCREEN_WIDTH = Dimensions.get("window").width;
// Cover a wide area to ensure the shimmer passes through longer text
const MAX_WIDTH = SCREEN_WIDTH * 0.85;

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  text,
  containerStyle,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  // Start pulse at lower opacity
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    shimmerLoop.start();
    pulseLoop.start();

    return () => {
      shimmerLoop.stop();
      pulseLoop.stop();
    };
  }, [shimmer, pulse]);

  // Interpolate over a fixed large width to ensure coverage without layout calcs
  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, MAX_WIDTH + 100],
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Animated.View style={[styles.container, { opacity: pulse }]}>
        <Text style={styles.text}>{text}</Text>
        <AnimatedLinearGradient
          colors={[
            "rgba(255,255,255,0)",
            "rgba(255,255,255,0.8)", // Brighter shimmer
            "rgba(255,255,255,0)",
          ]}
          start={[0, 0.5]}
          end={[1, 0.5]}
          style={[
            styles.shimmer,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
          pointerEvents="none"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: "85%",
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  container: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    position: "relative",
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
    color: "#0C221B",
    fontStyle: "italic",
    opacity: 0.8,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80, // Slightly focused beam
  },
});

export default ThinkingIndicator;
