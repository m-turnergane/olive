import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import MainScreen from './components/MainScreen';
import DisclaimerModal from './components/DisclaimerModal';
import { User } from './types';

type Screen = 'splash' | 'login' | 'main';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('splash');
  const [isSplashFading, setIsSplashFading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  
  useEffect(() => {
    // Splash -> Login
    const splashTimer = setTimeout(() => {
      setIsSplashFading(true);
      setTimeout(() => setScreen('login'), 500); // Wait for fade out
    }, 2000); // Splash screen duration

    return () => clearTimeout(splashTimer);
  }, []);


  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    
    const hasSeenDisclaimer = localStorage.getItem('hasSeenDisclaimer');
    if (!hasSeenDisclaimer) {
      setShowDisclaimer(true);
    } else {
      setScreen('main');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.clear();
    setScreen('login');
  };
  
  const handleAcceptDisclaimer = () => {
    localStorage.setItem('hasSeenDisclaimer', 'true');
    setShowDisclaimer(false);
    setScreen('main');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return (
          <div className={`flex flex-col items-center justify-center h-screen bg-gradient-to-br from-olive-pale-sage to-olive-sage transition-opacity duration-500 ${isSplashFading ? 'opacity-0' : 'opacity-100'}`}>
            <h1 className="text-5xl font-bold tracking-wider text-olive-deep">Olive</h1>
          </div>
        );
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'main':
        if (!user) return <LoginScreen onLogin={handleLogin} />; // Safeguard
        return <MainScreen user={user} onLogout={handleLogout} />;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <div className="font-sans antialiased">
      {renderScreen()}
      <DisclaimerModal isOpen={showDisclaimer} onAccept={handleAcceptDisclaimer} />
    </div>
  );
};

export default App;