# Supabase Edge Functions - Olive

This directory contains Supabase Edge Functions (Deno runtime) for Olive's chat persistence and AI integration.

## Functions Overview

### 1. `/chat-stream` - Streaming Chat Handler

**Purpose**: Main chat endpoint that streams OpenAI responses to the client while persisting messages and managing context.

**Features**:

- ✅ Streams tokens in real-time (SSE)
- ✅ Authenticates users via Supabase JWT
- ✅ Persists user + assistant messages
- ✅ Gathers context (history, summary, preferences, memories)
- ✅ Triggers summarization after completion
- ✅ Enforces safety guardrails in system prompts

**Request**:

```json
{
  "conversation_id": "uuid",
  "user_text": "How can I manage my stress?"
}
```

**Response**: Server-Sent Events (SSE) stream of OpenAI tokens

---

### 2. `/summarize` - Conversation Summarizer

**Purpose**: Creates/updates rolling conversation summaries for context compression.

**Features**:

- ✅ Summarizes last 50 messages
- ✅ Factual, concise (<= 120 words)
- ✅ Preserves emotional themes and coping strategies
- ✅ Upserts to `conversation_summaries` table

**Request**:

```json
{
  "conversation_id": "uuid"
}
```

**Response**:

```json
{
  "ok": true,
  "summary": "User discussed anxiety...",
  "message_count": 15
}
```

---

### 3. `/gate` - Scope Classifier

**Purpose**: Cheap classifier to determine if user message is within Olive's support scope.

**Features**:

- ✅ Uses `gpt-4o-mini` for cost efficiency
- ✅ Returns "in" or "out" classification
- ✅ Defaults to "in" on errors (fail-open)
- ✅ Low latency (~200-500ms)

**Request**:

```json
{
  "user_text": "I'm feeling anxious about my presentation"
}
```

**Response**:

```json
{
  "scope": "in",
  "message": "Message is within support scope"
}
```

**In Scope**: Emotional support, stress, anxiety, relationships, wellbeing, self-care

**Out of Scope**: Medical diagnosis, legal advice, financial trading, prescriptions

---

## Environment Variables

Set these in **Supabase Dashboard** → **Edge Functions** → **Manage Secrets**:

### Required

```bash
OPENAI_API_KEY=sk-proj-xxxxx  # Your OpenAI API key
```

### Optional (with defaults)

```bash
OPENAI_CHAT_MODEL=gpt-5-nano          # Default: gpt-5-nano (latest model)
OPENAI_EMBED_MODEL=text-embedding-3-small  # For future pgvector support
```

### Auto-Provided by Supabase

These are automatically injected by Supabase:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Local Development

### Prerequisites

1. **Install Supabase CLI**:

   ```bash
   brew install supabase/tap/supabase
   # or
   npm install -g supabase
   ```

2. **Install Deno** (for local testing):
   ```bash
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

### Setup

1. **Link to your Supabase project**:

   ```bash
   cd olive-expo
   supabase link --project-ref <your-project-ref>
   ```

2. **Set local secrets** (for testing):

   ```bash
   echo "OPENAI_API_KEY=sk-proj-xxxxx" > supabase/.env.local
   echo "OPENAI_CHAT_MODEL=gpt-4o" >> supabase/.env.local
   ```

3. **Start local Edge Functions server**:

   ```bash
   supabase functions serve --env-file supabase/.env.local
   ```

   Functions will be available at:

   - `http://localhost:54321/functions/v1/chat-stream`
   - `http://localhost:54321/functions/v1/summarize`
   - `http://localhost:54321/functions/v1/gate`

### Test Locally

```bash
# Test gate function
curl -X POST http://localhost:54321/functions/v1/gate \
  -H "Authorization: Bearer <your-user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"user_text": "I am feeling stressed"}'

# Test chat-stream (streaming response)
curl -X POST http://localhost:54321/functions/v1/chat-stream \
  -H "Authorization: Bearer <your-user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "<uuid>", "user_text": "How can I manage stress?"}' \
  --no-buffer
```

---

## Deployment

### Deploy All Functions

```bash
cd olive-expo

# Deploy all functions at once
supabase functions deploy
```

### Deploy Individual Functions

```bash
# Deploy only chat-stream
supabase functions deploy chat-stream

# Deploy only summarize
supabase functions deploy summarize

# Deploy only gate
supabase functions deploy gate
```

### Set Production Secrets

After deployment, set secrets in Supabase Dashboard:

1. Go to **Edge Functions** → **Manage Secrets**
2. Add:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_CHAT_MODEL` (optional): `gpt-4o` or `gpt-4o-mini`

Or use CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano
```

### Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs chat-stream --tail
```

---

## Usage from Client

### Example: Streaming Chat

```typescript
import { supabase } from "./lib/supabase";

