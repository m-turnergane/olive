import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types";
import HamburgerIcon from "./icons/HamburgerIcon";
import BackArrowIcon from "./icons/BackArrowIcon";
import SideMenu from "./SideMenu";
import VoiceView from "./VoiceView";
import ChatView from "./ChatView";
import ProfilePage from "./ProfilePage";
import SettingsPage from "./SettingsPage";

interface MainScreenProps {
  user: User;
  onLogout: () => void;
}

type Page = "main" | "profile" | "settings";
type Mode = "voice" | "chat";

const MainScreen: React.FC<MainScreenProps> = ({ user, onLogout }) => {
  const [currentMode, setCurrentMode] = useState<Mode>("voice");
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>("main");
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [chatViewKey, setChatViewKey] = useState(1);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in animation when page or mode changes
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [currentPage, currentMode, chatViewKey]);

  const handleNewChat = () => {
    setSelectedConversationId(null); // Clear selection for new chat
    setChatViewKey((prev) => prev + 1);
    setCurrentMode("chat");
    setMenuOpen(false);
  };

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setChatViewKey((prev) => prev + 1);
    setCurrentMode("chat");
    setCurrentPage("main");
    setMenuOpen(false);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "profile":
        return (
          <Animated.View style={[styles.pageContainer, { opacity: fadeAnim }]}>
            <ProfilePage user={user} onLogout={onLogout} />
          </Animated.View>
        );
      case "settings":
        return (
          <Animated.View style={[styles.pageContainer, { opacity: fadeAnim }]}>
            <SettingsPage user={user} />
          </Animated.View>
        );
      case "main":
      default:
        return currentMode === "voice" ? (
          <Animated.View style={[styles.pageContainer, { opacity: fadeAnim }]}>
            <VoiceView
              selectedConversationId={selectedConversationId}
              onConversationCreated={(convId) =>
                setSelectedConversationId(convId)
              }
            />
          </Animated.View>
        ) : (
          <Animated.View style={[styles.pageContainer, { opacity: fadeAnim }]}>
            <ChatView
              key={chatViewKey}
              user={user}
              initialConversationId={selectedConversationId}
            />
          </Animated.View>
        );
    }
  };

  const getHeaderTitle = () => {
    switch (currentPage) {
      case "profile":
        return "Profile";
      case "settings":
        return "Settings";
      default:
        return "";
    }
  };

  return (
    <LinearGradient colors={["#BAC7B2", "#5E8C61"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          {currentPage === "main" ? (
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <HamburgerIcon size={24} color="#1B3A2F" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setCurrentPage("main")}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <BackArrowIcon size={24} color="#1B3A2F" />
            </TouchableOpacity>
          )}

          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>

          {currentPage === "main" && (
            <TouchableOpacity
              onPress={() => setCurrentPage("profile")}
              style={styles.profileButton}
              activeOpacity={0.7}
            >
              {user.photoUrl ? (
                <Image
                  source={{ uri: user.photoUrl }}
                  style={styles.profileImage}
                  defaultSource={require("../assets/icon.png")}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profilePlaceholderText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

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
            setCurrentPage("profile");
            setMenuOpen(false);
          }}
          onSettingsClick={() => {
            setCurrentPage("settings");
            setMenuOpen(false);
          }}
          onNewChatClick={handleNewChat}
          onConversationSelect={handleConversationSelect}
          onLogout={onLogout}
        />

        {/* Main Content */}
        <View style={styles.content}>{renderCurrentPage()}</View>

        {/* Bottom Navigation */}
        {currentPage === "main" && (
          <View style={styles.bottomNav}>
            <View style={styles.bottomNavContent}>
              <TouchableOpacity
                onPress={() => setCurrentMode("voice")}
                style={styles.navButton}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    currentMode === "voice" && styles.navButtonTextActive,
                  ]}
                >
                  Voice
                </Text>
                {currentMode === "voice" && (
                  <View style={styles.navIndicator} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCurrentMode("chat")}
                style={styles.navButton}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    currentMode === "chat" && styles.navButtonTextActive,
                  ]}
                >
                  Chat
                </Text>
                {currentMode === "chat" && <View style={styles.navIndicator} />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 30,
  },
  headerButton: {
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1B3A2F",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: -1,
  },
  profileButton: {
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profilePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#5E8C61",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePlaceholderText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    zIndex: 10,
  },
  pageContainer: {
    flex: 1,
  },
  bottomNav: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    zIndex: 10,
  },
  bottomNavContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 64,
  },
  navButton: {
    position: "relative",
    paddingVertical: 8,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(27, 58, 47, 0.6)",
  },
  navButtonTextActive: {
    color: "#1B3A2F",
  },
  navIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#1B3A2F",
    borderRadius: 1,
  },
});

export default MainScreen;
