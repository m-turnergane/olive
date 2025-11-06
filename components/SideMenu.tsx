import React from 'react';
import { User } from '../types';
import UserIcon from './icons/UserIcon';
import CogIcon from './icons/CogIcon';
import LogoutIcon from './icons/LogoutIcon';

interface SideMenuProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    currentMode: 'voice' | 'chat';
    onModeChange: (mode: 'voice' | 'chat') => void;
    onProfileClick: () => void;
    onSettingsClick: () => void;
    onNewChatClick: () => void;
    onLogout: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ isOpen, onClose, user, currentMode, onModeChange, onProfileClick, onSettingsClick, onNewChatClick, onLogout }) => {
    const chatHistory = [
        { id: 1, title: "Mindfulness Exercise", time: "Today" },
        { id: 2, title: "Cognitive Reframing", time: "Yesterday" },
        { id: 3, title: "Goal Setting", time: "3 days ago" },
        { id: 4, title: "Gratitude Journal", time: "Last week" },
    ];

    return (
        <>
            <div 
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>
            <div className={`fixed top-0 left-0 h-full w-80 bg-olive-light shadow-lg z-50 transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
                <div className="p-6 flex-shrink-0">
                    <div className="flex items-center space-x-4 mb-8">
                        <img src={user.photoUrl} alt="User" className="w-16 h-16 rounded-full border-2 border-olive-sage" />
                        <div>
                            <h2 className="text-xl font-bold text-olive-deep">{user.name}</h2>
                            <p className="text-sm text-olive-deep/70">{user.email}</p>
                        </div>
                    </div>
                    
                    <button onClick={onNewChatClick} className="w-full text-center bg-olive-sage hover:bg-olive-mint hover:text-olive-accent text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors duration-300 mb-6">
                        + New Chat
                    </button>
                    
                    <div className="flex justify-around bg-olive-deep/5 rounded-xl p-1 mb-8">
                        <button onClick={() => onModeChange('voice')} className={`w-1/2 py-2 rounded-lg font-semibold transition-colors ${currentMode === 'voice' ? 'bg-olive-sage text-white shadow' : 'text-olive-deep/70 hover:bg-white/50'}`}>
                            Voice
                        </button>
                        <button onClick={() => onModeChange('chat')} className={`w-1/2 py-2 rounded-lg font-semibold transition-colors ${currentMode === 'chat' ? 'bg-olive-sage text-white shadow' : 'text-olive-deep/70 hover:bg-white/50'}`}>
                            Chat
                        </button>
                    </div>

                    <h3 className="text-xl font-semibold text-olive-deep mb-4">Chat History</h3>
                </div>

                <div className="flex-1 overflow-y-auto px-6">
                    <div className="flex flex-col space-y-2">
                        {chatHistory.map((item) => (
                            <a key={item.id} href="#" onClick={onClose} className="p-3 rounded-lg text-olive-deep/80 hover:bg-olive-pale-sage/50 hover:text-olive-deep transition-colors">
                                <p className="font-medium truncate">{item.title}</p>
                                <p className="text-xs text-olive-deep/50">{item.time}</p>
                            </a>
                        ))}
                    </div>
                </div>

                <div className="p-6 mt-auto flex-shrink-0 border-t border-olive-sage/20">
                     <nav className="flex flex-col space-y-1">
                        <button onClick={onProfileClick} className="flex items-center text-left text-lg text-olive-deep hover:text-olive-accent p-3 rounded-lg hover:bg-olive-pale-sage/50 transition-colors">
                            <UserIcon className="w-5 h-5 mr-4"/>
                            Profile
                        </button>
                        <button onClick={onSettingsClick} className="flex items-center text-left text-lg text-olive-deep hover:text-olive-accent p-3 rounded-lg hover:bg-olive-pale-sage/50 transition-colors">
                            <CogIcon className="w-5 h-5 mr-4"/>
                            Settings
                        </button>
                        <button onClick={onLogout} className="flex items-center text-left text-lg text-red-600 hover:text-red-500 p-3 rounded-lg hover:bg-red-500/10 transition-colors">
                            <LogoutIcon className="w-5 h-5 mr-4"/>
                            Log Out
                        </button>
                    </nav>
                </div>
            </div>
        </>
    );
};

export default SideMenu;