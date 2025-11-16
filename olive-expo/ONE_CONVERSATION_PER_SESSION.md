# One Conversation Per Voice Session - Implementation Summary

## Problem

Previously, voice interactions were creating multiple chat entries (one per sentence) or potentially creating new conversations for each turn, resulting in:

- Fragmented conversation history
- Multiple "Voice conversation" entries in chat list
- Difficulty tracking continuous voice sessions

## Solution

Implemented strict **one conversation per voice session** management:

- Conversation created ONCE at session start (or reused if provided)
- Same conversation ID used for ALL turns in that session
- Assertion added to catch regressions

## Changes Made

### 1. Chat Service - Added Assertion (`services/chatService.ts`)

**Added validation in `persistMessage` function:**

```typescript
export async function persistMessage(
  conversationId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  tokensIn = 0,
  tokensOut = 0
): Promise<Message> {
  // Assert conversation_id presence to catch regressions
  if (!conversationId || conversationId.trim() === "") {
    throw new ChatServiceError(
      "persistMessage: conversation_id is required but was not provided. " +
        "This indicates a bug in conversation management."
    );
  }
  // ... rest of function
}
```

**Rationale:**

- Fails fast if conversation_id is missing
- Catches bugs early in development
- Provides clear error message for debugging

### 2. VoiceView - Conversation Management (`components/VoiceView.tsx`)

#### A. Changed from State to Ref

```typescript
// BEFORE: State that could be reset per turn
const [conversationId, setConversationId] = useState<string | null>(
  selectedConversationId || null
);

// AFTER: Ref that persists for entire component lifecycle
const activeConversationId = useRef<string | null>(
  selectedConversationId || null
);
```

**Rationale:**

- Ref persists across re-renders
- Can't be accidentally reset during turn processing
- Clearly indicates this is session-level, not turn-level data

#### B. Replaced getOrCreateConversation with initializeConversation

```typescript
/**
 * Initialize conversation for voice session - called ONCE at session start
 * Reuses existing conversation if provided, otherwise creates new one
 */
const initializeConversation = async (): Promise<string> => {
  // If we already have an active conversation ID, reuse it
  if (activeConversationId.current) {
    return activeConversationId.current;
  }

  // Create new conversation for this voice session
  const newConversation = await chatService.createConversation(
    "Voice conversation"
  );

  // Store it for the entire session
  activeConversationId.current = newConversation.id;

  // Notify parent component
  if (onConversationCreated) {
    onConversationCreated(newConversation.id);
  }

  return newConversation.id;
};
```

**Key Differences:**

- Renamed to emphasize "initialization" not "get or create"
- Returns early if conversation already exists
- Single responsibility: initialize once

#### C. Updated handleConnect - Initialize Once

```typescript
const handleConnect = async () => {
  // ... permission check

  try {
    setConnectionState("connecting");
    setVoiceTurnState("IDLE");

    // Initialize conversation ONCE for this voice session
    await initializeConversation();
    console.log(
      "[VoiceView] Using conversation ID:",
      activeConversationId.current
    );

    // Reset pending turn
    pendingTurn.current = {
      userText: "",
      assistantText: "",
    };

    // Connect to Realtime API...
  }
}
```

**Rationale:**

- Conversation initialized before connecting to Realtime API
- Logged for debugging
- Only called once per session

#### D. Updated handleResponseComplete - Use Active ID

```typescript
const handleResponseComplete = async () => {
  console.log("[VoiceView] Response completed - persisting transcripts");

  try {
    // Use the active conversation ID for this session
    const convId = activeConversationId.current;

    if (!convId) {
      console.error(
        "[VoiceView] No active conversation ID - this should not happen"
      );
      return;
    }

    // Persist user transcript if present
    if (pendingTurn.current.userText.trim()) {
      await chatService.persistMessage(
        convId,
        "user",
        pendingTurn.current.userText
      );
      console.log("[VoiceView] User message persisted to conversation:", convId);
    }

    // Persist assistant response if present
    if (pendingTurn.current.assistantText.trim()) {
      await chatService.persistMessage(
        convId,
        "assistant",
        pendingTurn.current.assistantText
      );
      console.log("[VoiceView] Assistant message persisted to conversation:", convId);
    }

    // ... title generation and reset
  }
}
```

