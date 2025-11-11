import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './components/LoginScreen';
import MainScreen from './components/MainScreen';
import DisclaimerModal from './components/DisclaimerModal';
import { User } from './types';
import * as supabaseService from './services/supabaseService';

type Screen = 'splash' | 'login' | 'main';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
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
          
          // Check if disclaimer has been shown
          const hasSeenDisclaimer = await AsyncStorage.getItem('hasSeenDisclaimer');
          if (!hasSeenDisclaimer) {
            setShowDisclaimer(true);
          } else {
            setScreen('main');
          }
        } else {
          setScreen('login');
        }
      } else {
        // No active session, show login
        setTimeout(() => {
          setScreen('login');
        }, 2000); // Show splash for 2 seconds
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      setTimeout(() => {
        setScreen('login');
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    
    // Check disclaimer
    AsyncStorage.getItem('hasSeenDisclaimer').then((value) => {
      if (!value) {
        setShowDisclaimer(true);
      } else {
        setScreen('main');
      }
    });
  };

  const handleLogout = async () => {
    try {
      await supabaseService.signOut();
      setUser(null);
      setIsAuthenticated(false);
      await AsyncStorage.clear();
      setScreen('login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAcceptDisclaimer = async () => {
    try {
      await AsyncStorage.setItem('hasSeenDisclaimer', 'true');
      setShowDisclaimer(false);
      setScreen('main');
    } catch (error) {
      console.error('Error saving disclaimer state:', error);
      setShowDisclaimer(false);
      setScreen('main');
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return (
          <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
            <Text style={styles.splashText}>Olive</Text>
            {isLoading && <ActivityIndicator size="large" color="#1B3A2F" style={styles.loader} />}
          </Animated.View>
        );
      case 'login':
        return (
          <Animated.View style={[styles.screenContainer, { opacity: fadeAnim }]}>
            <LoginScreen onLogin={handleLogin} />
          </Animated.View>
        );
      case 'main':
        if (!user) {
          return (
            <Animated.View style={[styles.screenContainer, { opacity: fadeAnim }]}>
              <LoginScreen onLogin={handleLogin} />
            </Animated.View>
          );
        }
        return (
          <Animated.View style={[styles.screenContainer, { opacity: fadeAnim }]}>
            <MainScreen user={user} onLogout={handleLogout} />
          </Animated.View>
        );
      default:
        return (
          <Animated.View style={[styles.screenContainer, { opacity: fadeAnim }]}>
            <LoginScreen onLogin={handleLogin} />
          </Animated.View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {renderScreen()}
      <DisclaimerModal isOpen={showDisclaimer} onAccept={handleAcceptDisclaimer} />
    </View>
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
    backgroundColor: '#BAC7B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#1B3A2F',
  },
  loader: {
    marginTop: 32,
  },
});
