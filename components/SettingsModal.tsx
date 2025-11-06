import React from 'react';
import Modal from './Modal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // A simple toggle switch component for UI demonstration
  const ToggleSwitch = ({ label, disabled = false }: { label: string; disabled?: boolean }) => (
    <div className={`flex items-center justify-between p-3 rounded-xl ${disabled ? 'opacity-50' : ''}`}>
      <span className="font-medium">{label}</span>
      <div className="relative inline-block w-12 h-6">
        <input type="checkbox" className="absolute w-0 h-0 opacity-0" disabled={disabled} />
        <span className="block w-full h-full bg-olive-accent rounded-full"></span>
        <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-4 text-olive-light">
        <ToggleSwitch label="Enable Notifications" disabled />
        <ToggleSwitch label="Dark Mode" disabled />
        <ToggleSwitch label="Data Sync" disabled />
        <p className="text-sm text-gray-500 text-center pt-2">Settings are not functional in this demo.</p>
      </div>
    </Modal>
  );
};

export default SettingsModal;