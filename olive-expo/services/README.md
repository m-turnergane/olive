# Services Directory

Client-side services for Olive React Native app.

## Overview

### `supabaseService.ts`

Handles all Supabase authentication and user management:

- Email/password signup and signin
- Google OAuth
- User profile management
- Session handling
- RLS-compliant operations

### `chatService.ts` ✨ NEW

Handles chat persistence, streaming, and scope gating:

- Conversation creation and management
- Real-time streaming from OpenAI (via Edge Functions)
- Scope gating (filters inappropriate topics)
- Message history retrieval
- Full TypeScript support

### `geminiService.ts`

Legacy service for Google Gemini API (will be deprecated in favor of OpenAI via Edge Functions).

---

## Quick Start: Chat Service

```typescript
import {
  createConversation,
  sendMessageStream,
  isInScope,
  getDeflectionMessage,
} from "./services/chatService";

// 1. Create conversation
const conversation = await createConversation("My Session");

// 2. Check scope before sending
const inScope = await isInScope(userText);

if (!inScope) {
  // Show deflection
  showMessage(getDeflectionMessage());
  return;
}

// 3. Stream response
await sendMessageStream(conversation.id, userText, (token) => {
  // Append token to UI
  appendToAssistantMessage(token);
});
```

---

## Architecture

```
┌─────────────┐
│  React App  │
└──────┬──────┘
       │
       ├─ supabaseService ──> Supabase (Auth, RLS, RPCs)
       │
       └─ chatService ──────> Edge Functions ──> OpenAI
                               │
                               ├─ /chat-stream (streaming)
                               ├─ /summarize (context compression)
                               └─ /gate (scope classifier)
```

---

## Documentation

- **Chat Service Usage**: See `CHAT_SERVICE_USAGE.md` for complete examples
- **Edge Functions**: See `../supabase/functions/README.md` for server-side docs
- **Migration Guide**: See `../supabase/MIGRATION_GUIDE.md` for database setup

---

## Environment Variables

Required in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note**: OpenAI API key is NOT needed client-side. It's stored securely in Edge Functions.

---

## Security

✅ **OpenAI key stays server-side** (Edge Functions only)

✅ **Row Level Security** enforced on all database operations

✅ **JWT authentication** for all API calls

✅ **Scope gating** prevents inappropriate topics

✅ **No PII leakage** via prompts or summaries

---

## Testing

```bash
# Run service tests (when implemented in Task 6)
npm test services/chatService.test.ts
```

---

**Need Help?** See individual service files for JSDoc comments and type definitions.
