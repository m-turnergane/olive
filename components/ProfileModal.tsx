import React from 'react';
import Modal from './Modal';
import { User } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLogout: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onLogout }) => {

  const handleLogout = () => {
    onClose(); // Close the modal first
    onLogout();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile">
      <div className="space-y-6 text-olive-light flex flex-col items-center">
        <img src={user.photoUrl} alt="User" className="w-24 h-24 rounded-full border-4 border-olive-sage" />
        <div className="text-center">
            <h3 className="text-2xl font-bold">{user.name}</h3>
            <p className="text-gray-400">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-4 bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300"
        >
          Log Out
        </button>
      </div>
    </Modal>
  );
};

export default ProfileModal;