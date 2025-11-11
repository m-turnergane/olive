import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Modal from './Modal';
import { User } from '../types';
import * as supabaseService from '../services/supabaseService';
import { signInWithGoogle } from '../lib/googleOAuth';
import { supabase } from '../lib/supabase';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the new PKCE OAuth flow
      const session = await signInWithGoogle();
      
      if (!session?.user) {
        setError('No user data returned from Google.');
        return;
      }

      // Fetch or create user record in database
      const authUser = session.user;
      
      // Try to fetch existing user
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      // If user doesn't exist, create them using RPC
      if (fetchError && fetchError.code === 'PGRST116') {
        const name =
          authUser.user_metadata?.name ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0] ||
          'User';
        const photoUrl =
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          `https://api.dicebear.com/7.x/initials/png?seed=${authUser.email}`;

        const profileData = await supabaseService.ensureUserProfile({
          email: authUser.email!,
          name,
          photoUrl,
        });

        const user: User = {
          id: authUser.id,
          email: authUser.email!,
          name: profileData?.name || name,
          photoUrl: profileData?.photo_url || photoUrl,
        };

        onLogin(user);
      } else if (userData) {
        // User exists, return it
        const user: User = {
          id: authUser.id,
          email: authUser.email!,
          name: userData.name || 'User',
          photoUrl:
            userData.photo_url ||
            `https://api.dicebear.com/7.x/initials/png?seed=${userData.name}`,
          created_at: userData.created_at,
          updated_at: userData.updated_at,
        };

        onLogin(user);
      } else {
        setError('Failed to create or fetch user data.');
      }
    } catch (err: any) {
      // Check if this is a cancellation - don't show error to user
      const errorMessage = err?.message || String(err);
      if (errorMessage === 'OAuth_CANCELLED' || errorMessage.includes('cancel')) {
        // User cancelled - this is benign, just return silently
        if (__DEV__) {
          console.log('OAuth flow cancelled by user');
        }
        return;
      }

      // Log other errors in dev only
      if (__DEV__) {
        console.error('Google sign-in error:', err);
      }
      setError(err?.message || 'Failed to log in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { user, error: authError } = await supabaseService.signInWithEmail(email, password);
      if (authError) {
        setError(authError.message || 'Failed to log in.');
      } else if (user) {
        onLogin(user);
        setLoginModalOpen(false);
      }
    } catch (err) {
      setError('Failed to log in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { user, error: authError } = await supabaseService.signUpWithEmail(
        email,
        password,
        name
      );
      if (authError) {
        setError(authError.message || 'Failed to create account.');
      } else if (user) {
        onLogin(user);
        setSignupModalOpen(false);
      }
    } catch (err) {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setError(null);
  };

  return (
    <LinearGradient
      colors={['#BAC7B2', '#5E8C61']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.welcomeText}>Your safe space awaits.</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={isLoading}
              style={[styles.button, styles.googleButton, isLoading && styles.buttonDisabled]}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                resetForm();
                setLoginModalOpen(true);
              }}
              disabled={isLoading}
              style={[styles.button, styles.emailButton]}
              activeOpacity={0.8}
            >
              <Text style={styles.emailButtonText}>Login with Email</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>New here? </Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setSignupModalOpen(true);
              }}
            >
              <Text style={styles.signupLink}>Create an Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.brandText}>Olive</Text>
      </KeyboardAvoidingView>

      {/* Login Modal */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          resetForm();
        }}
        title="Login"
      >
        <ScrollView style={styles.modalContent}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#1B3A2F99"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#1B3A2F99"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          
          <TouchableOpacity
            onPress={handleEmailLogin}
            disabled={isLoading}
            style={[styles.button, styles.googleButton, isLoading && styles.buttonDisabled]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Signup Modal */}
      <Modal
        isOpen={isSignupModalOpen}
        onClose={() => {
          setSignupModalOpen(false);
          resetForm();
        }}
        title="Create Account"
      >
        <ScrollView style={styles.modalContent}>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={isLoading}
            style={[styles.button, styles.googleButton, isLoading && styles.buttonDisabled]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign up with Google</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#1B3A2F99"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#1B3A2F99"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#1B3A2F99"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#1B3A2F99"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          
          <TouchableOpacity
            onPress={handleEmailSignup}
            disabled={isLoading}
            style={[styles.button, styles.googleButton, isLoading && styles.buttonDisabled]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 384,
    zIndex: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1B3A2F',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  googleButton: {
    backgroundColor: '#5E8C61',
  },
  emailButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(94, 140, 97, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emailButtonText: {
    color: '#1B3A2F',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signupText: {
    color: '#1B3A2F',
  },
  signupLink: {
    color: '#1B3A2F',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  brandText: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    fontSize: 18,
    letterSpacing: 8,
    color: 'rgba(27, 58, 47, 0.5)',
  },
  modalContent: {
    gap: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(94, 140, 97, 0.5)',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1B3A2F',
    marginBottom: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(94, 140, 97, 0.3)',
  },
  dividerText: {
    marginHorizontal: 12,
    color: 'rgba(27, 58, 47, 0.5)',
  },
});

export default LoginScreen;

