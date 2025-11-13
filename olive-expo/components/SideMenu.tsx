import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { User } from '../types';
import UserIcon from './icons/UserIcon';
import CogIcon from './icons/CogIcon';
import LogoutIcon from './icons/LogoutIcon';
import { getUserConversations, type Conversation } from '../services/chatService';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  currentMode: 'voice' | 'chat';
  onModeChange: (mode: 'voice' | 'chat') => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onNewChatClick: () => void;
  onConversationSelect: (conversationId: string) => void;
  onLogout: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  onClose,
  user,
  currentMode,
  onModeChange,
  onProfileClick,
  onSettingsClick,
  onNewChatClick,
  onConversationSelect,
  onLogout,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const slideAnim = React.useRef(new Animated.Value(-320)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -320,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  // Load conversations when menu opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setIsLoadingHistory(true);
    try {
      const convos = await getUserConversations(20);
      setConversations(convos);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect(conversationId);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <View style={styles.userInfo}>
              {user.photoUrl && (
                <Image
                  source={{ uri: user.photoUrl }}
                  style={styles.avatar}
                  defaultSource={require('../assets/icon.png')}
                />
              )}
              <View style={styles.userTextContainer}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onNewChatClick}
              style={styles.newChatButton}
              activeOpacity={0.8}
            >
              <Text style={styles.newChatButtonText}>+ New Chat</Text>
            </TouchableOpacity>

            <View style={styles.modeToggle}>
              <TouchableOpacity
                onPress={() => onModeChange('voice')}
                style={[
                  styles.modeButton,
                  currentMode === 'voice' && styles.modeButtonActive,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    currentMode === 'voice' && styles.modeButtonTextActive,
                  ]}
                >
                  Voice
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onModeChange('chat')}
                style={[
                  styles.modeButton,
                  currentMode === 'chat' && styles.modeButtonActive,
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    currentMode === 'chat' && styles.modeButtonTextActive,
                  ]}
                >
                  Chat
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Chat History</Text>
          </View>

          <ScrollView style={styles.historyContainer}>
            {isLoadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#5E8C61" />
                <Text style={styles.loadingText}>Loading conversations...</Text>
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>Start a chat to begin!</Text>
              </View>
            ) : (
              conversations.map((convo) => (
                <TouchableOpacity
                  key={convo.id}
                  onPress={() => handleConversationClick(convo.id)}
                  style={styles.historyItem}
                  activeOpacity={0.7}
                >
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {convo.title || 'Untitled conversation'}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatRelativeTime(convo.updated_at)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onProfileClick}
              style={styles.footerButton}
              activeOpacity={0.7}
            >
              <UserIcon size={20} color="#1B3A2F" />
              <Text style={styles.footerButtonText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSettingsClick}
              style={styles.footerButton}
              activeOpacity={0.7}
            >
              <CogIcon size={20} color="#1B3A2F" />
              <Text style={styles.footerButtonText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onLogout}
              style={styles.footerButton}
              activeOpacity={0.7}
            >
              <LogoutIcon size={20} color="#DC2626" />
              <Text style={[styles.footerButtonText, styles.logoutText]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 320,
    backgroundColor: '#F0F4F1',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    padding: 24,
    paddingTop: 48,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#5E8C61',
    marginRight: 16,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B3A2F',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(27, 58, 47, 0.7)',
  },
  newChatButton: {
    backgroundColor: '#5E8C61',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(27, 58, 47, 0.05)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#5E8C61',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(27, 58, 47, 0.7)',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1B3A2F',
    marginBottom: 16,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  historyItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(27, 58, 47, 0.8)',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 12,
    color: 'rgba(27, 58, 47, 0.5)',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(27, 58, 47, 0.6)',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(27, 58, 47, 0.6)',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(27, 58, 47, 0.4)',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(94, 140, 97, 0.2)',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  footerButtonText: {
    marginLeft: 16,
    fontSize: 18,
    color: '#1B3A2F',
  },
  logoutText: {
    color: '#DC2626',
  },
});

export default SideMenu;

