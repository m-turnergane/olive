import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  ActivityIndicator,
  Text,
  Alert,
} from "react-native";
import { supabase } from "./services/supabaseService";
import { User } from "./types";
import LoginScreen from "./components/LoginScreen";
import OnboardingFlow from "./components/OnboardingFlow";
import MainScreen from "./components/MainScreen";
import DisclaimerModal from "./components/DisclaimerModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as supabaseService from "./services/supabaseService";
import { SafeAreaProvider } from "react-native-safe-area-context";

type Screen = "splash" | "login" | "onboarding" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initialize app and check for existing session
    initializeApp();
  }, []);

  useEffect(() => {
    // Fade in animation when screen changes
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [screen]);

  const checkOnboardingAndDisclaimer = async (currentUser: User) => {
    try {
      // Ensure we have a valid session before querying
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        if (__DEV__) {
          console.log("[Onboarding] No session found, showing onboarding");
        }
        setScreen("onboarding");
        return;
      }

      // Use the authenticated user's ID from the session to ensure RLS works
      const authenticatedUserId = session.user.id;

      if (__DEV__) {
        console.log("[Onboarding] Session user ID:", authenticatedUserId);
        console.log("[Onboarding] Passed user ID:", currentUser.id);
      }

      const { data, error } = await supabase
        .from("user_preferences")
        .select("data")
        .eq("user_id", authenticatedUserId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Error checking onboarding status:", error);
      }

      const prefsData = data?.data || {};
      const onboardingCompleted = prefsData.onboardingCompleted === true;

      if (__DEV__) {
        console.log("[Onboarding] Preferences found:", !!data);
        console.log("[Onboarding] Completed flag:", onboardingCompleted);
      }

      if (!onboardingCompleted) {
        setScreen("onboarding");
        return;
      }

      const hasSeenDisclaimer = await AsyncStorage.getItem("hasSeenDisclaimer");
      if (!hasSeenDisclaimer) {
        setShowDisclaimer(true);
        setScreen("main");
      } else {
        setScreen("main");
      }
    } catch (error) {
      console.error("Error checking onboarding/disclaimer:", error);
      // On error, go to main screen (don't block user)
      setScreen("main");
    }
  };

  const initializeApp = async () => {
    try {
      // Check if user has an active session
      const { session } = await supabaseService.getSession();

      if (session) {
        // User is logged in, get user data
        const { user: currentUser } = await supabaseService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
          await checkOnboardingAndDisclaimer(currentUser);
        } else {
          setScreen("login");
        }
      } else {
        // No active session, show login
        setTimeout(() => {
          setScreen("login");
        }, 2000); // Show splash for 2 seconds
      }
    } catch (error) {
      console.error("Error initializing app:", error);
      setTimeout(() => {
        setScreen("login");
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);

    // Small delay to ensure session is fully propagated
    // This helps with timing issues after OAuth completes
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check onboarding/disclaimer
    await checkOnboardingAndDisclaimer(loggedInUser);
  };

  const handleLogout = async () => {
    try {
      await supabaseService.signOut();
      setUser(null);
      setIsAuthenticated(false);
      await AsyncStorage.clear();
      setScreen("login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleAcceptDisclaimer = async () => {
    try {
      await AsyncStorage.setItem("hasSeenDisclaimer", "true");
      setShowDisclaimer(false);
      setScreen("main");
    } catch (error) {
      console.error("Error saving disclaimer state:", error);
      setShowDisclaimer(false);
      setScreen("main");
    }
  };

  const handleOnboardingComplete = async () => {
    const hasSeenDisclaimer = await AsyncStorage.getItem("hasSeenDisclaimer");
    if (!hasSeenDisclaimer) {
      setShowDisclaimer(true);
      setScreen("main");
    } else {
      setScreen("main");
    }
  };

  const handleOnboardingSkip = async () => {
    try {
      if (user) {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        const existingData = data?.data || {};

        const { error: upsertError } = await supabase
          .from("user_preferences")
          .upsert({
            user_id: user.id,
            data: {
              ...existingData,
              onboardingCompleted: true,
            },
            updated_at: new Date().toISOString(),
          });

        if (upsertError) {
          throw upsertError;
        }
      }
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      Alert.alert("Unable to skip", "Something went wrong. Please try again.");
      return;
    }

    handleOnboardingComplete();
  };

  const renderScreen = () => {
    switch (screen) {
      case "splash":
        return (
          <Animated.View
            style={[styles.splashContainer, { opacity: fadeAnim }]}
          >
            <Text style={styles.splashText}>Olive</Text>
            {isLoading && (
              <ActivityIndicator
                size="large"
                color="#1B3A2F"
                style={styles.loader}
              />
            )}
          </Animated.View>
        );
      case "login":
        return (
          <Animated.View
            style={[styles.screenContainer, { opacity: fadeAnim }]}
          >
            <LoginScreen onLogin={handleLogin} />
          </Animated.View>
        );
      case "onboarding":
        if (!user) {
          return (
            <Animated.View
              style={[styles.screenContainer, { opacity: fadeAnim }]}
            >
              <LoginScreen onLogin={handleLogin} />
            </Animated.View>
          );
        }
        return (
          <Animated.View
            style={[styles.screenContainer, { opacity: fadeAnim }]}
          >
            <OnboardingFlow
              user={user}
              onComplete={handleOnboardingComplete}
              onSkip={handleOnboardingSkip}
            />
          </Animated.View>
        );
      case "main":
        if (!user) {
          return (
            <Animated.View
              style={[styles.screenContainer, { opacity: fadeAnim }]}
            >
              <LoginScreen onLogin={handleLogin} />
            </Animated.View>
          );
        }
        return (
          <Animated.View
            style={[styles.screenContainer, { opacity: fadeAnim }]}
          >
            <MainScreen user={user} onLogout={handleLogout} />
          </Animated.View>
        );
      default:
        return (
          <Animated.View
            style={[styles.screenContainer, { opacity: fadeAnim }]}
          >
            <LoginScreen onLogin={handleLogin} />
          </Animated.View>
        );
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />
        {renderScreen()}
        <DisclaimerModal
          isOpen={showDisclaimer}
          onAccept={handleAcceptDisclaimer}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#BAC7B2",
    justifyContent: "center",
    alignItems: "center",
  },
  splashText: {
    fontSize: 48,
    fontWeight: "bold",
    letterSpacing: 8,
    color: "#1B3A2F",
  },
  loader: {
    marginTop: 32,
  },
});
