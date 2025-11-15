# Deploy Robust Chat Stream Updates

## Changes Made

### Edge Function (`chat-stream`)
- ✅ Added support for both Chat Completions API and Responses API
- ✅ Robust error handling with clear JSON error responses
- ✅ Non-streaming debug mode support
- ✅ Multi-format SSE parsing (Chat Completions + Responses API)

### Client Service (`chatService.ts`)
- ✅ Handles JSON error responses gracefully (no more NO_BODY crashes)
- ✅ Supports non-streaming debug responses
- ✅ Better error messaging from OpenAI

### Documentation
- ✅ Updated ENV_TEMPLATE with new variables
- ✅ Added comprehensive troubleshooting guide
- ✅ Model configuration table

---

## Deployment Steps

### 1. Deploy Updated Edge Function

```bash
cd /Users/m_gane/olivev2/olive/olive-expo

# Deploy the updated chat-stream function
supabase functions deploy chat-stream
```

### 2. Set Supabase Secrets

```bash
# Required: Your OpenAI API key (get from https://platform.openai.com/api-keys)
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx

# Model configuration
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano

# API mode: 'chat' for Chat Completions, 'responses' for Responses API
supabase secrets set OPENAI_API_MODE=chat

# Streaming: 'true' for SSE streaming, 'false' for debug mode
supabase secrets set CHAT_STREAM=true
```

### 3. Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check secrets
supabase secrets list
```

### 4. Test in App

```bash
# Restart Expo (press 'r' in terminal or shake device)
# Send a test message in Chat

# If it fails, check logs:
supabase functions logs chat-stream --tail
```

---

## Troubleshooting

### If You Get Model Errors

The error will now be clear in the app (e.g., "model_not_found"). Try these:

1. **Use a stable model first**:
   ```bash
   supabase secrets set OPENAI_CHAT_MODEL=gpt-4o
   ```

2. **Check if gpt-5-nano requires Responses API**:
   ```bash
   supabase secrets set OPENAI_API_MODE=responses
   ```

3. **Enable debug mode to see raw responses**:
   ```bash
   supabase secrets set CHAT_STREAM=false
   ```
   This will return `{text: "..."}` as JSON instead of streaming.

### If Streaming Still Fails

Check the Dashboard:
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. **Edge Functions** → **chat-stream** → **Logs**
4. Look for the exact OpenAI error

---

## Rollback Plan

If something breaks:

```bash
# Use stable model
supabase secrets set OPENAI_CHAT_MODEL=gpt-4o
supabase secrets set OPENAI_API_MODE=chat
supabase secrets set CHAT_STREAM=true

# Redeploy
supabase functions deploy chat-stream
```

---

## Expected Behavior

✅ **Success**: Message sends, assistant responds token-by-token

❌ **Model Error**: Clear error message like "Model 'gpt-5-nano' not found" (instead of NO_BODY)

❌ **Auth Error**: "OpenAI API key invalid" (instead of silent fail)

---

## Next Steps After Deployment

1. Test with "hey" message
2. Check logs if it fails
3. Adjust OPENAI_API_MODE if needed
4. Report back what error (if any) you see

The app will now show you **exactly** what's wrong instead of crashing with NO_BODY!

