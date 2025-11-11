import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as supabaseService from '../services/supabaseService';

interface ToggleSwitchProps {
  label: string;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, disabled = false }) => {
  const [isEnabled, setIsEnabled] = React.useState(false);

  return (
    <View style={[styles.toggleContainer, disabled && styles.toggleDisabled]}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={isEnabled}
        onValueChange={setIsEnabled}
        disabled={disabled}
        trackColor={{ false: 'rgba(27, 58, 47, 0.2)', true: '#5E8C61' }}
        thumbColor={isEnabled ? '#FFFFFF' : '#F0F4F1'}
      />
    </View>
  );
};

const SettingsPage: React.FC = () => {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);

  useEffect(() => {
    checkPasswordAuth();
  }, []);

  const checkPasswordAuth = async () => {
    try {
      const hasAuth = await supabaseService.hasPasswordAuth();
      setHasPassword(hasAuth);
    } catch (err) {
      if (__DEV__) {
        console.error('Error checking password auth:', err);
      }
    }
  };

  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabaseService.setPassword(password);
      if (error) {
        Alert.alert('Error', error.message || 'Failed to set password.');
      } else {
        Alert.alert('Success', 'Password has been set successfully.');
        setPassword('');
        setConfirmPassword('');
        setIsPasswordSectionOpen(false);
        await checkPasswordAuth();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabaseService.updatePassword(password);
      if (error) {
        Alert.alert('Error', error.message || 'Failed to update password.');
      } else {
        Alert.alert('Success', 'Password has been updated successfully.');
        setPassword('');
        setConfirmPassword('');
        setIsPasswordSectionOpen(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>General</Text>
        <ToggleSwitch label="Enable Notifications" disabled />
        <ToggleSwitch label="Dark Mode" disabled />

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>Account</Text>
        <ToggleSwitch label="Data Sync" disabled />

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>Security</Text>
        
        {hasPassword === null ? (
          <View style={styles.passwordContainer}>
            <ActivityIndicator size="small" color="#5E8C61" />
            <Text style={styles.passwordStatusText}>Checking authentication method...</Text>
          </View>
        ) : (
          <View style={styles.passwordContainer}>
            <View style={styles.passwordInfo}>
              <Text style={styles.passwordStatusText}>
                {hasPassword
                  ? 'Password authentication is enabled'
                  : 'No password set. Add a password to sign in with email and password.'}
              </Text>
            </View>

            {!isPasswordSectionOpen ? (
              <TouchableOpacity
                style={styles.passwordButton}
                onPress={() => setIsPasswordSectionOpen(true)}
              >
                <Text style={styles.passwordButtonText}>
                  {hasPassword ? 'Change Password' : 'Set Password'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.passwordForm}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={hasPassword ? 'New Password' : 'Password'}
                  placeholderTextColor="rgba(27, 58, 47, 0.5)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="rgba(27, 58, 47, 0.5)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <View style={styles.passwordButtonRow}>
                  <TouchableOpacity
                    style={[styles.passwordButton, styles.passwordButtonCancel]}
                    onPress={() => {
                      setIsPasswordSectionOpen(false);
                      setPassword('');
                      setConfirmPassword('');
                    }}
                    disabled={isLoading}
                  >
                    <Text style={styles.passwordButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.passwordButton}
                    onPress={hasPassword ? handleUpdatePassword : handleSetPassword}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.passwordButtonText}>
                        {hasPassword ? 'Update' : 'Set Password'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    width: '100%',
    maxWidth: 768,
    marginHorizontal: 'auto',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(27, 58, 47, 0.8)',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  sectionMargin: {
    marginTop: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleDisabled: {
    opacity: 0.6,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1B3A2F',
  },
  disclaimer: {
    fontSize: 14,
    color: 'rgba(27, 58, 47, 0.6)',
    textAlign: 'center',
    marginTop: 32,
  },
  passwordContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  passwordInfo: {
    marginBottom: 12,
  },
  passwordStatusText: {
    fontSize: 14,
    color: '#1B3A2F',
    lineHeight: 20,
  },
  passwordButton: {
    backgroundColor: '#5E8C61',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  passwordButtonCancel: {
    backgroundColor: 'rgba(27, 58, 47, 0.3)',
    marginRight: 12,
    flex: 1,
  },
  passwordButtonRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  passwordButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordForm: {
    marginTop: 8,
  },
  passwordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#1B3A2F',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(27, 58, 47, 0.2)',
  },
});

export default SettingsPage;

