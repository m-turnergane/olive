import React, { useState } from 'react';
import Modal from './Modal';
import { User } from '../types';
import * as supabaseService from '../services/supabaseService';

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
    <div className="flex flex-col items-center justify-center h-screen bg-olive-deep text-olive-light p-4 animate-fade-in">
      <div className="w-full max-w-sm text-center animate-slide-in-up">
        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="space-y-4">
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500">
            {isLoading ? 'Logging in...' : 'Continue with Google'}
          </button>
          <button onClick={() => setLoginModalOpen(true)} disabled={isLoading} className="w-full bg-transparent border border-olive-sage hover:bg-olive-sage text-olive-light font-bold py-3 px-4 rounded-lg transition-colors duration-300">
            Login with Email
          </button>
        </div>
        
        <p className="mt-8">
          New here?{' '}
          <button onClick={() => setSignupModalOpen(true)} className="font-bold text-olive-mint hover:underline">
            Create an Account
          </button>
        </p>
      </div>

      <p className="absolute bottom-8 text-olive-sage/50 text-lg tracking-widest">Olive</p>

      <Modal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} title="Login">
         <form className="space-y-4" onSubmit={handleEmailLogin}>
            <input type="email" placeholder="Email" className="w-full p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none" />
            <input type="password" placeholder="Password" className="w-full p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none" />
            <button type="submit" disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500">
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>
        </form>
      </Modal>

      {/* Signup Modal */}
      <Modal isOpen={isSignupModalOpen} onClose={() => setSignupModalOpen(false)} title="Create Account">
        <div className="space-y-4">
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500">
              {isLoading ? '...' : 'Sign up with Google'}
          </button>

          <div className="flex items-center">
              <hr className="flex-grow border-t border-olive-sage/50" />
              <span className="px-3 text-gray-400">OR</span>
              <hr className="flex-grow border-t border-olive-sage/50" />
          </div>

          <form className="space-y-4" onSubmit={handleEmailLogin}>
              <input type="text" placeholder="Name" className="w-full p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none" />
              <input type="email" placeholder="Email" className="w-full p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none" />
              <input type="password" placeholder="Password" className="w-full p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none" />
              <input type="password" placeholder="Confirm Password" className="w-full p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none" />
              <button type="submit" disabled={isLoading} className="w-full bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-500">
                {isLoading ? 'Creating...' : 'Create Account'}
              </button>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default LoginScreen;