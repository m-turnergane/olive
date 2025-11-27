// olive-expo/components/PreferencesView.tsx
// Component for managing user preferences

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

type Tone = "casual" | "professional" | "supportive";
type ToneMode = "calm" | "motivational" | "grounding";
type AgeRange = "18-24" | "25-34" | "35-49" | "50+";

interface UserPreferencesData {
  nickname?: string;
  pronouns?: string;
  tone?: Tone;
  tone_mode?: ToneMode;
  voice_gender?: "male" | "female";
  location?: {
    city?: string;
    lat?: number;
    lng?: number;
  };
  search_radius_km?: number;
  age_range?: AgeRange;
  language?: string;
  culture_note?: string;
  companion_name?: string;
  primaryConcerns?: string[];
  preferredTechniques?: string[];
  opt_out_topics?: string[];
  triggerWords?: string[];
}

const toneOptions: { key: Tone; title: string; subtitle: string }[] = [
  { key: "casual", title: "Casual", subtitle: "Friendly & relaxed" },
  { key: "supportive", title: "Supportive", subtitle: "Warm & empathetic" },
  { key: "professional", title: "Professional", subtitle: "Direct & clear" },
];

const toneModeOptions: { key: ToneMode; title: string; subtitle: string }[] = [
  { key: "calm", title: "Calm", subtitle: "Gentle, soothing pacing" },
  { key: "motivational", title: "Motivational", subtitle: "Energizing & encouraging" },
  { key: "grounding", title: "Grounding", subtitle: "Present-moment focus" },
];

const ageRanges: AgeRange[] = ["18-24", "25-34", "35-49", "50+"];

const concernOptions = [
  "anxiety",
  "stress",
  "relationships",
  "work",
  "burnout",
  "self-esteem",
  "sleep",
  "grief",
  "motivation",
];

const techniqueOptions = [
  "breathing",
  "journaling",
  "grounding",
  "reframing",
  "mindfulness",
  "visualization",
  "body scan",
  "micro-steps",
];

