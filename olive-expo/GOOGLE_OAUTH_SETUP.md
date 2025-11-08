# Google OAuth Setup Guide for Olive

This guide walks you through setting up Google OAuth authentication for the Olive app.

## Prerequisites

- ✅ Supabase project created and configured
- ✅ Olive app running locally
- ✅ Google account (for Google Cloud Console)

---

## Part 1: Google Cloud Console Setup

### Step 1: Create/Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Either:
   - **Create new project**: Click "Select a project" → "New Project"
     - Name: "Olive" (or your preferred name)
     - Click "Create"
   - **Use existing project**: Select from dropdown

### Step 2: Enable Required APIs

1. In your project, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google+ API** (or **Google People API**)
   - Click "Enable"
3. Wait for activation (~30 seconds)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**

2. Choose **User Type**:

   - For testing: Select **External** (allows any Google account)
   - Click "Create"

3. **App Information**:

   ```
   App name: Olive
   User support email: your-email@example.com
   App logo: (optional - upload Olive logo)
   ```

4. **App domain** (optional for testing):

   ```
   Application home page: https://your-domain.com (optional)
   Privacy policy: https://your-domain.com/privacy (optional)
   Terms of service: https://your-domain.com/terms (optional)
   ```

5. **Developer contact information**:

   ```
   Email addresses: your-email@example.com
   ```

6. Click "Save and Continue"

7. **Scopes** (click "Add or Remove Scopes"):

   - Select:
     - `email` - See your primary Google Account email address
     - `profile` - See your personal info, including any personal info you've made publicly available
     - `openid` - Authenticate using OpenID Connect
   - Click "Update"
   - Click "Save and Continue"

8. **Test users** (if using External during development):

   - Click "Add Users"
   - Add your test email addresses (e.g., your personal Gmail)
   - Click "Add"
   - Click "Save and Continue"

9. **Summary**:
   - Review and click "Back to Dashboard"

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**

2. Click **"+ Create Credentials"** → **OAuth client ID**

3. **Application type**:

   - Select **Web application** ✅

   ⚠️ **Important**: Even though Olive is a mobile app, you MUST select "Web application" because:

   - Supabase OAuth uses a web-based authentication flow
   - The callback URL is a web URL (`https://your-project.supabase.co/auth/v1/callback`)
   - The mobile app opens a browser/webview for Google sign-in
   - After authentication, Supabase redirects back to your app via deep link

   **Note**: If you want true native Google Sign-In later (using `@react-native-google-signin/google-signin`), you can create additional iOS/Android OAuth clients, but for MVP, "Web application" is correct and works perfectly on mobile.

4. **Name**:

   ```
   Olive Web Client
   ```

5. **Authorized JavaScript origins**:

   ```
   https://your-project.supabase.co
   ```

   Replace `your-project` with your actual Supabase project reference

6. **Authorized redirect URIs** (IMPORTANT):

   ```
   https://your-project.supabase.co/auth/v1/callback
   ```

   Replace `your-project` with your actual Supabase project reference

   ⚠️ **This must be exact** - Copy from Supabase (see Part 2, Step 2)

7. Click **Create**

8. **Save your credentials**:
   ```
   Client ID: 1060917235079-9k6o2rsmtqe7u6mbni7kbaq1mms72070.apps.googleusercontent.com
   Client secret: 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
   ```
   ⚠️ **Copy these immediately** - You'll need them for Supabase!

---

## Part 2: Supabase Configuration

### Step 1: Access Auth Providers

1. Open your Supabase dashboard
2. Go to **Authentication** (left sidebar)
3. Click **Providers** tab

### Step 2: Configure Google Provider

1. Find **Google** in the providers list
2. Click to expand

3. **Enable the provider**:

   - Toggle "Enable Sign in with Google" to **ON**

