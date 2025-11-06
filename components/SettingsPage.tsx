import React from 'react';

// A simple toggle switch component for UI demonstration
const ToggleSwitch = ({ label, disabled = false }: { label: string; disabled?: boolean }) => (
  <div className={`flex items-center justify-between p-4 bg-white/40 rounded-xl shadow transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
    <span className="font-medium text-olive-deep">{label}</span>
    <div className="relative inline-block w-12 h-6">
      <input type="checkbox" className="absolute w-0 h-0 opacity-0" disabled={disabled} />
      <span className="block w-full h-full bg-olive-deep/20 rounded-full"></span>
      <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform"></span>
    </div>
  </div>
);


const SettingsPage: React.FC = () => {
  return (
    <div className="h-full w-full max-w-2xl mx-auto p-4 animate-fade-in">
        <div className="space-y-4 text-olive-light">
            <h2 className="text-xl font-semibold text-olive-deep/80 mb-2 px-2">General</h2>
            <ToggleSwitch label="Enable Notifications" disabled />
            <ToggleSwitch label="Dark Mode" disabled />

            <h2 className="text-xl font-semibold text-olive-deep/80 mb-2 px-2 pt-6">Account</h2>
            <ToggleSwitch label="Data Sync" disabled />
            
            <p className="text-sm text-olive-deep/60 text-center pt-8">Settings are not functional in this demo.</p>
        </div>
    </div>
  );
};

export default SettingsPage;
