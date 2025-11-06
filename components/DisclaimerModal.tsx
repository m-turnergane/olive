import React from 'react';
import Modal from './Modal';

interface DisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onAccept }) => {
  return (
    <Modal isOpen={isOpen} onClose={onAccept} title="Welcome to Olive">
      <div className="space-y-4 text-olive-light">
        <p>
          Olive is designed to be a supportive companion for mental wellness, providing evidence-based coping skills.
        </p>
        <p className="font-bold text-olive-mint">
          However, Olive is not a clinician or a replacement for professional medical advice, diagnosis, or treatment. It does not diagnose or prescribe.
        </p>
        <p>
          If you are in crisis or believe you may have a medical emergency, please contact a qualified healthcare provider or your local emergency services immediately.
        </p>
        <button
          onClick={onAccept}
          className="w-full mt-4 bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300"
        >
          I Understand & Acknowledge
        </button>
      </div>
    </Modal>
  );
};

export default DisclaimerModal;