const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, selected && styles.chipSelected]}
    activeOpacity={0.8}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const PreferencesView: React.FC<PreferencesViewProps> = ({ user }) => {
  const [preferences, setPreferences] = useState<UserPreferencesData>({
    nickname: "",
    pronouns: "",
    tone: "supportive",
    tone_mode: "calm",
    voice_gender: "female",
    location: { city: "" },
    search_radius_km: 35,
    age_range: undefined,
    language: "",
    culture_note: "",
    companion_name: "",
    primaryConcerns: [],
    preferredTechniques: [],
    opt_out_topics: [],
    triggerWords: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previousVoiceGender, setPreviousVoiceGender] = useState<"male" | "female">("female");
  const [optOutInput, setOptOutInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");

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
        const incoming = data.data;
        setPreferences({
          nickname: incoming.nickname || "",
          pronouns: incoming.pronouns || "",
          tone: incoming.tone || "supportive",
          tone_mode: incoming.tone_mode || "calm",
          voice_gender: incoming.voice_gender || "female",
          location: incoming.location || { city: "" },
          search_radius_km: incoming.search_radius_km || 35,
          age_range: incoming.age_range,
          language: incoming.language || "",
          culture_note: incoming.culture_note || "",
          companion_name: incoming.companion_name || "",
          primaryConcerns: incoming.primaryConcerns || [],
          preferredTechniques: incoming.preferredTechniques || [],
          opt_out_topics: incoming.opt_out_topics || [],
          triggerWords: incoming.triggerWords || [],
        });
        setPreviousVoiceGender(incoming.voice_gender || "female");
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

      // Fetch existing data to merge with
      const { data: existingData } = await supabase
        .from("user_preferences")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        data: {
          ...(existingData?.data || {}),
          ...preferences,
        },
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error saving preferences:", error);
        Alert.alert("Error", "Failed to save preferences. Please try again.");
        return;
      }

      if (previousVoiceGender !== preferences.voice_gender) {
        Alert.alert("Voice Updated", "New voice sessions will use this voice.");
        setPreviousVoiceGender(preferences.voice_gender || "female");
      } else {
        Alert.alert("Success", "Your preferences have been saved!");
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleArrayValue = (
    key: "primaryConcerns" | "preferredTechniques",
    value: string
  ) => {
    setPreferences((prev) => {
      const list = prev[key] || [];
      const exists = list.includes(value);
      return {
        ...prev,
        [key]: exists ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  };

  const addKeyword = (key: "opt_out_topics" | "triggerWords", value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPreferences((prev) => {
      const list = prev[key] || [];
      if (list.includes(trimmed)) return prev;
      return { ...prev, [key]: [...list, trimmed] };
    });
  };

  const removeKeyword = (key: "opt_out_topics" | "triggerWords", value: string) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((v) => v !== value),
    }));
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

      {/* ========== IDENTITY SECTION ========== */}
      <Text style={styles.sectionHeader}>Identity</Text>

      {/* Nickname */}
      <View style={styles.section}>
        <Text style={styles.label}>Nickname</Text>
        <Text style={styles.helper}>What should Olive call you?</Text>
        <TextInput
          style={styles.input}
          value={preferences.nickname}
          onChangeText={(text) => setPreferences({ ...preferences, nickname: text })}
          placeholder={user.name.split(" ")[0]}
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={50}
        />
      </View>

      {/* Pronouns */}
      <View style={styles.section}>
        <Text style={styles.label}>Pronouns</Text>
        <Text style={styles.helper}>e.g., she/her, he/him, they/them</Text>
        <TextInput
          style={styles.input}
          value={preferences.pronouns}
          onChangeText={(text) => setPreferences({ ...preferences, pronouns: text })}
          placeholder="they/them"
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={30}
        />
      </View>

      {/* Age Range */}
      <View style={styles.section}>
        <Text style={styles.label}>Age Range</Text>
        <View style={styles.chipRow}>
          {ageRanges.map((range) => (
            <Chip
              key={range}
              label={range}
              selected={preferences.age_range === range}
              onPress={() => setPreferences({ ...preferences, age_range: range })}
            />
          ))}
        </View>
      </View>

      {/* ========== COMMUNICATION SECTION ========== */}
      <Text style={styles.sectionHeader}>Communication</Text>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.label}>Preferred Language</Text>
        <Text style={styles.helper}>Olive will respond in this language when possible</Text>
        <TextInput
          style={styles.input}
          value={preferences.language}
          onChangeText={(text) => setPreferences({ ...preferences, language: text })}
          placeholder="English"
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={60}
        />
      </View>

      {/* Culture Note */}
      <View style={styles.section}>
        <Text style={styles.label}>Culture Note</Text>
        <Text style={styles.helper}>Short context like "South Asian background"</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={3}
          value={preferences.culture_note}
          onChangeText={(text) => setPreferences({ ...preferences, culture_note: text })}
          placeholder="I grew up..."
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={140}
        />
      </View>

      {/* Companion Name */}
      <View style={styles.section}>
        <Text style={styles.label}>Olive's Name</Text>
        <Text style={styles.helper}>What should Olive call itself? (e.g., "Sam")</Text>
        <TextInput
          style={styles.input}
          value={preferences.companion_name}
          onChangeText={(text) => setPreferences({ ...preferences, companion_name: text })}
          placeholder="Olive"
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={60}
        />
      </View>

      {/* Conversation Tone */}
      <View style={styles.section}>
        <Text style={styles.label}>Conversation Tone</Text>
        <Text style={styles.helper}>How should Olive communicate with you?</Text>
        <View style={styles.cardGroup}>
          {toneOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.card, preferences.tone === opt.key && styles.cardActive]}
              onPress={() => setPreferences({ ...preferences, tone: opt.key })}
              activeOpacity={0.85}
            >
              <Text style={[styles.cardTitle, preferences.tone === opt.key && styles.cardTitleActive]}>
                {opt.title}
              </Text>
              <Text style={[styles.cardSubtitle, preferences.tone === opt.key && styles.cardSubtitleActive]}>
                {opt.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tone Mode */}
      <View style={styles.section}>
        <Text style={styles.label}>Tone Mode</Text>
        <Text style={styles.helper}>The energy and pacing of conversations</Text>
        <View style={styles.cardGroup}>
          {toneModeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.card, preferences.tone_mode === opt.key && styles.cardActive]}
              onPress={() => setPreferences({ ...preferences, tone_mode: opt.key })}
              activeOpacity={0.85}
            >
              <Text style={[styles.cardTitle, preferences.tone_mode === opt.key && styles.cardTitleActive]}>
                {opt.title}
              </Text>
              <Text style={[styles.cardSubtitle, preferences.tone_mode === opt.key && styles.cardSubtitleActive]}>
                {opt.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Voice Gender */}
      <View style={styles.section}>
        <Text style={styles.label}>Voice Preference</Text>
        <Text style={styles.helper}>For voice conversations with Olive</Text>
        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={[styles.card, preferences.voice_gender === "female" && styles.cardActive]}
            onPress={() => setPreferences({ ...preferences, voice_gender: "female" })}
            activeOpacity={0.85}
          >
            <Text style={[styles.cardTitle, preferences.voice_gender === "female" && styles.cardTitleActive]}>
              Female Voice
            </Text>
            <Text style={[styles.cardSubtitle, preferences.voice_gender === "female" && styles.cardSubtitleActive]}>
              Sage (warm & natural)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, preferences.voice_gender === "male" && styles.cardActive]}
            onPress={() => setPreferences({ ...preferences, voice_gender: "male" })}
            activeOpacity={0.85}
          >
            <Text style={[styles.cardTitle, preferences.voice_gender === "male" && styles.cardTitleActive]}>
              Male Voice
            </Text>
            <Text style={[styles.cardSubtitle, preferences.voice_gender === "male" && styles.cardSubtitleActive]}>
              Alloy (neutral & balanced)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========== FOCUS & TECHNIQUES SECTION ========== */}
      <Text style={styles.sectionHeader}>Focus Areas & Techniques</Text>

      {/* Primary Concerns */}
      <View style={styles.section}>
        <Text style={styles.label}>What do you want to focus on?</Text>
        <View style={styles.chipRow}>
          {concernOptions.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={preferences.primaryConcerns?.includes(c) || false}
              onPress={() => toggleArrayValue("primaryConcerns", c)}
            />
          ))}
        </View>
      </View>

      {/* Preferred Techniques */}
      <View style={styles.section}>
        <Text style={styles.label}>Techniques that help you</Text>
        <View style={styles.chipRow}>
          {techniqueOptions.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={preferences.preferredTechniques?.includes(t) || false}
              onPress={() => toggleArrayValue("preferredTechniques", t)}
            />
          ))}
        </View>
      </View>

      {/* ========== BOUNDARIES SECTION ========== */}
      <Text style={styles.sectionHeader}>Soft Boundaries</Text>

      {/* Topics to Avoid */}
      <View style={styles.section}>
        <Text style={styles.label}>Topics to Avoid</Text>
        <Text style={styles.helper}>Olive will steer away from these</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="e.g., politics"
            placeholderTextColor="rgba(27, 58, 47, 0.4)"
            value={optOutInput}
            onChangeText={setOptOutInput}
            onSubmitEditing={() => {
              addKeyword("opt_out_topics", optOutInput);
              setOptOutInput("");
            }}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              addKeyword("opt_out_topics", optOutInput);
              setOptOutInput("");
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {(preferences.opt_out_topics || []).length > 0 && (
          <View style={styles.keywordChipRow}>
            {preferences.opt_out_topics.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => removeKeyword("opt_out_topics", item)}
                style={styles.deletableChip}
                activeOpacity={0.8}
              >
                <Text style={styles.deletableChipText}>{item}</Text>
                <Text style={styles.deleteX}>✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Trigger Words */}
      <View style={styles.section}>
        <Text style={styles.label}>Trigger Words</Text>
        <Text style={styles.helper}>Olive will avoid these phrases</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="e.g., panic attack"
            placeholderTextColor="rgba(27, 58, 47, 0.4)"
            value={triggerInput}
            onChangeText={setTriggerInput}
            onSubmitEditing={() => {
              addKeyword("triggerWords", triggerInput);
              setTriggerInput("");
            }}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              addKeyword("triggerWords", triggerInput);
              setTriggerInput("");
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {(preferences.triggerWords || []).length > 0 && (
          <View style={styles.keywordChipRow}>
            {preferences.triggerWords.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => removeKeyword("triggerWords", item)}
                style={styles.deletableChip}
                activeOpacity={0.8}
              >
                <Text style={styles.deletableChipText}>{item}</Text>
                <Text style={styles.deleteX}>✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ========== LOCATION SECTION ========== */}
      <Text style={styles.sectionHeader}>Location & Care</Text>

      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.label}>Your Location</Text>
        <Text style={styles.helper}>Used to find local care providers</Text>
        <TextInput
          style={styles.input}
          value={preferences.location?.city || ""}
          onChangeText={(text) =>
            setPreferences({ ...preferences, location: { city: text } })
          }
          placeholder="City, Province/State"
          placeholderTextColor="rgba(27, 58, 47, 0.4)"
          maxLength={100}
        />
      </View>

      {/* Search Radius */}
      <View style={styles.section}>
        <Text style={styles.label}>
          Search Radius: {preferences.search_radius_km || 35} km
        </Text>
        <Text style={styles.helper}>How far to search for care providers</Text>
        <View style={styles.chipRow}>
          {[10, 25, 35, 50, 75, 100].map((radius) => (
            <Chip
              key={radius}
              label={`${radius}km`}
              selected={preferences.search_radius_km === radius}
              onPress={() => setPreferences({ ...preferences, search_radius_km: radius })}
            />
          ))}
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
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B3A2F",
    marginTop: 16,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(94, 140, 97, 0.2)",
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B3A2F",
    marginBottom: 4,
  },
  helper: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.6)",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.35)",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1B3A2F",
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
  },
  cardGroup: {
    gap: 12,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 2,
    borderColor: "rgba(94, 140, 97, 0.25)",
    borderRadius: 12,
    padding: 14,
  },
  cardActive: {
    backgroundColor: "#5E8C61",
    borderColor: "#5E8C61",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B3A2F",
    marginBottom: 4,
  },
  cardTitleActive: {
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.65)",
  },
  cardSubtitleActive: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  keywordChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(27, 58, 47, 0.2)",
  },
  chipSelected: {
    backgroundColor: "#5E8C61",
    borderColor: "#5E8C61",
  },
  chipText: {
    color: "#1B3A2F",
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  deletableChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    backgroundColor: "#5E8C61",
    borderRadius: 999,
    gap: 6,
  },
  deletableChipText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteX: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  flexInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: "#5E8C61",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  infoBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
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
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default PreferencesView;

