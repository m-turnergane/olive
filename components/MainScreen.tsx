import React, { useState } from 'react';
import { User } from '../types';
import HamburgerIcon from './icons/HamburgerIcon';
import SideMenu from './SideMenu';
import VoiceView from './VoiceView';
import ChatView from './ChatView';
import BackgroundPattern from './BackgroundPattern';
import ProfilePage from './ProfilePage';
import SettingsPage from './SettingsPage';
import BackArrowIcon from './icons/BackArrowIcon';

interface MainScreenProps {
  user: User;
  onLogout: () => void;
}

const MainScreen: React.FC<MainScreenProps> = ({ user, onLogout }) => {
  const [currentMode, setCurrentMode] = useState<'voice' | 'chat'>('voice');
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'main' | 'profile' | 'settings'>('main');
  const [chatViewKey, setChatViewKey] = useState(1);

  const handleNewChat = () => {
    setChatViewKey(prev => prev + 1);
    setCurrentMode('chat');
    setMenuOpen(false);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'profile':
        return <ProfilePage user={user} onLogout={onLogout} />;
      case 'settings':
        return <SettingsPage />;
      case 'main':
      default:
        return currentMode === 'voice' ? <VoiceView /> : <ChatView key={chatViewKey} user={user} />;
    }
  };

  const getHeaderTitle = () => {
    switch (currentPage) {
        case 'profile': return 'Profile';
        case 'settings': return 'Settings';
        default: return '';
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-olive-pale-sage to-olive-sage text-olive-accent relative animate-fade-in overflow-hidden">
      <BackgroundPattern />
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4">
        {currentPage === 'main' ? (
          <button 
            onClick={() => setMenuOpen(true)} 
            className="text-olive-deep hover:text-olive-accent transition-colors p-2 bg-white/40 backdrop-blur-sm rounded-full shadow-md"
            aria-label="Open menu"
          >
            <HamburgerIcon className="w-6 h-6" />
          </button>
        ) : (
          <button 
            onClick={() => setCurrentPage('main')} 
            className="text-olive-deep hover:text-olive-accent transition-colors p-2 bg-white/40 backdrop-blur-sm rounded-full shadow-md"
            aria-label="Go back"
          >
            <BackArrowIcon className="w-6 h-6" />
          </button>
        )}
        
        <h1 className="text-xl font-bold text-olive-deep absolute left-1/2 -translate-x-1/2">{getHeaderTitle()}</h1>

        {currentPage === 'main' && (
          <button 
            onClick={() => setCurrentPage('profile')}
            className="p-1 bg-white/40 backdrop-blur-sm rounded-full shadow-md"
            aria-label="Open profile"
          >
            <img src={user.photoUrl} alt="Profile" className="w-8 h-8 rounded-full" />
          </button>
        )}
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
          setCurrentPage('profile');
          setMenuOpen(false);
        }}
        onSettingsClick={() => {
          setCurrentPage('settings');
          setMenuOpen(false);
        }}
        onNewChatClick={handleNewChat}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden z-10 pt-16">
        {renderCurrentPage()}
      </main>
      
      {/* Bottom Navigation */}
      {currentPage === 'main' && (
        <footer className="w-full max-w-md mx-auto p-4 z-10">
          <div className="flex justify-center items-center space-x-16">
              <button onClick={() => setCurrentMode('voice')} className={`relative text-lg font-medium transition-colors duration-300 ${currentMode === 'voice' ? 'text-olive-deep' : 'text-olive-deep/60 hover:text-olive-deep'}`}>
                  Voice
                  {currentMode === 'voice' && <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-olive-deep rounded-full animate-fade-in"></div>}
              </button>
              <button onClick={() => setCurrentMode('chat')} className={`relative text-lg font-medium transition-colors duration-300 ${currentMode === 'chat' ? 'text-olive-deep' : 'text-olive-deep/60 hover:text-olive-deep'}`}>
                  Chat
                  {currentMode === 'chat' && <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-olive-deep rounded-full animate-fade-in"></div>}
              </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default MainScreen;