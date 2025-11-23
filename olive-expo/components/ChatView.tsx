import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { User } from "../types";
import {
  createConversation,
  sendMessageStream,
  isInScope,
  getDeflectionMessage,
  getConversationMessages,
  persistMessage,
  type Message,
} from "../services/chatService";
import { supabase } from "../services/supabaseService";
import FindCareModal from "./FindCareModal";

interface ChatViewProps {
  user: User;
  initialConversationId?: string | null;
}

interface DisplayMessage {
  role: "user" | "assistant" | "system";
  text: string;
  isStreaming?: boolean;
}

const SendIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
    <Path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </Svg>
);

const ChatView: React.FC<ChatViewProps> = ({ user, initialConversationId }) => {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;
  const hasTitleGenerationAttempted = useRef<Set<string>>(new Set());

  // FindCare modal state
  const [findCareModalVisible, setFindCareModalVisible] = useState(false);
  const [careProviders, setCareProviders] = useState<any[]>([]);
  const [findCareLoading, setFindCareLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<
    { lat: number; lng: number } | undefined
  >();

  // Update conversationId when initialConversationId changes
  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  // Load user location from preferences
  useEffect(() => {
    const loadUserLocation = async () => {
      try {
        const { data } = await supabase
          .from("user_preferences")
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.data?.location) {
          const loc = data.data.location;
          if (loc.lat && loc.lng) {
            setUserLocation({ lat: loc.lat, lng: loc.lng });
          }
        }
      } catch (error) {
        console.error("Failed to load user location:", error);
      }
    };
    loadUserLocation();
  }, [user.id]);

  /**
   * Trigger title generation for a conversation (client-side safety net)
   * Only runs once per conversation to avoid duplicate requests
   */
  const triggerTitleGeneration = async (convId: string) => {
    if (hasTitleGenerationAttempted.current.has(convId)) {
      return; // Already attempted for this conversation
    }

    try {
      hasTitleGenerationAttempted.current.add(convId);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-title`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ conversation_id: convId }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Title generated:", result.title);
      } else {
        const errorText = await response.text();
        console.error(
          `[ChatView] Title generation failed (${response.status}): ${errorText}`
        );
        Alert.alert(
          "Title update failed",
          "We couldn't automatically rename this chat. You can try again later."
        );
      }
    } catch (error) {
      console.error("Failed to trigger title generation:", error);
      Alert.alert(
        "Title update failed",
        "We couldn't automatically rename this chat. You can try again later."
      );
    }
  };

  // Load conversation history on mount (if conversation exists)
  useEffect(() => {
    async function loadHistory() {
      if (conversationId) {
        try {
          const history = await getConversationMessages(conversationId, 100);
          const displayMessages: DisplayMessage[] = history.map((msg) => ({
            role:
              msg.role === "user"
                ? "user"
                : msg.role === "assistant"
                ? "assistant"
                : "system",
            text: msg.content,
          }));
          setMessages(displayMessages);
        } catch (error) {
          console.error("Failed to load conversation history:", error);
        }
      }
    }
    loadHistory();
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive or streaming updates
    if (messages.length > 0 || streamingText) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, streamingText]);

  // Fade out welcome message when first message sent
  useEffect(() => {
    if (messages.length > 0) {
      Animated.timing(welcomeOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Fade back in if messages are cleared
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isStreaming) return;

    const userText = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // 1. Create conversation on first send
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const conversation = await createConversation("New chat");
        currentConversationId = conversation.id;
        setConversationId(currentConversationId);
      }

      // 2. Add user message to UI immediately (optimistic update)
      const userMessage: DisplayMessage = { role: "user", text: userText };
      setMessages((prev) => [...prev, userMessage]);

      // 2b. Persist user message to database immediately (critical for first message)
      try {
        await persistMessage(currentConversationId, "user", userText);
        console.log("✅ User message persisted to database");
      } catch (error) {
        console.error("Failed to persist user message:", error);
        // Continue anyway - server will also persist it
      }

      // 3. Check scope before sending to AI
      const inScope = await isInScope(userText);

      if (!inScope) {
        // Show empathetic deflection for out-of-scope topics
        const deflection = getDeflectionMessage();
        const deflectionMessage: DisplayMessage = {
          role: "assistant",
          text: deflection,
        };
        setMessages((prev) => [...prev, deflectionMessage]);
        setIsLoading(false);
        return;
      }

      // 4. Stream response from AI
      setIsLoading(false);
      setIsStreaming(true);
      setStreamingText("");

      let fullAssistantResponse = "";

      const toolResults = await sendMessageStream(
        currentConversationId,
        userText,
        // onToken callback - append each token
        (token: string) => {
          fullAssistantResponse += token;
          setStreamingText((prev) => prev + token);
        },
        // onError callback
        (error: Error) => {
          console.error("Streaming error:", error);
          setIsStreaming(false);
          setStreamingText("");
          const errorMessage: DisplayMessage = {
            role: "system",
            text: "Sorry, I encountered an error. Please try again.",
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      );

      // Handle tool results (e.g., find_care)
      if (toolResults && toolResults.length > 0) {
        for (const toolResult of toolResults) {
          if (toolResult.tool === "find_care" && toolResult.result?.providers) {
            setCareProviders(toolResult.result.providers);
            setFindCareModalVisible(true);
          }
        }
      }

      // 5. Stream complete - persist and add full assistant message to history
      setIsStreaming(false);
      setStreamingText("");

      if (fullAssistantResponse.trim()) {
        const assistantMessage: DisplayMessage = {
          role: "assistant",
          text: fullAssistantResponse,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Persist assistant message to database (critical for history)
        try {
          await persistMessage(
            currentConversationId,
            "assistant",
            fullAssistantResponse
          );
          console.log("✅ Assistant message persisted to database");

          // Client-side safety net: trigger title generation after first exchange (1 user + 1 assistant)
          const { data: roleSamples } = await supabase
            .from("messages")
            .select("role")
            .eq("conversation_id", currentConversationId)
            .order("created_at", { ascending: true })
            .limit(10);

          const hasUserMessage = roleSamples?.some(
            (msg) => msg.role === "user"
          );
          const hasAssistantMessage = roleSamples?.some(
            (msg) => msg.role === "assistant"
          );

          if (hasUserMessage && hasAssistantMessage) {
            console.log(
              "[ChatView] First exchange detected - triggering title generation"
            );
            triggerTitleGeneration(currentConversationId);
          }
        } catch (error) {
          console.error("Failed to persist assistant message:", error);
          // Message is still in UI, so user can see it
          // But it won't be in history on reload
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: DisplayMessage = {
        role: "system",
        text: "Sorry, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingText("");
    }
  };

  const renderMessage = ({
    item,
    index,
  }: {
    item: DisplayMessage;
    index: number;
  }) => {
    const isUser = item.role === "user";
    const isSystem = item.role === "system";
    const lines = item.text.split("\n").filter((line) => line.trim() !== "");

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.modelMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.modelBubble,
            isSystem && styles.systemBubble,
          ]}
        >
          {lines.map((line, i) => (
            <Text
              key={i}
              style={[
                styles.messageText,
                isUser && styles.userMessageText,
                isSystem && styles.systemMessageText,
              ]}
            >
              {line}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <Animated.View style={[styles.emptyState, { opacity: welcomeOpacity }]}>
      <Text style={styles.welcomeText}>
        Welcome, {user.name.split(" ")[0]}.
      </Text>
      <Text style={styles.subtitleText}>
        We're here to listen. What's on your mind?
      </Text>
    </Animated.View>
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={
            <>
              {/* Show streaming message in progress */}
              {isStreaming && streamingText && (
                <View
                  style={[
                    styles.messageContainer,
                    styles.modelMessageContainer,
                  ]}
                >
                  <View style={[styles.messageBubble, styles.modelBubble]}>
                    {streamingText
                      .split("\n")
                      .filter((line) => line.trim() !== "")
                      .map((line, i) => (
                        <Text key={i} style={styles.messageText}>
                          {line}
                        </Text>
                      ))}
                  </View>
                </View>
              )}
              {/* Show loading indicator when checking scope or initializing */}
              {(isLoading || (isStreaming && !streamingText)) && (
                <View
                  style={[
                    styles.messageContainer,
                    styles.modelMessageContainer,
                  ]}
                >
                  <View style={[styles.messageBubble, styles.modelBubble]}>
                    <ActivityIndicator color="#1B3A2F" />
                  </View>
                </View>
              )}
            </>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            placeholderTextColor="rgba(27, 58, 47, 0.6)"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isLoading && !isStreaming}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={isLoading || isStreaming || !input.trim()}
            style={[
              styles.sendButton,
              (!input.trim() || isLoading || isStreaming) &&
                styles.sendButtonDisabled,
            ]}
            activeOpacity={0.7}
          >
            <SendIcon />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* FindCare Modal */}
      <FindCareModal
        visible={findCareModalVisible}
        onClose={() => setFindCareModalVisible(false)}
        providers={careProviders}
        loading={findCareLoading}
        userLocation={userLocation}
        onRefine={(query) => {
          // Send a new message with the refined query
          setInput(`Find ${query} therapist near me`);
          setFindCareModalVisible(false);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "500",
    color: "rgba(27, 58, 47, 0.7)",
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: "rgba(27, 58, 47, 0.7)",
    textAlign: "center",
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: "flex-end",
  },
  modelMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: "#5E8C61", // olive-sage
  },
  modelBubble: {
    backgroundColor: "#F0F4F1", // olive-light - softer than white
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.15)", // subtle olive border
  },
  systemBubble: {
    backgroundColor: "#FFF3CD",
    borderWidth: 1,
    borderColor: "#FFC107",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#0C221B",
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  systemMessageText: {
    color: "#856404",
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 12 : 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(94, 140, 97, 0.3)",
    backgroundColor: "transparent",
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(94, 140, 97, 0.5)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#0C221B",
    maxHeight: 120,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#5E8C61",
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
});

export default ChatView;
