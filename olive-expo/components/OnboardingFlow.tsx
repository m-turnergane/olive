// NEW FILE: olive-expo/components/OnboardingFlow.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { User } from "../types";
import { supabase } from "../services/supabaseService";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OnboardingFlowProps {
  user: User;
  onComplete: () => void;
  onSkip?: () => void;
}

// ... [Keep types as is] ...
type Tone = "casual" | "professional" | "supportive";
type ToneMode = "calm" | "motivational" | "grounding";
type AgeRange = "18-24" | "25-34" | "35-49" | "50+" | undefined;

interface OnboardingPreferences {
  nickname?: string;
  pronouns?: string;
  tone?: Tone;
  tone_mode?: ToneMode;
  voice_gender?: "male" | "female";
  location?:
    | string
    | {
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
  {
    key: "motivational",
    title: "Motivational",
    subtitle: "Energizing & encouraging",
  },
  { key: "grounding", title: "Grounding", subtitle: "Present-moment focus" },
];

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

const ageRanges: Exclude<AgeRange, undefined>[] = [
  "18-24",
  "25-34",
  "35-49",
  "50+",
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

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  user,
  onComplete,
  onSkip,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [existingData, setExistingData] = useState<Record<string, any>>({});
  const [prefs, setPrefs] = useState<OnboardingPreferences>({
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
  const [optOutInput, setOptOutInput] = useState("");
  const [triggerInput, setTriggerInput] = useState("");
  const transition = useRef(new Animated.Value(1)).current;
  const heroLine1 = useRef(new Animated.Value(0)).current;
  const heroLine2 = useRef(new Animated.Value(0)).current;
  const heroLine3 = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const firstName = useMemo(
    () => (user?.name || "").split(" ")[0] || "there",
    [user]
  );

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.warn("Failed to load preferences", error);
        }

        const incoming = data?.data || {};
        setExistingData(incoming);

        setPrefs((prev) => ({
          ...prev,
          ...incoming,
          location:
            typeof incoming.location === "string"
              ? { city: incoming.location }
              : incoming.location || prev.location,
          search_radius_km: incoming.search_radius_km || prev.search_radius_km,
          primaryConcerns: incoming.primaryConcerns || [],
          preferredTechniques: incoming.preferredTechniques || [],
          opt_out_topics: incoming.opt_out_topics || [],
          triggerWords: incoming.triggerWords || [],
        }));
      } catch (err) {
        console.error("Unexpected error loading preferences", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user.id]);

  const animateStep = () => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const goNext = () => {
    animateStep();
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => {
    animateStep();
    setStep((s) => Math.max(s - 1, 0));
  };

  const toggleValue = (
    key: "primaryConcerns" | "preferredTechniques",
    value: string
  ) => {
    setPrefs((prev) => {
      const list = prev[key] || [];
      const exists = list.includes(value);
      const next = exists ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  const addKeyword = (
    key: "opt_out_topics" | "triggerWords",
    value: string
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPrefs((prev) => {
      const list = prev[key] || [];
      if (list.includes(trimmed)) return prev;
      return { ...prev, [key]: [...list, trimmed] };
    });
  };

  const removeKeyword = (
    key: "opt_out_topics" | "triggerWords",
    value: string
  ) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((v) => v !== value),
    }));
  };

  const handleSave = async (skipOnly = false) => {
    try {
      setIsSaving(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      if (!sessionUser?.id) {
        throw new Error("Missing authenticated session. Please sign in again.");
      }
      const userId = sessionUser.id;

      // Ensure profile exists (handles Google sign-in edge cases)
      if (!skipOnly) {
        await supabase.rpc("user_upsert", {
          p_email: user.email,
          p_name: user.name,
          p_photo_url: user.photoUrl ?? null,
        });
      }

      const payload = skipOnly ? {} : prefs;

      const { error } = await supabase.from("user_preferences").upsert({
        user_id: userId,
        data: {
          ...existingData,
          ...payload,
          onboardingCompleted: true,
        },
        updated_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      onComplete();
    } catch (error) {
      console.error("Failed to save onboarding preferences", error);
      Alert.alert(
        "Save failed",
        "Please try again. Your preferences were not saved."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      handleSave(true);
    }
  };

  useEffect(() => {
    if (step === 0) {
      heroLine1.setValue(0);
      heroLine2.setValue(0);
      heroLine3.setValue(0);
      Animated.sequence([
        Animated.timing(heroLine1, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heroLine2, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heroLine3, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      heroLine1.setValue(1);
      heroLine2.setValue(1);
      heroLine3.setValue(1);
    }
  }, [step, heroLine1, heroLine2, heroLine3]);

  const renderToneCard = (
    option: (typeof toneOptions)[number] | (typeof toneModeOptions)[number],
    isTone: boolean
  ) => {
    const active = isTone
      ? prefs.tone === option.key
      : prefs.tone_mode === option.key;
    return (
      <TouchableOpacity
        key={option.key}
        style={[styles.card, active && styles.cardActive]}
        onPress={() =>
          setPrefs((prev) => ({
            ...prev,
            [isTone ? "tone" : "tone_mode"]: option.key,
          }))
        }
        activeOpacity={0.85}
      >
        <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>
          {option.title}
        </Text>
        <Text
          style={[styles.cardSubtitle, active && styles.cardSubtitleActive]}
        >
          {"subtitle" in option ? option.subtitle : ""}
        </Text>
      </TouchableOpacity>
    );
  };

  const steps = [
    {
      title: `Welcome, ${firstName}`,
      body: (
        <View style={styles.section}>
          <Text style={styles.helper}>
            Olive is here to support you. We’ll take under a minute to tailor
            how Olive greets and supports you.
          </Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Your responses stay private and only shape how Olive speaks with
              you.
            </Text>
          </View>
        </View>
      ),
    },
    {
      title: "Names & Pronouns",
      body: (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Your name</Text>
            <Text style={styles.helper}>
              From your account: {user?.name || "Unknown"}
            </Text>
            <Text style={styles.label}>Nickname (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={firstName}
              placeholderTextColor="rgba(27, 58, 47, 0.4)"
              value={prefs.nickname}
              onChangeText={(text) =>
                setPrefs((prev) => ({ ...prev, nickname: text }))
              }
              maxLength={50}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Pronouns (optional)</Text>
            <Text style={styles.helper}>e.g., she/her, he/him, they/them</Text>
            <TextInput
              style={styles.input}
              placeholder="they/them"
              placeholderTextColor="rgba(27, 58, 47, 0.4)"
              value={prefs.pronouns}
              onChangeText={(text) =>
                setPrefs((prev) => ({ ...prev, pronouns: text }))
              }
              maxLength={30}
            />
          </View>
        </>
      ),
    },
    {
      title: "Tone & Feel",
      body: (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Conversation tone</Text>
            <View style={styles.cardGroup}>
              {toneOptions.map((opt) => renderToneCard(opt, true))}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Tone mode</Text>
            <View style={styles.cardGroup}>
              {toneModeOptions.map((opt) => renderToneCard(opt, false))}
            </View>
          </View>
        </>
      ),
    },
    {
      title: "Language & Context",
      body: (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Preferred language</Text>
            <Text style={styles.helper}>
              Olive will respond in this language when possible.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="English"
              placeholderTextColor="rgba(27, 58, 47, 0.4)"
              value={prefs.language}
              onChangeText={(text) =>
                setPrefs((prev) => ({ ...prev, language: text }))
              }
              maxLength={60}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Culture note (optional)</Text>
            <Text style={styles.helper}>
              Short context like “South Asian background”.
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={3}
              value={prefs.culture_note}
              onChangeText={(text) =>
                setPrefs((prev) => ({ ...prev, culture_note: text }))
              }
              placeholder="I grew up..."
              placeholderTextColor="rgba(27, 58, 47, 0.4)"
              maxLength={140}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Age range</Text>
            <View style={styles.chipRow}>
              {ageRanges.map((range) => (
                <Chip
                  key={range}
                  label={range}
                  selected={prefs.age_range === range}
                  onPress={() =>
                    setPrefs((prev) => ({ ...prev, age_range: range }))
                  }
                />
              ))}
            </View>
          </View>
        </>
      ),
    },
    {
      title: "Olive’s intro",
      body: (
        <View style={styles.section}>
          <Text style={styles.label}>
            What should Olive call itself for you?
          </Text>
          <Text style={styles.helper}>
            Optional. e.g., “Sam” instead of “Olive”.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Olive"
            placeholderTextColor="rgba(27, 58, 47, 0.4)"
            value={prefs.companion_name}
            onChangeText={(text) =>
              setPrefs((prev) => ({ ...prev, companion_name: text }))
            }
            maxLength={60}
          />
        </View>
      ),
    },
    {
      title: "Focus areas & techniques",
      body: (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>What do you want to focus on?</Text>
            <View style={styles.chipRow}>
              {concernOptions.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={prefs.primaryConcerns?.includes(c) || false}
                  onPress={() => toggleValue("primaryConcerns", c)}
                />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Techniques that help</Text>
            <View style={styles.chipRow}>
              {techniqueOptions.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={prefs.preferredTechniques?.includes(t) || false}
                  onPress={() => toggleValue("preferredTechniques", t)}
                />
              ))}
            </View>
          </View>
        </>
      ),
    },
    {
      title: "Soft boundaries",
      body: (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Topics to avoid (optional)</Text>
            <Text style={styles.helper}>
              Olive will steer away from these. Tap a chip to remove it later.
            </Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder="ex: politics"
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
            {(prefs.opt_out_topics || []).length > 0 && (
              <View style={styles.keywordChipRow}>
                {(prefs.opt_out_topics || []).map((item) => (
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
          <View style={styles.section}>
            <Text style={styles.label}>Trigger words (optional)</Text>
            <Text style={styles.helper}>
              Olive will avoid these phrases to keep conversations safe.
            </Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder="ex: panic attack"
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
            {(prefs.triggerWords || []).length > 0 && (
              <View style={styles.keywordChipRow}>
                {(prefs.triggerWords || []).map((item) => (
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
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Olive won’t list your preferences back. It will simply respect
              these boundaries while chatting.
            </Text>
          </View>
        </>
      ),
    },
  ];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E8C61" />
        <Text style={styles.loadingText}>Setting things up...</Text>
      </View>
    );
  }

  const isLastStep = step === steps.length - 1;

  return (
    <LinearGradient colors={["#BAC7B2", "#F0F4F1"]} style={styles.gradient}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.progressDots}>
            {steps.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === step && styles.dotActive,
                  idx < step && styles.dotDone,
                ]}
              />
            ))}
          </View>
          {onSkip ? (
            <TouchableOpacity
              onPress={handleSkip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Animated.View
          key={step}
          style={[
            styles.contentContainer,
            {
              opacity: transition,
              transform: [
                {
                  translateY: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.title, step === 0 && styles.centerText]}>
              {steps[step].title}
            </Text>
            {step === 0 ? (
              <View>
                <Animated.Text
                  style={[
                    styles.helper,
                    styles.centerText,
                    { opacity: heroLine1 },
                  ]}
                >
                  Olive is here to support you. We’ll take under a minute to
                  tailor how Olive greets and supports you.
                </Animated.Text>
                <Animated.View style={{ opacity: heroLine2 }}>
                  <View style={[styles.infoBox, styles.centerBox]}>
                    <Text style={[styles.infoText, styles.centerText]}>
                      Your responses stay private and only shape how Olive
                      speaks with you.
                    </Text>
                  </View>
                </Animated.View>
                <Animated.View style={{ opacity: heroLine3 }}>
                  <View style={styles.sectionSpacing} />
                </Animated.View>
              </View>
            ) : (
              steps[step].body
            )}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              step === 0 && styles.secondaryButtonDisabled,
            ]}
            onPress={goBack}
            disabled={step === 0 || isSaving}
            activeOpacity={0.9}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                step === 0 && styles.secondaryButtonTextDisabled,
              ]}
            >
              Back
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              isSaving && styles.primaryButtonDisabled,
            ]}
            onPress={() => {
              if (isLastStep) {
                handleSave();
              } else {
                goNext();
              }
            }}
            disabled={isSaving}
            activeOpacity={0.9}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLastStep ? "Finish" : "Next"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  // removed safeArea style as we use manual padding
  container: {
    flex: 1,
    paddingHorizontal: 16,
    // paddingTop handled inline via insets
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(27, 58, 47, 0.2)",
  },
  dotActive: {
    backgroundColor: "#5E8C61",
  },
  dotDone: {
    backgroundColor: "rgba(94, 140, 97, 0.7)",
  },
  skipText: {
    color: "#1B3A2F",
    fontWeight: "600",
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1B3A2F",
    marginBottom: 12,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1B3A2F",
    marginBottom: 6,
  },
  centerText: {
    textAlign: "center",
  },
  centerBox: {
    alignSelf: "center",
  },
  sectionSpacing: {
    height: 12,
  },
  helper: {
    fontSize: 14,
    color: "rgba(27, 58, 47, 0.65)",
    marginBottom: 10,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.35)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#1B3A2F",
  },
  textArea: {
    height: 100,
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
    color: "#FFFFFF",
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
  infoBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  infoText: {
    color: "#2E7D32",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    gap: 12,
    paddingHorizontal: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#5E8C61",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "rgba(27, 58, 47, 0.12)",
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: "#1B3A2F",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonTextDisabled: {
    color: "rgba(27, 58, 47, 0.4)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flexInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: "#5E8C61",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F4F1",
  },
  loadingText: {
    marginTop: 12,
    color: "#1B3A2F",
    fontSize: 16,
  },
});

export default OnboardingFlow;