4. **Copy the Callback URL** (you'll need this for Google Cloud Console):

   ```
   Callback URL (for OAuth): https://gjewzcenbolkpfmsdnqu.supabase.co/auth/v1/callback
   ```

   ⚠️ Make sure this matches what you entered in Google Cloud Console!

5. **Enter your Google credentials**:

   ```
   Client ID: [Paste from Google Cloud Console]
   Client Secret: [Paste from Google Cloud Console]
   ```

6. **Additional Settings** (optional):

   ```
   Skip nonce checks: Leave unchecked (default)
   ```

7. Click **Save**

### Step 3: Verify Configuration

1. The Google provider should now show as **Enabled** ✅
2. Status should be green/active

### Step 4: Add Additional Redirect URLs (Required for Expo Go)

Expo Go uses an Expo-hosted redirect (`https://auth.expo.dev/...`) during the OAuth handshake. Supabase must explicitly allow this URL so the session can complete.

1. In your Supabase project, go to **Authentication → URL Configuration**
2. Under **Additional Redirect URLs**, add both of these values:
   ```
   https://auth.expo.io/@<your-expo-username>/olive-expo
   https://auth.expo.dev/@<your-expo-username>/olive-expo
   olive://auth/callback
   ```
   - Replace `<your-expo-username>` with the value from `npx expo whoami`
   - If you renamed the project, replace `olive-expo` with your Expo app slug
3. Click **Save**

> 💡 Tip: When you build a standalone app (EAS build), keep `olive://auth/callback` in this list so the deep link continues to work outside Expo Go.

---

## Part 3: Mobile App Configuration (Optional - For Native OAuth)

For a full native Google Sign-In experience on mobile (optional, the current web-based OAuth works too):

### iOS Configuration

1. Install Expo Google Sign-In:

   ```bash
   cd /Users/m_gane/olivev2/olive/olive-expo
   npm install @react-native-google-signin/google-signin
   ```

2. Add iOS URL Scheme to `app.json`:

   ```json
   {
     "expo": {
       "ios": {
         "bundleIdentifier": "com.olive.mental-health",
         "config": {
           "googleSignIn": {
             "reservedClientId": "com.googleusercontent.apps.YOUR-iOS-CLIENT-ID"
           }
         }
       }
     }
   }
   ```

3. Create iOS OAuth Client in Google Cloud Console (Type: iOS)

### Android Configuration

1. Add SHA-1 fingerprint to Google Cloud Console:

   ```bash
   # Get debug keystore SHA-1
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

2. Create Android OAuth Client in Google Cloud Console (Type: Android)

3. Add to `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "package": "com.olive.mentalhealth",
         "config": {
           "googleSignIn": {
             "apiKey": "YOUR-ANDROID-API-KEY",
             "certificateHash": "YOUR-SHA1-FINGERPRINT"
           }
         }
       }
     }
   }
   ```

**Note**: The current web-based OAuth implementation works without these native configs. This is for enhanced native experience.

---

## Part 4: Update Environment Variables

1. Open `/Users/m_gane/olivev2/olive/olive-expo/.env`

2. Add your Google Client ID:

   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc123xyz.apps.googleusercontent.com
   ```

3. Restart your Expo dev server:
   ```bash
   # Stop current server (Ctrl+C)
   npm start
   ```

---

## Part 5: Testing Google OAuth

### Test Flow

1. **Start the app**:

   ```bash
   npm start
   ```

2. **On Login Screen**:

   - Click "Continue with Google" button
   - Should open browser/webview

3. **Google Sign-In Page**:

   - Select your Google account
   - Review permissions
   - Click "Allow" or "Continue"

4. **Callback**:
   - Should redirect back to app
   - If successful: Goes to Disclaimer (first time) or Main screen
   - If failed: Shows error message

### Expected Behavior

✅ **Success**:

- Google sign-in opens in browser
- After approval, redirects back to app
- User is created in Supabase Auth
- User record is created in `users` table
- Disclaimer shows (first time only)
- Main screen loads with user data

❌ **Common Issues**:

**Issue**: "Redirect URI mismatch"

- **Solution**: Check that redirect URI in Google Cloud Console exactly matches Supabase callback URL

**Issue**: "Access blocked: This app's request is invalid"

- **Solution**: Make sure OAuth consent screen is properly configured with test users (if External)