async function sendMessage(conversationId: string, userText: string) {
  // Get user JWT
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not authenticated");

  // Call edge function with streaming
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/chat-stream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        user_text: userText,
      }),
    }
  );

  // Parse SSE stream
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // Parse and display tokens...
  }
}
```

### Example: Scope Check

```typescript
async function checkScope(userText: string): Promise<"in" | "out"> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/gate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session!.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_text: userText }),
    }
  );

  const { scope } = await response.json();
  return scope;
}
```

---

## File Structure

```
supabase/functions/
├── README.md                    # This file
├── chat/
│   └── stream/
│       └── index.ts             # Streaming chat handler
├── summarize/
│   └── index.ts                 # Conversation summarizer
└── gate/
    └── index.ts                 # Scope classifier
```

---

## Architecture Notes

### Authentication Flow

1. Client obtains JWT from `supabase.auth.signIn()`
2. Client passes JWT in `Authorization: Bearer <token>` header
3. Edge function calls `supabase.auth.getUser()` to verify
4. RLS policies automatically enforce user ownership

### Context Management

**Short-term**: Last 20 messages from `messages` table

**Mid-term**: Rolling summary from `conversation_summaries` table

**Long-term**: Top 5 memories from `user_memories` table (by `last_refreshed_at`)

**Preferences**: User settings from `user_preferences.data` JSONB

### Cost Optimization

- **Gate**: Uses `gpt-5-nano` (fast, efficient classifier)
- **Chat**: Uses `gpt-5-nano` (latest model with improved reasoning)
- **Summarize**: Uses `gpt-5-nano` with low temperature (consistent summaries)

### Error Handling

- **Gate**: Defaults to `"in"` on errors (fail-open to avoid blocking support)
- **Stream**: Returns 500 with error JSON on failures
- **Summarize**: Returns 400 if no messages to summarize

---

## Monitoring

### View Logs

```bash
# Real-time logs for chat/stream
supabase functions logs chat-stream --tail

# View recent errors
supabase functions logs summarize --filter error
```

### Common Issues

**Issue**: `Unauthorized` response

**Solution**: Ensure client passes valid JWT in `Authorization` header

---

**Issue**: `OpenAI API error`

**Solution**:

1. Check `OPENAI_API_KEY` is set correctly
2. Verify OpenAI account has credits
3. Check rate limits

---

**Issue**: Function timeout

**Solution**:

1. Supabase Edge Functions timeout after 150s
2. For very long conversations, consider summarizing more aggressively
3. Check OpenAI response times

---

## Troubleshooting

### Error: 502 + JSON Error Response

**Symptom**: App shows error like "model_not_found" or "invalid_model"

**Cause**: The model name doesn't exist or you don't have access to it.

**Solution**:
1. Check OpenAI docs for the correct model name
2. Try `gpt-4o` or `gpt-4o-mini` as fallback:
   ```bash
   supabase secrets set OPENAI_CHAT_MODEL=gpt-4o
   ```
3. If using newer models, ensure `OPENAI_API_MODE` is set correctly:
   ```bash
   supabase secrets set OPENAI_API_MODE=chat  # or 'responses'
   ```

### Error: "No response body" in Client

**Symptom**: Client throws `NO_BODY` error

**Cause**: Edge Function failed before streaming, returning JSON error instead of SSE stream.

**Solution**:
1. Check Edge Function logs in Supabase Dashboard
2. Look for OpenAI API errors (model name, auth, etc.)
3. Enable debug mode to bypass streaming:
   ```bash
   supabase secrets set CHAT_STREAM=false
   ```
4. Fix the underlying issue, then re-enable streaming

### Debug Mode (Non-Streaming)

For quick troubleshooting, disable streaming to get plain JSON responses:

```bash
supabase secrets set CHAT_STREAM=false
```

This makes the function return `{text: "..."}` as JSON instead of SSE, making errors easier to diagnose.

### Model Configuration Table

| Model | API Mode | Notes |
|-------|----------|-------|
| `gpt-4o` | `chat` | Stable, widely available |
| `gpt-4o-mini` | `chat` | Faster, cheaper |
| `gpt-4-turbo` | `chat` | Legacy, still supported |
| `gpt-5-nano` | `chat` or `responses` | Check OpenAI docs for correct mode |

---

## Security

✅ **Row Level Security (RLS)**: All database queries respect user ownership

✅ **JWT Verification**: Every request validates `auth.uid()`

✅ **CORS**: Configured to allow client origins

✅ **No Client API Keys**: OpenAI key stays server-side only

✅ **Content Safety**: System prompts include guardrails and crisis protocols

---

## Future Enhancements

- [ ] `/embed` function for pgvector semantic search
- [ ] Rate limiting per user
- [ ] Token usage tracking and billing
- [ ] Memory extraction function (auto-populate `user_memories`)
- [ ] Multi-modal support (image, voice)

---

## Testing

### Unit Tests (Future)

```bash
# Run Deno tests (when implemented)
deno test --allow-env --allow-net
```

### Integration Tests

See `supabase/tests/` (to be created in Task 6/6)

---

**Questions?** See main `MIGRATION_GUIDE.md` or Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