**Key Changes:**

- ❌ REMOVED: `const convId = await getOrCreateConversation()`
- ✅ ADDED: Direct use of `activeConversationId.current`
- ✅ ADDED: Guard clause if conversation ID missing
- ✅ ADDED: Better logging with conversation ID

#### E. Added Prop Sync Effect

```typescript
// Sync selected conversation ID from props
useEffect(() => {
  if (selectedConversationId) {
    activeConversationId.current = selectedConversationId;
    console.log(
      "[VoiceView] Synced conversation ID from props:",
      selectedConversationId
    );
  }
}, [selectedConversationId]);
```

**Rationale:**

- If user selects existing chat from sidebar, voice session continues it
- Syncs on prop change
- Maintains consistency between Chat and Voice tabs

## Session Lifecycle

### Scenario 1: New Voice Session (No Existing Chat)

```
1. User taps Voice tab
   → activeConversationId.current = null

2. User taps orb to connect
   → handleConnect() called
   → initializeConversation()
     - No existing ID, create new conversation
     - Store ID in activeConversationId.current
     - Notify parent (onConversationCreated)

3. User speaks multiple times
   → Each turn:
     - User message persisted with activeConversationId.current
     - Assistant response persisted with activeConversationId.current
     - Same conversation ID used every time

4. User switches to Chat tab
   → Chat displays all messages from activeConversationId.current
   → User sees complete conversation history

5. User returns to Voice tab
   → activeConversationId.current still set
   → User connects again
     - initializeConversation() returns existing ID
     - Conversation continues seamlessly
```

### Scenario 2: Continue Existing Chat in Voice

```
1. User has chat conversation "My anxiety discussion"
   - conversation_id = "abc-123"

2. User switches to Voice tab
   → selectedConversationId prop = "abc-123"
   → useEffect syncs: activeConversationId.current = "abc-123"

3. User connects to voice
   → initializeConversation()
     - activeConversationId.current already set to "abc-123"
     - Returns immediately, doesn't create new conversation

4. Voice turns persist to "abc-123"
   → User can see text + voice messages together in Chat tab
   → Single unified conversation history
```

### Scenario 3: Start New Conversation Mid-Session

```
1. User in voice session with conversation "abc-123"

2. User clicks "New Chat" in sidebar
   → MainScreen passes new selectedConversationId = null or new ID
   → useEffect syncs: activeConversationId.current = new ID

3. Next voice connection uses new conversation ID
   → Clean separation between conversations
```

## Guarantees

✅ **One conversation per session**: `activeConversationId.current` set once, reused throughout  
✅ **No orphaned messages**: Assertion catches missing conversation_id  
✅ **Chat/Voice parity**: Both tabs read from same `messages` table by conversation_id  
✅ **No duplicate conversations**: `initializeConversation()` returns early if ID exists  
✅ **Seamless reconnection**: Conversation ID persists if user disconnects/reconnects

## Testing Checklist

- [ ] Start voice session → verify single conversation created
- [ ] Multiple voice turns → verify all messages in same conversation
- [ ] Switch to Chat tab → verify all messages visible
- [ ] Switch back to Voice → verify conversation continues (not new one)
- [ ] Disconnect and reconnect → verify same conversation used
- [ ] Select existing chat → voice continues that conversation
- [ ] Click "New Chat" → voice starts new conversation
- [ ] Check conversation list → no duplicate "Voice conversation" entries

## Edge Cases Handled

1. **Missing conversation ID in persistence**

   - Assertion throws clear error
   - Prevents silent data corruption

2. **Props change during session**

   - useEffect syncs activeConversationId with selectedConversationId
   - Maintains consistency

3. **Reconnection in same session**

   - initializeConversation() returns early
   - Same conversation continues

4. **Component unmount/remount**
   - Parent should manage selectedConversationId
   - On remount, useEffect syncs from props

## Notes

- Conversation ID is stored in **ref**, not state, to prevent accidental resets
- `initializeConversation()` is called **only in handleConnect**, not in handleResponseComplete
- Title generation still triggered after first exchange (unchanged)
- Parent component (MainScreen) responsible for "New Chat" button behavior
