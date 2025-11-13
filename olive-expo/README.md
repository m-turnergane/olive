# Olive - React Native (Expo) Mental Health Companion

This is the mobile version of Olive, migrated from Vite React web app to Expo React Native for iOS and Android deployment.

## ✨ Features

- **Native Mobile Experience**: Full React Native implementation optimized for mobile
- **Real Supabase Authentication**: Email/password and Google OAuth support
- **Streaming Chat with Persistence**: Real-time streaming from OpenAI GPT-5 nano with full conversation history
- **Scope Gating**: AI classifier prevents out-of-scope topics (medical, legal, financial advice)
- **Context-Aware**: Uses preferences and memories for personalized responses
- **Voice Interface Placeholder**: UI structure ready for voice chat implementation
- **Secure Token Storage**: Using expo-secure-store for authentication tokens
- **Persistent Sessions**: Auto-login with Supabase session management
- **Beautiful Native UI**: Adapted from web design with native components

## 🏗️ Tech Stack

- **Framework**: Expo SDK 54 with TypeScript
- **Authentication**: Supabase (email/password, Google OAuth, RLS)
- **AI/Chat**: OpenAI GPT-5 nano via Supabase Edge Functions
- **Database**: PostgreSQL (Supabase) with conversations, messages, memories
- **Storage**: AsyncStorage (session persistence)
- **UI**: React Native components with Linear Gradients
- **State Management**: React Hooks
- **Streaming**: Server-Sent Events (SSE) for real-time token streaming

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v20.16.0 or higher recommended)
2. **Expo CLI**: `npm install -g expo-cli`
3. **Expo Go app** on your iOS/Android device (for testing)
4. **Supabase Account**: [supabase.com](https://supabase.com)
5. **OpenAI API Key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
6. **Supabase CLI** (optional, for Edge Functions): `brew install supabase/tap/supabase`

## 🚀 Setup Instructions

### 1. Environment Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google OAuth (optional - for Google sign-in)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

**⚠️ Important**: OpenAI API key goes in **Supabase Edge Functions secrets**, NOT in client `.env`. This keeps your key secure server-side.

### 2. Supabase Database Setup

Run the SQL migrations to create tables for auth and chat persistence:

**Step 1: Basic Setup (Users table)**

1. Go to Supabase Dashboard → SQL Editor → New Query
2. Copy contents of `supabase/migrations/supabase-setup.sql`
3. Run the query (creates `users` table with RLS)

**Step 2: Chat Persistence (Conversations, Messages, Memories)**

1. In SQL Editor, create a New Query
2. Copy contents of `supabase/migrations/20251112000000_chat_schema.sql`
3. Run the query

This creates:

- ✅ `conversations` - Chat sessions
- ✅ `messages` - Chat history
- ✅ `conversation_summaries` - Rolling context summaries
- ✅ `user_memories` - Long-term user facts
- ✅ `user_preferences` - User settings (nickname, pronouns, tone)
- ✅ RPC functions: `create_conversation()`, `add_message()`

**Verify**: Check Table Editor to see new tables with RLS enabled.

📖 **Full Guide**: See `supabase/MIGRATION_GUIDE.md` for detailed instructions

### 3. Google OAuth Configuration

**In Supabase Dashboard:**

1. Go to **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Add your Google Client ID and Client Secret
4. Under **Redirect URLs**, add:
   - For Expo Go: `https://auth.expo.io/@mgane/olive-expo`
   - For production: `olive://auth/callback`

**In Google Cloud Console:**

1. Create OAuth 2.0 credentials (Web application type)
2. Add authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret to Supabase

**Important:** Do NOT add `exp://` or `olive://` URLs to Google Console. Google redirects to Supabase, which then redirects back to your app.

### 4. Deploy Edge Functions

Deploy Supabase Edge Functions for OpenAI streaming:

```bash
cd supabase

# Deploy all functions at once
./deploy-functions.sh

# Or deploy individually
supabase functions deploy chat-stream
supabase functions deploy summarize
supabase functions deploy gate
```

**Set OpenAI API Key (one-time)**:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano
```

📖 **Full Guide**: See `supabase/functions/README.md` for deployment details

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the App

For iOS simulator (macOS only):

```bash
npm run ios
```

For Android emulator:

```bash
npm run android
```

For Expo Go on physical device:

```bash
npm start
```

Then scan the QR code with:

- **iOS**: Camera app
- **Android**: Expo Go app

## 📱 Project Structure

```
olive-expo/
├── App.tsx                 # Main app entry point with navigation
├── types.ts                # TypeScript type definitions
├── babel.config.js         # Babel configuration
├── metro.config.js         # Metro bundler config
├── tailwind.config.js      # Tailwind CSS config (NativeWind)
├── app.json                # Expo configuration
│
├── components/              # React Native components
│   ├── icons/               # SVG icon components
│   ├── LoginScreen.tsx      # Authentication screen
│   ├── MainScreen.tsx       # Main app container
│   ├── ChatView.tsx         # Streaming chat interface with persistence
│   ├── PreferencesView.tsx  # User preferences editor
│   ├── VoiceView.tsx        # Voice interface (placeholder)
│   ├── SideMenu.tsx         # Navigation drawer
│   ├── ProfilePage.tsx      # User profile
│   ├── SettingsPage.tsx     # App settings
│   ├── Modal.tsx            # Generic modal component
│   ├── DisclaimerModal.tsx  # Terms disclaimer
│   └── BackgroundPattern.tsx # Decorative background
│
├── lib/                     # Core libraries
│   ├── supabase.ts          # Supabase client (AsyncStorage + PKCE)
│   └── googleOAuth.ts       # Google OAuth PKCE flow
│
├── services/                # Service layer
│   ├── supabaseService.ts   # Auth helpers & database operations
│   ├── chatService.ts       # Chat persistence + streaming + scope gating
│   └── geminiService.ts     # [Deprecated] Google Gemini (replaced by OpenAI)
│
├── hooks/                   # Custom React hooks
│   ├── useOrbAnimation.ts   # Voice orb animation hook
│   └── useUserContextFacts.ts # Preferences + memories preview
│
├── utils/                   # Utility functions
│   ├── sse.ts               # Server-Sent Events parser
│   └── __tests__/           # Unit tests
│       └── sse.test.ts      # SSE parser tests
│
└── supabase/                # Supabase configuration
    ├── migrations/          # SQL migrations
    │   ├── supabase-setup.sql
    │   └── 20251112000000_chat_schema.sql
    └── functions/           # Edge Functions (Deno)
        ├── chat-stream/     # Streaming chat handler
        ├── summarize/       # Conversation summarizer
        └── gate/            # Scope classifier
```

## 🔐 Authentication

The app supports two authentication methods:

### Email/Password

- Sign up with email, password, and name
- Secure password validation (min 6 characters)
- Automatic user record creation in Supabase

### Google OAuth (PKCE Flow)

- **PKCE OAuth** with `expo-auth-session` for secure mobile authentication
- Works seamlessly in **Expo Go** (development) using AuthSession proxy
- Automatic user profile creation from Google account data
- No additional native SDKs required

**How it works:**

1. Uses `AuthSession.makeRedirectUri({ useProxy: true })` for Expo Go
2. Opens Google sign-in in native browser via `AuthSession.startAsync()`
3. Exchanges authorization code for session via `supabase.auth.exchangeCodeForSession()`

**Supabase Configuration Required:**

- Add `https://auth.expo.io/@mgane/olive-expo` to Supabase Redirect URLs (for Expo Go)
- For production builds, add `olive://auth/callback`

### Session Management

- Persistent sessions using **AsyncStorage**
- Auto-login on app restart
- Automatic token refresh
- Session stored securely with Supabase client

## 💬 Chat Functionality

The chat interface features full persistence and streaming:

**✨ Features**:

- **Streaming Responses**: Real-time token-by-token streaming from OpenAI GPT-5 nano
- **Full Persistence**: All conversations and messages saved to Supabase
- **Scope Gating**: Classifier filters out medical/legal/financial advice topics
- **Context-Aware**: Uses conversation summaries, memories, and user preferences
- **Optimistic Updates**: User messages appear immediately
- **Error Handling**: Graceful fallbacks for network/API errors
- **Conversation History**: Loads past messages on mount

**How It Works**:

1. User sends message → Scope check via `/gate` Edge Function (GPT-5 nano)
2. If in-scope: Stream from `/chat-stream` → OpenAI GPT-5 nano
3. If out-of-scope: Show empathetic deflection (no API call)
4. Tokens stream progressively to UI
5. Message persisted server-side automatically
6. Rolling summary updated in background

**Expected Behavior**:

- ✅ First message creates conversation automatically
- ✅ Streaming appears token-by-token (like ChatGPT)
- ✅ Out-of-scope topics show yellow deflection message
- ✅ History persists across app restarts
- ✅ Context from past conversations used in responses

📖 **Full Docs**: See `services/CHAT_SERVICE_USAGE.md` for API details

## 🎙️ Voice Interface (Placeholder)

The voice interface UI is implemented, but full voice functionality requires additional work:

**What's Implemented:**

- Microphone permission requests
- Animated orb visualization
- Transcription display UI
- Audio recording infrastructure (Expo AV)

**What's Needed for Full Implementation:**

- WebSocket connection to Gemini Live API
- Real-time audio streaming
- PCM audio encoding/decoding
- Voice activity detection
- Audio playback synchronization

For MVP, users are directed to use the Chat tab for text conversations.

## 🎨 UI/UX

The app maintains the calming olive-green color scheme:

**Colors:**

- `olive-deep`: #1B3A2F (primary text, dark elements)
- `olive-sage`: #5E8C61 (buttons, accents)
- `olive-mint`: #97C09E (hover states)
- `olive-light`: #F0F4F1 (backgrounds)
- `olive-pale-sage`: #BAC7B2 (gradients)
- `calm-blue`: #A7CAE3 (AI voice indicator)

**Design Principles:**

- Clean, minimalist interface
- Calming color palette
- Smooth animations
- Intuitive navigation
- Accessible touch targets

## 📦 Key Dependencies

```json
{
  "@supabase/supabase-js": "^2.x",
  "expo": "~54.0.22",
  "expo-av": "^16.0.7",
  "expo-linear-gradient": "^14.x",
  "expo-secure-store": "^14.x",
  "expo-router": "^6.x",
  "react-native-svg": "^15.x",
  "react-native-reanimated": "^3.x",
  "@react-native-async-storage/async-storage": "^2.x"
}
```

**Note**: OpenAI client runs server-side via Supabase Edge Functions (not in app bundle)

## 🚨 Important Notes

### Known Limitations

1. **Voice Chat**: Not fully implemented on mobile (complex WebSocket + audio streaming)
2. **Google OAuth**: Ensure Expo AuthSession proxy URL is added to Supabase Redirect URLs
3. **Push Notifications**: Not implemented
4. **Memory Extraction**: Currently manual (future: auto-extract from conversations)
5. **Settings**: Some toggles placeholder (non-functional)

### Security Considerations

- **OpenAI key server-side only** (Edge Functions secrets, never in client)
- **Row-Level Security (RLS)** enabled on all database tables
- **JWT authentication** for all Edge Function calls
- **Secure token storage** with expo-secure-store
- **HTTPS-only** API calls
- **Input validation** on auth forms
- **Scope gating** prevents inappropriate AI usage

### Performance

- FlatList for efficient message rendering
- Optimized re-renders with React.memo
- Lazy loading where applicable
- Native animations for smooth UI

## 🧪 Testing

### Automated Tests

Run SSE parser tests:

```bash
npm test utils/sse.test.ts
```

### Manual Testing

1. **Authentication Flow**:

   - Sign up with email/password
   - Log out and log back in
   - Verify session persistence

2. **Chat Functionality**:

   - Send in-scope message: "I'm feeling stressed about work"
   - Verify streaming (tokens appear progressively)
   - Send out-of-scope message: "Should I invest in Bitcoin?"
   - Verify yellow deflection message appears
   - Close app and reopen → verify history loads

3. **Preferences**:

   - Navigate to Settings → Preferences
   - Set nickname, pronouns, tone
   - Save and send new message
   - Verify AI uses your nickname

4. **Navigation**:

   - Toggle between Voice and Chat tabs
   - Open side menu
   - Navigate to Profile and Settings
   - Test back navigation

5. **Permissions**:
   - Accept/deny microphone permissions
   - Verify appropriate error messages

## 📝 Future Enhancements

**High Priority:**

- Full voice chat with OpenAI Realtime API
- Automatic memory extraction from conversations
- Push notifications for reminders
- Offline mode with local storage

**Medium Priority:**

- Dark mode support
- Customizable themes
- Export chat history
- Mood tracking integration
- Multiple conversations management UI

**Low Priority:**

- Widget support
- Apple Health/Google Fit integration
- Multiple language support
- Accessibility improvements (screen reader, larger text)
- Semantic search with pgvector embeddings

## 🐛 Troubleshooting

### Metro Bundler Issues

```bash
# Clear cache and restart
npx expo start -c
```

### iOS Build Issues

```bash
# Clean and rebuild
cd ios && pod install && cd ..
npx expo run:ios
```

### Android Build Issues

```bash
# Clean gradle
cd android && ./gradlew clean && cd ..
npx expo run:android
```

### Module Resolution Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Chat Streaming Issues

**Problem: "No response body" error when sending messages**

This is the most common streaming issue. Solutions:

1. **Verify Expo fetch is being used** (✅ Fixed in latest version)
   - Client now uses `expo/fetch` instead of global `fetch`
   - This enables proper ReadableStream support in React Native

2. **Check Edge Function logs**
   ```bash
   # View real-time logs
   supabase functions logs chat-stream --follow
   ```
   
   Look for:
   - OpenAI API errors (model not found, auth issues)
   - Server-side errors before stream starts
   - Response Content-Type header (should be `text/event-stream`)

3. **Test with non-streaming mode first**
   ```bash
   # Set on Supabase dashboard or via CLI
   supabase secrets set CHAT_STREAM=false
   ```
   
   If non-streaming works but streaming doesn't:
   - Issue is in SSE parsing or stream handling
   - Check network inspector in dev tools
   - Verify no proxy/firewall is blocking SSE

4. **Verify OpenAI credentials**
   ```bash
   # Check secrets are set
   supabase secrets list
   
   # Should show OPENAI_API_KEY (value hidden)
   ```
   
   Test OpenAI key directly:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```

5. **Check model availability**
   - Ensure `OPENAI_CHAT_MODEL` (default: `gpt-5-nano`) is accessible
   - Try fallback: `supabase secrets set OPENAI_CHAT_MODEL=gpt-3.5-turbo`
   - Some models require special access or organization membership

**Problem: Streaming works but tokens appear slowly or in batches**

- **Expected behavior**: Some batching is normal due to network buffering
- **Verify**: OpenAI is streaming (check logs for `data:` events)
- **Improve**: 
  - Use faster model (nano models are quickest)
  - Reduce system prompt length
  - Check network latency

**Problem: First message works, subsequent messages fail**

- **Cause**: AbortController not cleaned up properly
- **Solution**: Ensure you're canceling previous requests:
  ```typescript
  import { createTimeoutController, cleanupController } from './services/chatService';
  
  // Before new request
  if (currentController) {
    cleanupController(currentController);
  }
  
  // Create new controller with 60s timeout
  const controller = createTimeoutController(60000);
  
  await sendMessageStream(
    conversationId, 
    text, 
    onToken,
    onError,
    controller.signal
  );
  ```

**Problem: Empty or partial responses**

1. **Check conversation context size**
   - OpenAI has token limits per request
   - Summaries help compress context
   - Latest messages + summary should fit in model's context window

2. **Verify messages are persisted**
   ```sql
   -- In Supabase SQL editor
   SELECT role, content, created_at 
   FROM messages 
   WHERE conversation_id = 'your-conv-id'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Check RLS policies**
   - Ensure user owns the conversation
   - Test: `SELECT * FROM conversations WHERE id = 'conv-id';`
   - Should return row if user is owner

**Problem: SSE parse errors in console**

- **Usually safe to ignore** - common for incomplete chunks
- **Check if responses are complete** - if yes, parsing is working
- **Enable dev logging**:
  ```typescript
  // In chatService.ts, __DEV__ logs parse errors
  // Look for patterns in malformed chunks
  ```

**Debug Mode: Full Request/Response Logging**

1. Set non-streaming mode:
   ```bash
   supabase secrets set CHAT_STREAM=false
   ```

2. Check Edge Function logs:
   ```bash
   supabase functions logs chat-stream --follow
   ```

3. Send a test message and inspect logs for:
   - Full OpenAI request payload
   - Complete response text
   - Any errors or warnings

4. Re-enable streaming after debugging:
   ```bash
   supabase secrets set CHAT_STREAM=true
   ```

**Testing Streaming Locally**

1. Run functions locally:
   ```bash
   cd supabase
   supabase functions serve --env-file .env.local
   ```

2. Update client to point to local functions:
   ```typescript
   // Temporarily in services/chatService.ts
   const FN_BASE = 'http://localhost:54321/functions/v1';
   ```

3. Test with curl:
   ```bash
   curl -N http://localhost:54321/functions/v1/chat-stream \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{"conversation_id":"test-uuid","user_text":"Hello"}'
   ```
   
   You should see `data:` events streaming in real-time.

**Still Having Issues?**

1. Check `supabase/functions/ENV_TEMPLATE.md` for complete environment setup
2. Verify all migrations ran: `supabase/migrations/*.sql`
3. Test authentication: ensure JWT is valid and not expired
4. Review `TESTING_GUIDE.md` for acceptance test checklist

## 📄 License

This project is part of the Olive mental health initiative.

## 🆘 Support

For issues or questions:

- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Expo**: [docs.expo.dev](https://docs.expo.dev)
- **OpenAI**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Edge Functions**: [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)

**Project-Specific Docs**:

- Chat Service: `services/CHAT_SERVICE_USAGE.md`
- Database Setup: `supabase/MIGRATION_GUIDE.md`
- Edge Functions: `supabase/functions/README.md`

---

**⚠️ Important Disclaimer:**

Olive is a supportive companion for mental wellness, but it is **not a clinician or a replacement** for professional medical advice, diagnosis, or treatment. If you are in crisis or believe you may have a medical emergency, please contact a qualified healthcare provider or your local emergency services immediately.
