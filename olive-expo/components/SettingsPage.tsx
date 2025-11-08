import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';

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
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>General</Text>
        <ToggleSwitch label="Enable Notifications" disabled />
        <ToggleSwitch label="Dark Mode" disabled />

        <Text style={[styles.sectionTitle, styles.sectionMargin]}>Account</Text>
        <ToggleSwitch label="Data Sync" disabled />

        <Text style={styles.disclaimer}>
          Settings are not functional in this demo.
        </Text>
      </View>
    </View>
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
});

export default SettingsPage;

