import React from 'react';
import { User } from '../types';

interface ProfilePageProps {
  user: User;
  onLogout: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onLogout }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-olive-deep p-4 animate-fade-in">
        <div className="text-center space-y-6 w-full max-w-sm">
            <img src={user.photoUrl} alt="User" className="w-32 h-32 rounded-full border-4 border-white shadow-lg mx-auto" />
            <div className="text-center">
                <h3 className="text-3xl font-bold">{user.name}</h3>
                <p className="text-olive-deep/70">{user.email}</p>
            </div>
            <button
            onClick={onLogout}
            className="w-full mt-8 bg-white/40 border border-red-600/50 hover:bg-red-500 text-red-600 hover:text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-300"
            >
            Log Out
            </button>
        </div>
    </div>
  );
};

export default ProfilePage;
