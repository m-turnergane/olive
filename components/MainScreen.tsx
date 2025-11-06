import React, { useState } from 'react';
import { User } from '../types';
import HamburgerIcon from './icons/HamburgerIcon';
import SideMenu from './SideMenu';
import VoiceView from './VoiceView';
import ChatView from './ChatView';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';

interface MainScreenProps {
  user: User;
  onLogout: () => void;
}

const MainScreen: React.FC<MainScreenProps> = ({ user, onLogout }) => {
  const [currentMode, setCurrentMode] = useState<'voice' | 'chat'>('voice');
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [chatViewKey, setChatViewKey] = useState(1);

  const handleNewChat = () => {
    // By changing the key, we force the ChatView component to remount, resetting its state.
    setChatViewKey(prev => prev + 1);
    setCurrentMode('chat');
    setMenuOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-olive-deep text-olive-light relative animate-fade-in">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4">
        <button 
          onClick={() => setMenuOpen(true)} 
          className="text-olive-mint hover:text-white transition-colors p-2 bg-olive-accent/50 rounded-full"
          aria-label="Open menu"
        >
          <HamburgerIcon className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setProfileModalOpen(true)}
          className="p-1 bg-olive-accent/50 rounded-full"
          aria-label="Open profile"
        >
          <img src={user.photoUrl} alt="Profile" className="w-8 h-8 rounded-full" />
        </button>
      </header>

      <SideMenu 
        isOpen={isMenuOpen} 
        onClose={() => setMenuOpen(false)}
        user={user}
        currentMode={currentMode}
        onModeChange={(mode) => {
          setCurrentMode(mode);
          setMenuOpen(false);
        }}
        onProfileClick={() => {
          setProfileModalOpen(true);
          setMenuOpen(false);
        }}
        onSettingsClick={() => {
          setSettingsModalOpen(true);
          setMenuOpen(false);
        }}
        onNewChatClick={handleNewChat}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {currentMode === 'voice' ? <VoiceView /> : <ChatView key={chatViewKey} />}
      </main>
      
      {/* Bottom Navigation */}
      <footer className="w-full max-w-md mx-auto p-4">
        <div className="flex justify-center items-center space-x-16">
            <button onClick={() => setCurrentMode('voice')} className={`relative text-lg font-medium transition-colors duration-300 ${currentMode === 'voice' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                Voice
                {currentMode === 'voice' && <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-olive-mint rounded-full animate-fade-in"></div>}
            </button>
            <button onClick={() => setCurrentMode('chat')} className={`relative text-lg font-medium transition-colors duration-300 ${currentMode === 'chat' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                Chat
                {currentMode === 'chat' && <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-olive-mint rounded-full animate-fade-in"></div>}
            </button>
        </div>
      </footer>
      
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onLogout={onLogout}
      />
      
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
};

export default MainScreen;