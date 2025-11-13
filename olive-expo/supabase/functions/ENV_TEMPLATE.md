# Environment Variables Template

This document describes all environment variables required for Olive's backend and client.

## Supabase Edge Functions (Server-side)

### Required Variables

**`OPENAI_API_KEY`** (Required)
- Your OpenAI API key with access to chat/responses endpoints
- Never expose this client-side
- Get from: https://platform.openai.com/api-keys
- Example: `sk-proj-xxxxxxxxxxxxxxxxxxxxx`

### Optional Configuration

**`OPENAI_CHAT_MODEL`** (Default: `gpt-5-nano`)
- Which OpenAI model to use for chat completions
- Options: `gpt-5-nano`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- Nano models are fast and cost-effective for conversational support

**`OPENAI_API_MODE`** (Default: `chat`)
- Which OpenAI API endpoint to use
- Options:
  - `chat`: Chat Completions API (classic, well-documented)
  - `responses`: Responses API (unified, newer - experimental)
- Use `chat` unless you need Responses API features

**`CHAT_STREAM`** (Default: `true`)
- Whether to stream responses token-by-token
- Options:
  - `true`: Stream tokens (production, better UX)
  - `false`: Return full response (debug, easier logging)
- Set to `false` during development to debug without streaming complexity

**`OPENAI_EMBED_MODEL`** (Default: `text-embedding-3-small`)
- Embedding model for semantic search (future feature)
- Not currently used, reserved for memory/search enhancements

### Local Development Setup

Create `supabase/.env.local`:

```bash
# Required
OPENAI_API_KEY=sk-proj-xxxxx

# Optional (defaults shown)
OPENAI_CHAT_MODEL=gpt-5-nano
OPENAI_API_MODE=chat
CHAT_STREAM=true
OPENAI_EMBED_MODEL=text-embedding-3-small
```

Then run functions locally:

```bash
cd supabase
supabase functions serve --env-file .env.local
```

### Production Deployment

Set secrets via Supabase Dashboard (Settings > Edge Functions > Manage Secrets) or CLI:

```bash
# Required
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx

# Optional overrides
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano
supabase secrets set OPENAI_API_MODE=chat
supabase secrets set CHAT_STREAM=true
```

Then deploy functions:

```bash
supabase functions deploy chat-stream
supabase functions deploy gate
supabase functions deploy summarize
```

## Client (Expo App)

### Required Variables

Create `.env` file in `olive-expo/` root:

```bash
# Supabase Configuration (Required)
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional Analytics/Monitoring
EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Important Notes

- **NEVER** put `OPENAI_API_KEY` in client environment variables
- All client variables must be prefixed with `EXPO_PUBLIC_` to be accessible
- Client keys are embedded in the app bundle - treat them as public
- Use Supabase RLS to protect sensitive data, not client-side checks

### Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy:
   - **URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Environment Variable Checklist

### Before Running Locally
- [ ] Created `supabase/.env.local` with `OPENAI_API_KEY`
- [ ] Created `olive-expo/.env` with Supabase URL and anon key
- [ ] Verified `.env` files are in `.gitignore`

### Before Deploying to Production
- [ ] Set all Supabase secrets via dashboard/CLI
- [ ] Deployed all Edge Functions
- [ ] Updated Expo environment variables in EAS
- [ ] Verified RLS policies are enabled on all tables
- [ ] Tested streaming in production with real devices

## Troubleshooting

**"No response body" error in streaming**
- Ensure `CHAT_STREAM=true` on server
- Verify client uses `expo/fetch` (not global `fetch`)
- Check server logs for OpenAI API errors

**"Model not found" error**
- Verify `OPENAI_CHAT_MODEL` is set to a valid, accessible model
- Check your OpenAI account has access to the specified model
- Try `gpt-3.5-turbo` as a fallback

**"Unauthorized" errors**
- Check `OPENAI_API_KEY` is set and valid
- Verify Supabase JWT is being passed in Authorization header
- Ensure user is authenticated on client before calling functions

**Functions not receiving environment variables**
- Restart Supabase functions after changing secrets
- Verify secrets with `supabase secrets list`
- Check function logs with `supabase functions logs <function-name>`
