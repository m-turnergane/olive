# Testing Guide: Tasks A & B (Voice + Auto-Titles)

**Commit**: `feat: implement voice + auto-titles (Tasks A & B)` (c911d38)

## 🎯 What's Complete

### ✅ Task A: OpenAI Realtime Voice

- Full voice interaction via WebRTC
- Orb-only UI (no live text)
- Transcript persistence to chat history
- Voice preference (Sage/Alloy)
- Turn management (no repeats, no cut-offs)

### ✅ Task B: Auto-Generated Titles

- Server-side hook in chat-stream
- Client-side safety net in ChatView
- Works for both Chat and Voice modes

---

## 🚀 Deployment Steps

### 1. Deploy Edge Functions

```bash
cd supabase

# Deploy realtime-ephemeral (Voice token minting)
supabase functions deploy realtime-ephemeral

# Deploy chat-stream (includes auto-titles hook)
supabase functions deploy chat-stream
```

### 2. Set Environment Variables

Go to Supabase Dashboard → Edge Functions → Settings and ensure these are set:

```bash
# Voice Configuration
REALTIME_ENABLE=true
REALTIME_SERVER=openai
REALTIME_MODEL=gpt-realtime-mini
REALTIME_VOICE_DEFAULT=sage
REALTIME_VOICE_FEMALE=sage
REALTIME_VOICE_MALE=alloy
REALTIME_TURN_DETECTION=server_vad

# Chat Configuration (existing)
OPENAI_API_KEY=your_key_here
OPENAI_CHAT_MODEL=gpt-5-nano
CHAT_STREAM=true

# Other (existing)
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
```

### 3. Rebuild Expo Dev Client (if not already done)

Voice requires native WebRTC module:

```bash
cd olive-expo

# iOS
npx expo run:ios

# Android
npx expo run:android
```

**Note**: Expo Go won't work for Voice due to native module requirement.

---

## ✅ Testing Checklist

### Voice Features

#### Basic Voice Interaction

- [ ] **Open app** → Navigate to Voice tab
- [ ] **Tap orb** → Mic permission requested
- [ ] **Grant permission** → Orb enters idle state (soft breathing)
- [ ] **Tap orb again** → Connecting state shown
- [ ] **Connection established** → Orb changes to listening state (subtle pulse)
- [ ] **Speak clearly** → "I'm feeling anxious about work"
- [ ] **Orb changes to speaking** → Stronger pulse during assistant response
- [ ] **Assistant responds** → Full, complete sentences (no cut-offs)
- [ ] **Check Chat tab** → Full transcript visible in history

#### Voice Quality & Turn Management

- [ ] **No repeating responses** → Assistant replies exactly once per user turn
- [ ] **No cut-off speech** → Assistant finishes full sentences
- [ ] **Proper turn-taking** → Only one party speaks at a time
- [ ] **Silence detection** → ~1 second pause before assistant responds
- [ ] **Clear audio** → No echo, feedback, or distortion

#### Conversation Continuity

- [ ] **Start in Voice** → Have a conversation with 2-3 exchanges
- [ ] **Switch to Chat** → Full voice transcript visible in chat history
- [ ] **Type a message in Chat** → Assistant responds
- [ ] **Return to Voice** → Conversation continues (same conversation_id)
- [ ] **Check SideMenu** → Single conversation contains both voice & chat

#### Voice Preferences

- [ ] **Open Settings** → Navigate to Preferences
- [ ] **Change voice to Male (Alloy)** → Save preference
- [ ] **Start new voice session** → Assistant uses Alloy voice
- [ ] **Change back to Female (Sage)** → Save preference
- [ ] **Start new voice session** → Assistant uses Sage voice
- [ ] **Preference persists** → After app restart, last choice is remembered

#### Error Handling

- [ ] **Deny mic permission** → Clear message shown with instructions
- [ ] **Poor network** → Connection error shown, can retry
- [ ] **Tap "Stop"** → Cleanly disconnects, can reconnect
- [ ] **Background app** → Connection gracefully closes
- [ ] **Return to app** → Can start new session

### Auto-Titles Features

#### Chat Title Generation

- [ ] **New chat** → Start fresh conversation
- [ ] **Send first message** → "I'm struggling with anxiety"
- [ ] **Receive response** → Assistant provides supportive reply
- [ ] **Check SideMenu** → Title auto-generates within ~2-3 seconds
- [ ] **Title is descriptive** → e.g., "Struggling with anxiety"
- [ ] **Title shows in history** → Visible in conversation list

#### Voice Title Generation

