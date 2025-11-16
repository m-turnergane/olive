# Realtime Turn-Taking Fixes - Implementation Summary

## Overview
Fixed OpenAI Realtime API (gpt-realtime-mini) turn-taking issues including:
- ✅ Assistant repeating greetings / not waiting for user
- ✅ Audio clipping (first few words only)
- ✅ Each sentence creating a new chat entry
- ✅ Proper mic muting during assistant speech
- ✅ Cooldown to prevent false triggers
- ✅ Transcript validation

## Changes Made

### 1. Session Creation (`supabase/functions/realtime-ephemeral/index.ts`)

**Changed turn detection configuration:**
```typescript
turn_detection: {
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 1100,        // Increased from 1000ms
  create_response: true,            // Changed from false
  interrupt_response: false,
}
max_output_tokens: 350,             // Added to prevent early cutoff
```

**Rationale:**
- `create_response: true` → Server VAD automatically creates exactly one response per user turn
- `silence_duration_ms: 1100` → Slightly longer silence detection to avoid premature turn ending
- `max_output_tokens: 350` → Ensures complete sentences aren't cut off

### 2. Realtime Service (`services/realtimeService.ts`)

#### A. Updated Callbacks Interface
```typescript
export interface RealtimeCallbacks {
  // ... existing callbacks
  onUserSpeechStart: () => void;   // New: VAD detected user started speaking
  onUserSpeechStop: () => void;    // New: VAD detected user stopped speaking
  // Removed: onUserTurnEnd (no longer needed with server VAD)
}
```

#### B. Removed Manual Response Triggering
- Removed `triggerResponse()` method from `RealtimeConnection` interface
- Client no longer calls `response.create` manually
- Server VAD handles this automatically with `create_response: true`

#### C. Implemented Mic Muting
```typescript
// Store local audio track reference
let localAudioTrack: MediaStreamTrack | null = null;

// Mute on response.started
case 'response.started':
  if (localAudioTrack) {
    localAudioTrack.enabled = false;
    console.log('[Realtime] Mic muted on response.started');
  }
  break;

// Re-enable on response.done
case 'response.done':
  if (localAudioTrack) {
    localAudioTrack.enabled = true;
    console.log('[Realtime] Mic re-enabled after response.done');
  }
  break;
```

**Rationale:**
- Prevents echo/feedback during assistant speech
- Mutes immediately when response starts
- Re-enables only after complete response (not just audio.done)

#### D. Cooldown Implementation
```typescript
const cooldownState = {
  timeout: null as NodeJS.Timeout | null,
  isInCooldown: false,
};

case 'input_audio_buffer.speech_stopped':
  callbacks.onUserSpeechStop();
  
  // Start 300ms cooldown
  if (cooldownState.timeout) {
    clearTimeout(cooldownState.timeout);
  }
  cooldownState.isInCooldown = true;
  cooldownState.timeout = setTimeout(() => {
    cooldownState.isInCooldown = false;
  }, 300);
  break;
```

**Rationale:**
- 300ms cooldown after `speech_stopped` prevents false triggers
- Avoids immediate re-detection of trailing audio

#### E. Transcript Validation
```typescript
case 'conversation.item.input_audio_transcription.completed':
  if (message.transcript) {
    const trimmedTranscript = message.transcript.trim();
    // Only accept meaningful transcripts (≥3 chars)
    if (trimmedTranscript.length >= 3) {
      callbacks.onTranscript(trimmedTranscript, true);
    } else {
      console.log('[Realtime] Discarded short transcript:', trimmedTranscript);
    }
  }
  break;
```

**Rationale:**
- Filters out noise/false positives from VAD
- Only accepts transcripts with ≥3 characters

### 3. VoiceView Component (`components/VoiceView.tsx`)

#### A. State Machine Implementation
```typescript
type VoiceTurnState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

const [voiceTurnState, setVoiceTurnState] = useState<VoiceTurnState>("IDLE");
```

**State Transitions:**
- `IDLE` → `LISTENING` (on connect)
- `LISTENING` → `THINKING` (on user speech stop)
- `THINKING` → `SPEAKING` (on assistant speech start)
- `SPEAKING` → `LISTENING` (on response complete)

#### B. Pending Turn Management
```typescript
const pendingTurn = useRef<{
  userText: string;
  assistantText: string;
}>({
  userText: "",
  assistantText: "",
});
```

