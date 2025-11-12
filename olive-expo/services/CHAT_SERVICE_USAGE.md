# Chat Service Usage Guide

Complete guide for using `chatService.ts` in Olive React Native app.

## Overview

The chat service provides:
- ✅ Conversation creation and management
- ✅ Real-time streaming chat responses
- ✅ Scope gating (filters out-of-scope topics)
- ✅ Message history retrieval
- ✅ Full TypeScript support with error handling

---

## Setup

Import the service:

```typescript
import {
  createConversation,
  sendMessageStream,
  isInScope,
  getDeflectionMessage,
  getUserConversations,
  getConversationMessages,
  ChatServiceError,
  type Conversation,
  type Message,
} from '../services/chatService';
```

---

## Usage Examples

### 1. Create a New Conversation

```typescript
async function startNewChat() {
  try {
    const conversation = await createConversation('My Stress Management Session');
    
    console.log('Created conversation:', conversation.id);
    // Store conversation.id for subsequent messages
    
  } catch (error) {
    if (error instanceof ChatServiceError) {
      console.error('Failed to create conversation:', error.message);
    }
  }
}
```

---

### 2. Send a Message with Streaming Response

```typescript
async function sendChatMessage(conversationId: string, userText: string) {
  try {
    // Track the full response as it streams
    let fullResponse = '';
    
    await sendMessageStream(
      conversationId,
      userText,
      // onToken callback - fired for each token
      (token: string) => {
        fullResponse += token;
        
        // Update UI with new token
        setAssistantMessage(fullResponse);
      },
      // onError callback (optional)
      (error: Error) => {
        console.error('Streaming error:', error);
        setErrorMessage('Something went wrong. Please try again.');
      }
    );
    
    console.log('Stream complete. Full response:', fullResponse);
    
  } catch (error) {
    console.error('Send message error:', error);
  }
}
```

---

### 3. Check Scope Before Sending (Recommended)

```typescript
async function sendMessageWithGating(
  conversationId: string,
  userText: string,
  onToken: (token: string) => void
) {
  try {
    // 1. Check if message is in scope
    const inScope = await isInScope(userText);
    
    if (!inScope) {
      // Show deflection message instead of calling OpenAI
      const deflection = getDeflectionMessage();
      
      // Display deflection as a system message
      onToken(deflection);
      return;
    }
    
    // 2. Message is in scope - proceed with streaming
    await sendMessageStream(conversationId, userText, onToken);
    
  } catch (error) {
    console.error('Error in gated send:', error);
  }
}
```

---

### 4. Fetch Conversation History

```typescript
async function loadConversationHistory(conversationId: string) {
  try {
    const messages = await getConversationMessages(conversationId, 50);
    
    // Display messages in chat UI
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at,
    }));
    
    setMessages(formattedMessages);
    
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}
```

---

### 5. List User's Conversations

```typescript
async function loadUserConversations() {
  try {
    const conversations = await getUserConversations(20);
    
    // Display in sidebar or conversation list
    setConversationList(
      conversations.map((conv) => ({
        id: conv.id,
        title: conv.title || 'Untitled Conversation',
        lastUpdated: conv.updated_at,
      }))
    );
    
  } catch (error) {
    console.error('Failed to load conversations:', error);
  }
}
```

---

## Complete ChatView Integration Example

