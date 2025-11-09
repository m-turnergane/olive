# Olive - React Native (Expo) Mental Health Companion

This is the mobile version of Olive, migrated from Vite React web app to Expo React Native for iOS and Android deployment.

## ✨ Features

- **Native Mobile Experience**: Full React Native implementation optimized for mobile
- **Real Supabase Authentication**: Email/password and Google OAuth support
- **Text-Based Chat**: Fully functional AI chat using Google Gemini API
- **Voice Interface Placeholder**: UI structure ready for voice chat implementation
- **Secure Token Storage**: Using expo-secure-store for authentication tokens
- **Persistent Sessions**: Auto-login with Supabase session management
- **Beautiful Native UI**: Adapted from web design with native components

## 🏗️ Tech Stack

- **Framework**: Expo SDK 54 with TypeScript
- **Authentication**: Supabase (email/password, Google OAuth)
- **AI/Chat**: Google Gemini 2.0 Flash
- **Storage**: AsyncStorage (session persistence)
- **UI**: React Native components with Linear Gradients
- **State Management**: React Hooks

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v20.16.0 or higher recommended)
2. **Expo CLI**: `npm install -g expo-cli`
3. **Expo Go app** on your iOS/Android device (for testing)
4. **Supabase Account**: [supabase.com](https://supabase.com)
5. **Google Gemini API Key**: [ai.google.dev](https://ai.google.dev)

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

# Google OAuth (for web/mobile OAuth)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# Google Gemini API Key
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
```

### 2. Supabase Database Setup

Create the `users` table in your Supabase database:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
```

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

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the App

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
├── components/             # React Native components
│   ├── icons/              # SVG icon components
│   ├── LoginScreen.tsx     # Authentication screen
│   ├── MainScreen.tsx      # Main app container
│   ├── ChatView.tsx        # Text chat interface
│   ├── VoiceView.tsx       # Voice interface (placeholder)
│   ├── SideMenu.tsx        # Navigation drawer
│   ├── ProfilePage.tsx     # User profile
│   ├── SettingsPage.tsx    # App settings
│   ├── Modal.tsx           # Generic modal component
│   ├── DisclaimerModal.tsx # Terms disclaimer
│   └── BackgroundPattern.tsx # Decorative background
│
├── lib/                    # Core libraries
│   ├── supabase.ts         # Supabase client (AsyncStorage + PKCE)
│   └── googleOAuth.ts      # Google OAuth PKCE flow
│
├── services/               # Service layer
│   ├── supabaseService.ts  # Auth helpers & database operations
│   └── geminiService.ts    # Google Gemini AI integration
│
└── hooks/                  # Custom React hooks
    └── useOrbAnimation.ts  # Voice orb animation hook
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

The text chat interface is fully functional:

- Real-time messaging with Google Gemini AI
- Message history with FlatList for performance
- Typing indicators
- Error handling with user feedback
- Smooth keyboard handling

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
  "@google/generative-ai": "^0.x",
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

## 🚨 Important Notes

### Known Limitations

1. **Voice Chat**: Not fully implemented on mobile (complex WebSocket + audio streaming)
2. **Google OAuth**: Ensure Expo AuthSession proxy URL is added to Supabase Redirect URLs
3. **Push Notifications**: Not implemented
4. **Chat History**: Currently mock data (needs Supabase integration)
5. **Settings**: Placeholder toggles (non-functional)

### Security Considerations

- API keys stored in environment variables
- Row-Level Security (RLS) enabled on Supabase
- Secure token storage with expo-secure-store
- HTTPS-only API calls
- Input validation on auth forms

### Performance

- FlatList for efficient message rendering
- Optimized re-renders with React.memo
- Lazy loading where applicable
- Native animations for smooth UI

## 🧪 Testing

To test the app:

1. **Authentication Flow**:

   - Sign up with email/password
   - Log out and log back in
   - Verify session persistence

2. **Chat Functionality**:

   - Send messages to AI
   - Verify responses appear
   - Test error handling (invalid API key, network errors)

3. **Navigation**:

   - Toggle between Voice and Chat tabs
   - Open side menu
   - Navigate to Profile and Settings
   - Test back navigation

4. **Permissions**:
   - Accept/deny microphone permissions
   - Verify appropriate error messages

## 📝 Future Enhancements

**High Priority:**

- Full voice chat with Gemini Live API
- Real chat history persistence
- Push notifications for reminders
- Offline mode with local storage

**Medium Priority:**

- Dark mode support
- Customizable themes
- Export chat history
- Mood tracking integration

**Low Priority:**

- Widget support
- Apple Health/Google Fit integration
- Multiple language support
- Accessibility improvements (screen reader, larger text)

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

## 📄 License

This project is part of the Olive mental health initiative.

## 🆘 Support

For issues or questions:

- Check Supabase documentation: [supabase.com/docs](https://supabase.com/docs)
- Check Expo documentation: [docs.expo.dev](https://docs.expo.dev)
- Check Gemini API docs: [ai.google.dev/docs](https://ai.google.dev/docs)

---

**⚠️ Important Disclaimer:**

Olive is a supportive companion for mental wellness, but it is **not a clinician or a replacement** for professional medical advice, diagnosis, or treatment. If you are in crisis or believe you may have a medical emergency, please contact a qualified healthcare provider or your local emergency services immediately.
