# Deploy generate-title Edge Function

## Command to Deploy

```bash
cd supabase
supabase functions deploy generate-title
```

## What This Does

- Deploys the `generate-title` Edge Function to your Supabase project
- Makes it available at: `https://YOUR-PROJECT.supabase.co/functions/v1/generate-title`
- Uses the same environment variables as other functions (OPENAI_API_KEY, etc.)

## Verify Deployment

After deploying, test it:

```bash
# Get your JWT token (from authenticated session)
JWT="your-jwt-token"

# Test the function
curl https://YOUR-PROJECT.supabase.co/functions/v1/generate-title \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "your-conversation-uuid"}'
```

## Integration

The function is ready to use. To integrate it into the chat flow:

1. Call it after the first 2-3 message exchanges
2. Update the conversation title in the sidebar automatically
3. See example in `UX_IMPROVEMENTS_SUMMARY.md` section "5️⃣ Auto-Generated Conversation Titles"

## Environment Variables

The function uses the same secrets as `chat-stream`:
- `OPENAI_API_KEY` (already set)
- `OPENAI_CHAT_MODEL` (defaults to gpt-5-nano if not set)

No additional secrets needed!