**Issue**: "App not verified"

- **Solution**: For testing, click "Advanced" → "Go to Olive (unsafe)". For production, submit for Google verification.

**Issue**: Button does nothing / no browser opens

- **Solution**:
  1. Check `.env` has correct Client ID
  2. Restart Expo dev server
  3. Check console for errors

**Issue**: "Network error" or "Failed to fetch"

- **Solution**: Check internet connection and Supabase project is active

---

## Part 6: Verification Checklist

- [ ] Google Cloud project created
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth client credentials created (Web application type)
- [ ] Redirect URI matches Supabase callback URL exactly
- [ ] Google provider enabled in Supabase
- [ ] Client ID and Secret added to Supabase
- [ ] Client ID added to `.env` file
- [ ] Expo dev server restarted
- [ ] Test user can sign in with Google
- [ ] User appears in Supabase Authentication → Users
- [ ] User record appears in users table
- [ ] Disclaimer shows on first login
- [ ] Main screen loads successfully

---

## Troubleshooting Guide

### Debug Mode

Add this to your LoginScreen to see detailed errors:

```typescript
const handleGoogleLogin = async () => {
  setIsLoading(true);
  setError(null);
  try {
    console.log("Starting Google OAuth...");
    const { user, error: authError } = await supabaseService.signInWithGoogle();
    console.log("OAuth result:", { user, authError });

    if (authError) {
      console.error("Auth error:", authError);
      setError(authError.message || "Failed to log in with Google.");
    } else if (user) {
      console.log("Login successful:", user);
      onLogin(user);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    setError("Failed to log in. Please try again.");
  } finally {
    setIsLoading(false);
  }
};
```

### Check Supabase Logs

1. Go to Supabase Dashboard
2. **Project** → **Logs** → **Auth Logs**
3. Look for errors related to Google OAuth

### Common Error Messages

| Error                   | Cause                           | Solution                                                     |
| ----------------------- | ------------------------------- | ------------------------------------------------------------ |
| `redirect_uri_mismatch` | Redirect URI doesn't match      | Update Google Cloud Console with exact Supabase callback URL |
| `invalid_client`        | Wrong Client ID or Secret       | Double-check credentials in Supabase                         |
| `access_denied`         | User clicked "Cancel"           | Normal - user cancelled authentication                       |
| `unauthorized_client`   | OAuth consent screen not set up | Complete OAuth consent screen setup                          |
| `invalid_request`       | Missing parameters              | Check Supabase provider configuration                        |

---

## Deep Linking (Advanced - Optional)

For better mobile experience, you can set up deep linking:

### 1. Add Deep Link Scheme to app.json

```json
{
  "expo": {
    "scheme": "olive",
    "ios": {
      "bundleIdentifier": "com.olive.mental-health",
      "associatedDomains": ["applinks:your-project.supabase.co"]
    },
    "android": {
      "package": "com.olive.mentalhealth",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "your-project.supabase.co",
              "pathPrefix": "/auth/callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 2. Update Supabase Service

The `signInWithGoogle()` function already includes:

```typescript
redirectTo: "olive://auth/callback";
```

This is ready for deep linking!

---

## Production Considerations

### Before Production:

1. **Verify OAuth Consent Screen**:

   - Submit app for Google verification
   - Update to "Internal" if using Google Workspace
   - Add production domains

2. **Create Production Credentials**:

   - Separate OAuth client for production
   - Use production Supabase URL

3. **Security**:

   - Never commit Client Secret to git
   - Use environment variables
   - Enable RLS (already done!)

4. **Terms & Privacy Policy**:
   - Create and publish required legal pages
   - Update OAuth consent screen links

---

## Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Expo AuthSession Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google Cloud Console](https://console.cloud.google.com)

---

## Summary

Once completed, users can:

1. ✅ Click "Continue with Google" on login screen
2. ✅ Authenticate with their Google account
3. ✅ Be automatically logged in
4. ✅ Have their user data saved in Supabase
5. ✅ Stay logged in across app restarts

**Current Status**: Web-based OAuth ready. Native OAuth optional enhancement.