**Transcript Accumulation:**
- User transcripts: stored in `pendingTurn.userText` (final only)
- Assistant transcripts: accumulated in `pendingTurn.assistantText` (deltas → final)
- **No live display** in voice view (only orb animation)

#### C. Persistence at Turn End Only
```typescript
const handleResponseComplete = async () => {
  // Persist user message if present
  if (pendingTurn.current.userText.trim()) {
    await chatService.persistMessage(convId, "user", pendingTurn.current.userText);
  }
  
  // Persist assistant response if present
  if (pendingTurn.current.assistantText.trim()) {
    await chatService.persistMessage(convId, "assistant", pendingTurn.current.assistantText);
  }
  
  // Reset for next turn
  pendingTurn.current = { userText: "", assistantText: "" };
  setVoiceTurnState("LISTENING");
};
```

**Rationale:**
- Messages only persisted after complete turn (response.done)
- Prevents multiple messages per turn
- Chat view displays full text when user switches tabs

#### D. Updated Callbacks
```typescript
onUserSpeechStart: () => {
  setVoiceTurnState("LISTENING");
  setAmplitude(0.3);
},
onUserSpeechStop: () => {
  setVoiceTurnState("THINKING");
  setAmplitude(0);
},
onSpeakingStart: () => {
  setVoiceTurnState("SPEAKING");
  setAmplitude(0.7);
},
onResponseComplete: handleResponseComplete,
```

#### E. UI State Display
```typescript
{connectionState === "connected" && (
  <Text style={[styles.stateText, styles.connectedText]}>
    {voiceTurnState === "LISTENING" && "Listening..."}
    {voiceTurnState === "THINKING" && "Processing..."}
    {voiceTurnState === "SPEAKING" && "Olive is speaking"}
    {voiceTurnState === "IDLE" && "Connected"}
  </Text>
)}
```

## Event Flow (Server VAD with create_response:true)

### Complete Turn Cycle:

1. **User Starts Speaking:**
   - Event: `input_audio_buffer.speech_started`
   - Action: Transition to LISTENING state
   - UI: "Listening..."

2. **User Stops Speaking:**
   - Event: `input_audio_buffer.speech_stopped`
   - Action: Transition to THINKING state, start 300ms cooldown
   - UI: "Processing..."

3. **Server Auto-Creates Response:**
   - Event: `input_audio_buffer.committed` (automatic with create_response:true)
   - Action: Server automatically triggers response generation
   - Note: Client does NOT call response.create

4. **Assistant Starts Responding:**
   - Event: `response.started`
   - Action: Mute mic, transition to SPEAKING state
   - UI: "Olive is speaking"

5. **Assistant Speaks:**
   - Events: `response.audio.delta`, `response.audio_transcript.delta`
   - Action: Accumulate transcript deltas in pendingTurn
   - Note: Mic remains muted

6. **Assistant Finishes:**
   - Event: `response.audio.done`
   - Action: Signal speaking end (for UI)
   - Note: Don't unmute yet

7. **Response Complete:**
   - Event: `response.done`
   - Action: 
     - Re-enable mic
     - Persist both user and assistant messages
     - Clear pendingTurn
     - Transition back to LISTENING
   - UI: "Listening..."

## Key Principles

1. **Server VAD Control**: Server manages turn detection and response triggering
2. **Mic Muting**: Mic disabled during entire assistant response cycle
3. **Atomic Persistence**: Messages saved only after complete turn (response.done)
4. **Cooldown Protection**: 300ms cooldown prevents false triggers
5. **Transcript Validation**: Only accept transcripts ≥3 characters
6. **No Live Text in Voice**: Voice view shows only orb animation
7. **Complete Audio Playback**: Wait for response.done before unmuting mic

## Testing Recommendations

1. **Turn-taking**: Verify assistant waits for user to finish before responding
2. **Audio Completeness**: Check that full sentences play without clipping
3. **Message Count**: Confirm one user + one assistant message per turn in chat history
4. **Mic Muting**: Test that mic is muted during assistant speech (no echo)
5. **State Transitions**: Verify UI reflects correct state (LISTENING → THINKING → SPEAKING → LISTENING)
6. **Title Generation**: Verify titles are generated for voice conversations

## Dependencies

- OpenAI Realtime API (gpt-realtime-mini)
- react-native-webrtc
- Supabase Edge Functions
- expo-av (for mic permissions)

## Notes

- Voice "Sage" remains as default (separate task will address voice selection)
- Orb color remains blue during speaking (separate task will fix to green palette)
- Other warnings (expo-av deprecation, etc.) are separate tasks

