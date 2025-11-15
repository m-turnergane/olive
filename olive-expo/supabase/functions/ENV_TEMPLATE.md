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

### Realtime Voice Configuration

**`REALTIME_ENABLE`** (Default: `true`)

- Enable/disable OpenAI Realtime voice features
- Options: `true`, `false`
- Set to `false` to disable voice tab functionality

**`REALTIME_SERVER`** (Default: `openai`)

- Which Realtime API server to use
- Options: `openai`, `azure`
- Use `azure` if using Azure OpenAI Service

**`REALTIME_MODEL`** (Default: `gpt-realtime-mini`)

- Realtime model for voice conversations
- Options: `gpt-realtime-mini` (recommended), `gpt-4o-realtime-preview`, or dated variants like `gpt-realtime-mini-2025-10-06`
- Azure: use `gpt-realtime-mini` or similar deployment names

**`REALTIME_VOICE_DEFAULT`** (Default: `sage`)

- Default voice for Realtime API
- Used when user has no voice preference set

**`REALTIME_VOICE_FEMALE`** (Default: `sage`)

- Female voice option
- Valid options: `sage` (warm & natural - recommended), `shimmer`, `coral` (friendly), `ballad` (smooth), `verse` (expressive)

**`REALTIME_VOICE_MALE`** (Default: `alloy`)

- Male voice option
- Valid options: `alloy` (neutral & balanced - recommended), `echo` (resonant), `ash` (mellow), `marin` (deep), `cedar` (rich)

**`REALTIME_TURN_DETECTION`** (Default: `server_vad`)

- Turn detection mode for voice conversations
- Options: `server_vad` (recommended), `none`
- `server_vad` enables automatic turn-taking based on voice activity

**`AZURE_OPENAI_API_VERSION`** (Default: `2025-04-01-preview`)

- API version for Azure OpenAI Realtime (only used if REALTIME_SERVER=azure)
- Used for constructing Azure Realtime endpoint URLs

**`AZURE_OPENAI_ENDPOINT`** (Required if REALTIME_SERVER=azure)

- Azure OpenAI endpoint base URL
- Example: `https://YOUR-RESOURCE.openai.azure.com`
- Only needed when using Azure OpenAI

**`LOG_LEVEL`** (Default: `info`)

- Logging verbosity
- Options: `debug`, `info`, `warn`, `error`
- Use `debug` for development, `error` for production

### Local Development Setup

Create `supabase/.env.local`:

```bash
# Required
OPENAI_API_KEY=sk-proj-xxxxx

# Chat Configuration (defaults shown)
OPENAI_CHAT_MODEL=gpt-5-nano
OPENAI_API_MODE=chat
CHAT_STREAM=true
OPENAI_EMBED_MODEL=text-embedding-3-small

# Realtime Voice Configuration (defaults shown)
REALTIME_ENABLE=true
REALTIME_SERVER=openai
REALTIME_MODEL=gpt-realtime-mini
REALTIME_VOICE_DEFAULT=sage
REALTIME_VOICE_FEMALE=sage
REALTIME_VOICE_MALE=alloy
REALTIME_TURN_DETECTION=server_vad

# MCP find_care Tool Configuration
MCP_FIND_CARE_URL=http://localhost:3001
# In production, use deployed MCP server URL
# MCP_FIND_CARE_URL=https://your-mcp-server.com

# Azure OpenAI (only if REALTIME_SERVER=azure)
# AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
# AZURE_OPENAI_API_VERSION=2025-04-01-preview

# Logging
LOG_LEVEL=info
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

# Optional overrides - Chat
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano
supabase secrets set OPENAI_API_MODE=chat
supabase secrets set CHAT_STREAM=true

# Optional overrides - Realtime Voice
supabase secrets set REALTIME_ENABLE=true
supabase secrets set REALTIME_SERVER=openai
supabase secrets set REALTIME_MODEL=gpt-realtime-mini
supabase secrets set REALTIME_VOICE_DEFAULT=sage
supabase secrets set REALTIME_VOICE_FEMALE=sage
supabase secrets set REALTIME_VOICE_MALE=alloy
supabase secrets set REALTIME_TURN_DETECTION=server_vad

# Logging
supabase secrets set LOG_LEVEL=error
```

Then deploy functions:

```bash
supabase functions deploy chat-stream
supabase functions deploy gate
supabase functions deploy summarize
supabase functions deploy generate-title
supabase functions deploy realtime-ephemeral
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
