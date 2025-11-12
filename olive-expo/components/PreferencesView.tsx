// olive-expo/components/PreferencesView.tsx
// Component for managing user preferences (nickname, pronouns, tone)

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../services/supabaseService";
import { User } from "../types";

interface PreferencesViewProps {
  user: User;
}

interface UserPreferencesData {
  nickname?: string;
  pronouns?: string;
  tone?: "casual" | "professional" | "supportive";
}

const PreferencesView: React.FC<PreferencesViewProps> = ({ user }) => {
  const [preferences, setPreferences] = useState<UserPreferencesData>({
    nickname: "",
    pronouns: "",
    tone: "supportive",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("user_preferences")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading preferences:", error);
        return;
      }

      if (data?.data) {
        setPreferences({
          nickname: data.data.nickname || "",
          pronouns: data.data.pronouns || "",
          tone: data.data.tone || "supportive",
        });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setIsSaving(true);

      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        data: preferences,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving preferences:", error);
        Alert.alert("Error", "Failed to save preferences. Please try again.");
        return;
      }

      Alert.alert("Success", "Your preferences have been saved!");
    } catch (error) {
      console.error("Failed to save preferences:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E8C61" />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Chat Preferences</Text>
      <Text style={styles.subtitle}>
        Help Olive personalize your experience
      </Text>

      {/* Nickname */}
      <View style={styles.section}>
        <Text style={styles.label}>Nickname (optional)</Text>
        <Text style={styles.helper}>
          What would you like Olive to call you?
        </Text>
        <TextInput
          style={styles.input}
          value={preferences.nickname}
          onChangeText={(text) =>
            setPreferences({ ...preferences, nickname: text })
          }
          placeholder={user.name.split(" ")[0]}
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={50}
        />
      </View>

      {/* Pronouns */}
      <View style={styles.section}>
        <Text style={styles.label}>Pronouns (optional)</Text>
        <Text style={styles.helper}>e.g., she/her, he/him, they/them</Text>
        <TextInput
          style={styles.input}
          value={preferences.pronouns}
          onChangeText={(text) =>
            setPreferences({ ...preferences, pronouns: text })
          }
          placeholder="they/them"
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={30}
        />
      </View>

      {/* Tone */}
      <View style={styles.section}>
        <Text style={styles.label}>Conversation Tone</Text>
        <Text style={styles.helper}>
          How should Olive communicate with you?
        </Text>

        <View style={styles.toneOptions}>
          <TouchableOpacity
            style={[
              styles.toneButton,
              preferences.tone === "casual" && styles.toneButtonActive,
            ]}
            onPress={() => setPreferences({ ...preferences, tone: "casual" })}
          >
            <Text
              style={[
                styles.toneButtonText,
                preferences.tone === "casual" && styles.toneButtonTextActive,
              ]}
            >
              Casual
            </Text>
            <Text style={styles.toneDescription}>Friendly & relaxed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toneButton,
              preferences.tone === "supportive" && styles.toneButtonActive,
            ]}
            onPress={() =>
              setPreferences({ ...preferences, tone: "supportive" })
            }
          >
            <Text
              style={[
                styles.toneButtonText,
                preferences.tone === "supportive" &&
                  styles.toneButtonTextActive,
              ]}
            >
              Supportive
            </Text>
            <Text style={styles.toneDescription}>Warm & empathetic</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toneButton,
              preferences.tone === "professional" && styles.toneButtonActive,
            ]}
            onPress={() =>
              setPreferences({ ...preferences, tone: "professional" })
            }
          >
            <Text
              style={[
                styles.toneButtonText,
                preferences.tone === "professional" &&
                  styles.toneButtonTextActive,
              ]}
            >
              Professional
            </Text>
            <Text style={styles.toneDescription}>Direct & clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 These preferences help Olive provide a more personalized and
          comfortable experience. Your preferences are private and only used to
          enhance our conversations.
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={savePreferences}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "rgba(27, 58, 47, 0.7)",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#1B3A2F",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(27, 58, 47, 0.7)",
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 18,
    fontWeight: "500",
    color: "#1B3A2F",
    marginBottom: 4,
  },
  helper: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.6)",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.3)",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1B3A2F",
  },
  toneOptions: {
    gap: 12,
  },
  toneButton: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 2,
    borderColor: "rgba(94, 140, 97, 0.3)",
    borderRadius: 12,
    padding: 16,
  },
  toneButtonActive: {
    backgroundColor: "#5E8C61",
    borderColor: "#5E8C61",
  },
  toneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1B3A2F",
    marginBottom: 4,
  },
  toneButtonTextActive: {
    color: "#FFFFFF",
  },
  toneDescription: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.6)",
  },
  infoBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: "#2E7D32",
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: "#5E8C61",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default PreferencesView;
