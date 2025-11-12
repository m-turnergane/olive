# Testing Guide - Olive Chat Persistence & Streaming

Complete testing checklist for chat functionality with GPT-5 nano.

## ✅ Prerequisites Checklist

Before testing, ensure everything is set up:

### 1. Database Setup

**Verify in Supabase Dashboard**:

- [ ] Go to **Table Editor**
- [ ] Confirm these tables exist:
  - ✅ `users`
  - ✅ `conversations`
  - ✅ `messages`
  - ✅ `conversation_summaries`
  - ✅ `user_memories`
  - ✅ `user_preferences`
- [ ] Check RLS is enabled (green toggle) on all tables

**If tables are missing**, run migrations:

1. Go to **SQL Editor** → **New Query**
2. Copy/paste `supabase/migrations/supabase-setup.sql` → Run
3. Copy/paste `supabase/migrations/20251112000000_chat_schema.sql` → Run

### 2. Edge Functions Deployment

**Verify functions are deployed**:

```bash
cd olive-expo/supabase
supabase functions list
```

Should show:

- ✅ `chat-stream`
- ✅ `summarize`
- ✅ `gate`

**If not deployed**:

```bash
./deploy-functions.sh
```

### 3. OpenAI Secrets

**Verify secrets are set**:

```bash
supabase secrets list
```

Should show:

- ✅ `OPENAI_API_KEY` (masked)
- ✅ `OPENAI_CHAT_MODEL` = `gpt-5-nano`

**If missing**:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano
```

### 4. Environment Variables

**Check `.env` file** (in `olive-expo/` directory):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ Important**: Do NOT put OpenAI API key in `.env` - it goes in Supabase secrets only!

---

## 🧪 Testing Steps

### Step 1: Start the App

```bash
cd olive-expo
npm start
# Then press 'i' for iOS or 'a' for Android
```

**Or directly**:

```bash
npm run ios    # iOS simulator
npm run android  # Android emulator
```

### Step 2: Authenticate

1. **Sign up** with email/password OR **Sign in with Google**
2. Verify you're logged in (should see main screen with Chat/Voice tabs)
3. **Check Supabase Dashboard** → **Authentication** → **Users** to confirm user exists

### Step 3: Test Basic Chat Flow

**Test Case 1: First Message (Creates Conversation)**

1. Navigate to **Chat** tab
2. Type: `"I'm feeling stressed about work"`
3. Tap **Send**

**Expected Behavior**:

- ✅ User message appears immediately (green bubble, right side)
- ✅ Loading indicator appears briefly (scope check)
- ✅ Assistant response streams in token-by-token (white bubble, left side)
- ✅ Message persists (close/reopen app → message still there)

**Verify in Supabase**:

- Go to **Table Editor** → `conversations` → Should see 1 row
- Go to **Table Editor** → `messages` → Should see 2 rows (user + assistant)

**Test Case 2: Out-of-Scope Message (Deflection)**

1. Type: `"Should I invest in Bitcoin?"`
2. Tap **Send**

**Expected Behavior**:

- ✅ User message appears immediately
- ✅ Yellow system bubble appears with deflection message
- ✅ No streaming (no OpenAI API call made)
- ✅ Message: _"That's outside my area of expertise. I'm designed to support you with emotional wellbeing..."_

**Test Case 3: Conversation History**

1. Close the app completely
2. Reopen the app
3. Navigate to Chat tab

**Expected Behavior**:

- ✅ Previous messages load automatically
- ✅ Full conversation history visible
- ✅ Can continue conversation seamlessly

**Test Case 4: Streaming Performance**

1. Type a longer message: `"I've been having trouble sleeping because I'm worried about my upcoming presentation. I keep replaying scenarios in my head and can't relax."`
2. Tap **Send**

**Expected Behavior**:

- ✅ Tokens stream smoothly (no stuttering)
- ✅ UI remains responsive during streaming
- ✅ Full response appears progressively
- ✅ No errors in console

**Test Case 5: Error Handling**

**Simulate network error**:

1. Turn on airplane mode
2. Try to send a message
3. Turn off airplane mode

**Expected Behavior**:

- ✅ Error message appears
- ✅ User can retry
- ✅ No app crash

---

## 🔍 Debugging Tips

### Check Edge Function Logs

```bash
# Real-time logs
supabase functions logs chat-stream --tail

# Recent errors
supabase functions logs chat/stream --filter error
```

### Check Database

**Verify messages are being saved**:

```sql
-- In Supabase SQL Editor
SELECT
  c.title,
  m.role,
  LEFT(m.content, 50) as content_preview,
  m.created_at
FROM conversations c
JOIN messages m ON m.conversation_id = c.id
ORDER BY m.created_at DESC
LIMIT 10;
```

**Verify conversation was created**:

```sql
SELECT * FROM conversations
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

### Check Client Console

**In Expo Dev Tools** (press `j` in terminal or shake device):

- Look for errors in console
- Check network requests
- Verify JWT token is present

### Common Issues

**Issue**: "Unauthorized" error

- **Solution**: User not authenticated. Sign out and sign back in.

**Issue**: "Failed to create conversation"

- **Solution**: Check RLS policies are enabled. Re-run migration.

**Issue**: Streaming doesn't work

- **Solution**:
  1. Check Edge Functions are deployed: `supabase functions list`
  2. Check OpenAI secret: `supabase secrets list`
  3. Check function logs: `supabase functions logs chat-stream --tail`

**Issue**: Messages don't persist

- **Solution**:
  1. Check database connection in Supabase Dashboard
  2. Verify RLS policies allow INSERT
  3. Check `add_message` RPC function exists

**Issue**: Scope check always returns "in"

- **Solution**: Check `/gate` function is deployed and has OpenAI secret

---

## 📊 Success Criteria

✅ **All tests pass if**:

1. First message creates conversation automatically
2. Streaming works smoothly (tokens appear progressively)
3. Out-of-scope messages show deflection (yellow bubble)
4. Messages persist across app restarts
5. No errors in console or Edge Function logs
6. Database shows conversations and messages

---

## 🎯 Quick Test Script

**Fastest way to verify everything works**:

```bash
# 1. Start app
npm run ios

# 2. In app:
#    - Sign in
#    - Go to Chat tab
#    - Send: "Hello, I'm feeling anxious"
#    - Wait for streaming response
#    - Send: "Should I buy stocks?"
#    - Verify yellow deflection appears
#    - Close app
#    - Reopen app
#    - Verify history loads

# 3. Check Supabase:
#    - Table Editor → conversations (should have 1 row)
#    - Table Editor → messages (should have 3+ rows)
```

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

✅ Database Setup: [ ] Pass [ ] Fail
✅ Edge Functions: [ ] Pass [ ] Fail
✅ Authentication: [ ] Pass [ ] Fail
✅ First Message: [ ] Pass [ ] Fail
✅ Streaming: [ ] Pass [ ] Fail
✅ Scope Gating: [ ] Pass [ ] Fail
✅ Persistence: [ ] Pass [ ] Fail
✅ Error Handling: [ ] Pass [ ] Fail

Notes:
_________________________________
_________________________________
```

---

**Questions?** Check:

- `services/CHAT_SERVICE_USAGE.md` for API details
- `supabase/functions/README.md` for Edge Functions
- Supabase Dashboard logs for errors
