import React, { useState } from 'react';
import Modal from './Modal';
import { User } from '../types';
import * as supabaseService from '../services/supabaseService';
import BackgroundPattern from './BackgroundPattern';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setSignupModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await supabaseService.loginWithGoogle();
      onLogin(user);
    } catch (err) {
      setError("Failed to log in. Please try again.");
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      try {
          // In a real app, get email/pass from form state
          const user = await supabaseService.loginWithEmail('test@example.com', 'password');
          onLogin(user);
      } catch (err) {
          setError("Failed to log in. Please try again.");
          setIsLoading(false);
      }
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-screen bg-gradient-to-br from-olive-pale-sage to-olive-sage text-olive-accent p-4 animate-fade-in overflow-hidden">
      <BackgroundPattern />
      <div className="w-full max-w-sm text-center animate-slide-in-up z-10">
        <h2 className="text-2xl font-semibold text-olive-deep mb-8">Your safe space awaits.</h2>
        
        {error && <p className="text-red-600 mb-4">{error}</p>}

        <div className="space-y-4">
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:bg-gray-500">
            {isLoading ? 'Logging in...' : 'Continue with Google'}
          </button>
          <button onClick={() => setLoginModalOpen(true)} disabled={isLoading} className="w-full bg-white/40 border border-olive-sage/50 hover:bg-white/80 text-olive-deep font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105">
            Login with Email
          </button>
        </div>
        
        <p className="mt-8">
          New here?{' '}
          <button onClick={() => setSignupModalOpen(true)} className="font-bold text-olive-deep hover:underline">
            Create an Account
          </button>
        </p>
      </div>

      <p className="absolute bottom-8 text-olive-deep/50 text-lg tracking-widest">Olive</p>

      <Modal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} title="Login">
         <form className="space-y-4" onSubmit={handleEmailLogin}>
            <input type="email" placeholder="Email" className="w-full p-3 bg-white/60 border border-olive-sage/50 rounded-lg text-olive-deep placeholder-olive-deep/60 focus:ring-2 focus:ring-olive-deep focus:outline-none transition" />
            <input type="password" placeholder="Password" className="w-full p-3 bg-white/60 border border-olive-sage/50 rounded-lg text-olive-deep placeholder-olive-deep/60 focus:ring-2 focus:ring-olive-deep focus:outline-none transition" />
            <button type="submit" disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors duration-300 disabled:bg-gray-500">
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>
        </form>
      </Modal>

      {/* Signup Modal */}
      <Modal isOpen={isSignupModalOpen} onClose={() => setSignupModalOpen(false)} title="Create Account">
        <div className="space-y-4">
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors duration-300 disabled:bg-gray-500">
              {isLoading ? '...' : 'Sign up with Google'}
          </button>

          <div className="flex items-center">
              <hr className="flex-grow border-t border-olive-sage/30" />
              <span className="px-3 text-olive-deep/50">OR</span>
              <hr className="flex-grow border-t border-olive-sage/30" />
          </div>

          <form className="space-y-4" onSubmit={handleEmailLogin}>
              <input type="text" placeholder="Name" className="w-full p-3 bg-white/60 border border-olive-sage/50 rounded-lg text-olive-deep placeholder-olive-deep/60 focus:ring-2 focus:ring-olive-deep focus:outline-none transition" />
              <input type="email" placeholder="Email" className="w-full p-3 bg-white/60 border border-olive-sage/50 rounded-lg text-olive-deep placeholder-olive-deep/60 focus:ring-2 focus:ring-olive-deep focus:outline-none transition" />
              <input type="password" placeholder="Password" className="w-full p-3 bg-white/60 border border-olive-sage/50 rounded-lg text-olive-deep placeholder-olive-deep/60 focus:ring-2 focus:ring-olive-deep focus:outline-none transition" />
              <input type="password" placeholder="Confirm Password" className="w-full p-3 bg-white/60 border border-olive-sage/50 rounded-lg text-olive-deep placeholder-olive-deep/60 focus:ring-2 focus:ring-olive-deep focus:outline-none transition" />
              <button type="submit" disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors duration-300 disabled:bg-gray-500">
                {isLoading ? 'Creating...' : 'Create Account'}
              </button>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default LoginScreen;