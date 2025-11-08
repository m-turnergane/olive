import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from './Modal';

interface DisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onAccept }) => {
  return (
    <Modal isOpen={isOpen} onClose={onAccept} title="Welcome to Olive">
      <View style={styles.container}>
        <Text style={styles.subtitle}>Your well-being is our priority.</Text>
        
        <Text style={styles.text}>
          Olive is designed to be a supportive companion for mental wellness, providing
          evidence-based coping skills.
        </Text>
        
        <Text style={[styles.text, styles.boldText]}>
          However, Olive is not a clinician or a replacement for professional medical
          advice, diagnosis, or treatment. It does not diagnose or prescribe.
        </Text>
        
        <Text style={styles.text}>
          If you are in crisis or believe you may have a medical emergency, please
          contact a qualified healthcare provider or your local emergency services
          immediately.
        </Text>
        
        <TouchableOpacity
          onPress={onAccept}
          style={styles.button}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>I Understand & Acknowledge</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#A7CAE3',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1B3A2F',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#5E8C61',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#5E8C61',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default DisclaimerModal;