```typescript
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, ScrollView } from 'react-native';
import {
  createConversation,
  sendMessageStream,
  isInScope,
  getDeflectionMessage,
  getConversationMessages,
  type Conversation,
  type Message,
} from '../services/chatService';

export function ChatView() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');

  // Initialize conversation on mount
  useEffect(() => {
    async function init() {
      try {
        const conv = await createConversation();
        setConversationId(conv.id);
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    }
    init();
  }, []);

  async function handleSendMessage() {
    if (!inputText.trim() || !conversationId || isStreaming) return;

    const userText = inputText.trim();
    setInputText(''); // Clear input immediately

    // Add user message to UI optimistically
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);

    try {
      // 1. Check scope
      const inScope = await isInScope(userText);

      if (!inScope) {
        // Show deflection message
        const deflection = getDeflectionMessage();
        setMessages((prev) => [...prev, { role: 'assistant', content: deflection }]);
        return;
      }

      // 2. Stream response
      setIsStreaming(true);
      setCurrentAssistantMessage('');

      await sendMessageStream(
        conversationId,
        userText,
        (token: string) => {
          // Append token to current assistant message
          setCurrentAssistantMessage((prev) => prev + token);
        },
        (error: Error) => {
          console.error('Streaming error:', error);
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: 'Sorry, something went wrong. Please try again.' },
          ]);
          setIsStreaming(false);
        }
      );

      // Stream complete - add full assistant message to history
      setMessages((prev) => [...prev, { role: 'assistant', content: currentAssistantMessage }]);
      setCurrentAssistantMessage('');
      setIsStreaming(false);

    } catch (error) {
      console.error('Send error:', error);
      setIsStreaming(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.role === 'user' ? '#007AFF' : '#E5E5EA',
              padding: 12,
              borderRadius: 16,
              marginVertical: 4,
              maxWidth: '80%',
            }}
          >
            <Text style={{ color: msg.role === 'user' ? 'white' : 'black' }}>
              {msg.content}
            </Text>
          </View>
        ))}

        {/* Show streaming message in progress */}
        {isStreaming && currentAssistantMessage && (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#E5E5EA',
              padding: 12,
              borderRadius: 16,
              marginVertical: 4,
              maxWidth: '80%',
            }}
          >
            <Text>{currentAssistantMessage}</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', padding: 16 }}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          style={{ flex: 1, borderWidth: 1, padding: 8, borderRadius: 8 }}
          editable={!isStreaming}
        />
        <Button
          title="Send"
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isStreaming}
        />
      </View>
    </View>
  );
}
```

---

## Error Handling

All functions throw `ChatServiceError` on failure:

```typescript
import { ChatServiceError } from '../services/chatService';

try {
  await sendMessageStream(conversationId, text, onToken);
} catch (error) {
  if (error instanceof ChatServiceError) {
    // Specific chat service error
    console.error(`Chat error [${error.code}]:`, error.message);
    
    if (error.status === 401) {
      // User not authenticated
      navigation.navigate('Login');
    } else if (error.status === 500) {
      // Server error
      showErrorToast('Something went wrong on our end. Please try again.');
    }
  } else {
    // Other error
    console.error('Unexpected error:', error);
  }
}
```

---

## Scope Gating Details

### In-Scope Topics ✅
- Emotional support (stress, anxiety, sadness, anger)
- Mental wellbeing and self-care
- Coping strategies
- Relationship concerns
- Work stress and burnout
- General life challenges
- Journaling and reflection

### Out-of-Scope Topics ❌
- Medical diagnosis or treatment
- Legal advice
- Financial/investment advice
- Prescription medications
- Emergency situations requiring professionals

### Deflection Flow

```typescript
const inScope = await isInScope('Should I invest in Bitcoin?');
// Returns: false

if (!inScope) {
  const message = getDeflectionMessage();
  // Returns: "That's outside my area of expertise. I'm designed 
  // to support you with emotional wellbeing, stress, and mental 
  // health concerns. What's been on your mind lately?"
}
```

---

## API Reference

### `createConversation(title?: string): Promise<Conversation>`
Creates a new conversation.

### `sendMessageStream(conversationId, text, onToken, onError?): Promise<void>`
Streams assistant response token-by-token.

### `isInScope(text: string): Promise<boolean>`
Checks if message is within support scope.

### `getDeflectionMessage(topic?: string): string`
Returns a friendly deflection for out-of-scope topics.

### `getUserConversations(limit?: number): Promise<Conversation[]>`
Fetches user's conversations.

### `getConversationMessages(conversationId, limit?): Promise<Message[]>`
Fetches message history for a conversation.

### `deleteConversation(conversationId: string): Promise<void>`
Deletes a conversation (cascades to messages).

### `updateConversationTitle(conversationId, title): Promise<void>`
Updates conversation title.

---

## Best Practices

1. **Always check scope before streaming** to save tokens and prevent inappropriate topics
2. **Handle streaming errors gracefully** with the `onError` callback
3. **Store conversation ID** in component state or navigation params
4. **Show loading indicators** during scope checks and streaming
5. **Use optimistic UI updates** for user messages
6. **Batch history loading** with reasonable limits (50-100 messages)
7. **Implement retry logic** for network failures
8. **Clear sensitive data** when user logs out

---

## TypeScript Types

All types are exported from `chatService.ts`:

```typescript
import type {
  Conversation,
  Message,
  ScopeCheckResult,
  ChatServiceError,
} from '../services/chatService';
```

See `types.ts` for additional shared types like `UserMemory`, `UserPreferences`, etc.

---

**Questions?** See the main implementation in `services/chatService.ts` or Edge Functions README at `supabase/functions/README.md`.