- [ ] **New voice session** → Start fresh voice conversation
- [ ] **First exchange** → User speaks, assistant responds
- [ ] **Check SideMenu** → Title auto-generates after first exchange
- [ ] **Switch to Chat** → Same title visible
- [ ] **Continue in Chat** → Title remains unchanged

#### Edge Cases

- [ ] **Rapid messages** → Send 3 messages quickly → Only 1 title generated
- [ ] **Manual title** → If you manually set title, it's not overwritten
- [ ] **Empty responses** → If assistant gives empty response, no crash
- [ ] **Multiple conversations** → Each gets its own title

---

## 🐛 Known Issues & Expected Behavior

### Voice

- **First tap on orb**: May take 2-3 seconds to connect (normal - fetching ephemeral token)
- **Background mode**: Voice disconnects when app backgrounds (iOS limitation)
- **Expo Go**: Voice will NOT work in Expo Go (requires Dev Client for native modules)

### Auto-Titles

- **Title generation timing**: 2-5 seconds after first exchange (async, best-effort)
- **No title sometimes**: If OpenAI API is slow or fails, title may not generate (graceful degradation)
- **"Untitled conversation"**: Fallback if generation fails

---

## 📊 Success Criteria

### Voice Success = ALL of these:

✅ No repeating responses  
✅ No cut-off assistant speech  
✅ Full transcript in Chat history  
✅ Voice preference persists  
✅ Smooth turn-taking  
✅ No "unknown event" logs

### Titles Success = ALL of these:

✅ Title appears within 5 seconds of first exchange  
✅ Works for both Chat and Voice  
✅ No duplicate titles  
✅ Descriptive and relevant

---

## 🔧 Debugging

### Voice Issues

**Problem**: "Failed to create Realtime session"

- Check: `realtime-ephemeral` function deployed?
- Check: `OPENAI_API_KEY` set in Supabase?
- Check: `REALTIME_MODEL` is `gpt-realtime-mini` (not `gpt-4o-mini-realtime-preview`)

**Problem**: Assistant repeats itself

- Check: `REALTIME_TURN_DETECTION` is `server_vad`
- Check: `create_response: false` in session config
- Check: Only one `response.create` sent per turn

**Problem**: Cut-off responses

- Check: `interrupt_response: false` in session config
- Check: `silence_duration_ms: 1000` (not too low)
- Check: `echoCancellation: true` in getUserMedia

**Problem**: No transcript in Chat

- Check: `persistMessage` called in `handleResponseComplete`
- Check: Same `conversation_id` used in Voice and Chat
- Check: Database has messages from voice session

### Title Issues

**Problem**: No title generated

- Check: `generate-title` function deployed?
- Check: `OPENAI_CHAT_MODEL` set in Supabase?
- Check: Conversation has ≥2 messages?
- Check: Supabase logs for errors

**Problem**: Multiple titles generated

- Check: `hasTitleGenerationAttempted` ref working?
- Check: Server-side condition (lines 309-323 in chat-stream)

### General Issues

**Problem**: Functions not responding

```bash
# Check function logs
cd supabase
supabase functions logs realtime-ephemeral --tail
supabase functions logs chat-stream --tail
supabase functions logs generate-title --tail
```

**Problem**: Client errors

```bash
# Check React Native logs
npx expo start
# Then in Metro console, watch for errors
```

---

## 📝 After Testing

### If All Tests Pass ✅

1. Mark tests as complete in this doc
2. Update `VOICE_IMPLEMENTATION_SUMMARY.md` with test results
3. Proceed to Task C (MCP find_care) implementation

### If Tests Fail ❌

1. Note specific failing tests
2. Check debugging section above
3. Review Supabase function logs
4. Check React Native console for client errors
5. Report issues with:
   - Exact steps to reproduce
   - Error messages
   - Function logs
   - Expected vs actual behavior

---

## 🚀 Next Steps (Task C)

After Tasks A & B are validated, we'll complete:

**Task C: MCP find_care Tool** (75% complete)

- Tool call handler in chat-stream ⏳
- FindCareModal component ⏳
- Preferences UI for location ⏳
- End-to-end testing ⏳

**Server already built**:

- MCP server: `servers/mcp-find-care/`
- Google Places integration ✅
- Specialization mapping ✅
- Ranking logic ✅

---

## 📞 Support

If you encounter issues:

1. Check this testing guide
2. Review function logs in Supabase
3. Check `VOICE_IMPLEMENTATION_SUMMARY.md` for implementation details
4. Provide detailed error logs and steps to reproduce

---

**Last Updated**: November 15, 2025  
**Commit**: c911d38  
**Status**: Ready for testing
