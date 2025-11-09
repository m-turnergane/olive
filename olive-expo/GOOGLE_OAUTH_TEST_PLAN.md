# Google OAuth Test Plan (Expo Go)

## ✅ Pre-Test Checklist

### Supabase Configuration
- [ ] Google provider enabled in Supabase Dashboard (Authentication → Providers → Google)
- [ ] Redirect URL added: `https://auth.expo.io/@mgane/olive-expo`
- [ ] Google Client ID and Secret configured in Supabase

### Google Cloud Console
- [ ] OAuth 2.0 Web client created
- [ ] Authorized redirect URI: `https://gjewzcenbolkpfmsdnqu.supabase.co/auth/v1/callback`
- [ ] Client ID matches `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in env file

### Environment
- [ ] `env` file has all required `EXPO_PUBLIC_*` variables
- [ ] Expo Go app installed on test device
- [ ] Running: `npm start` in `olive-expo/` directory

---

## 🧪 Test Scenarios

### Test 1: Fresh Google Sign-Up (New User)

**Steps:**
1. Open app in Expo Go (scan QR code)
2. Tap **"Continue with Google"** button
3. Browser opens with Google sign-in page
4. Select/enter a Google account that has NOT used the app before
5. Grant permissions when prompted
6. Browser closes automatically

**Expected Results:**
- ✅ Redirects back to app within 2-3 seconds
- ✅ Main screen loads (chat interface visible)
- ✅ User profile shows Google name and photo
- ✅ Console logs: "✅ Google OAuth successful!"
- ✅ New user record created in Supabase `users` table

**Failure Modes:**
- ❌ Error: "No authorization code received" → Check Supabase redirect URL
- ❌ Stuck on browser → Check Google Console redirect URI
- ❌ "Session exchange error" → Check Supabase logs for PKCE errors

---

### Test 2: Returning User Sign-In

**Steps:**
1. Force quit and restart Expo Go app
2. Tap **"Continue with Google"** button
3. Browser opens, Google may auto-select previous account
4. Accept/continue (no re-authentication needed if session active)

**Expected Results:**
- ✅ Faster than first sign-in (no account selection)
- ✅ Main screen loads with existing user data
- ✅ User profile matches previous session
- ✅ No duplicate user records in database

---

### Test 3: Sign-Out and Re-Authentication

**Steps:**
1. From main screen, open side menu (hamburger icon)
2. Tap **Profile** → **Logout** (or Settings → Logout)
3. Confirm logout
4. App returns to login screen
5. Tap **"Continue with Google"** again
6. Complete Google sign-in flow

**Expected Results:**
- ✅ Session cleared (no auto-login)
- ✅ Re-authentication succeeds
- ✅ Same user data restored
- ✅ No errors or stale session issues

---

### Test 4: Sign-Up via Modal (Alternative Flow)

**Steps:**
1. From login screen, tap **"Create an Account"**
2. Modal opens
3. Tap **"Sign up with Google"** in modal
4. Complete Google OAuth flow

**Expected Results:**
- ✅ Same behavior as main "Continue with Google" button
- ✅ Modal closes after successful auth
- ✅ User logged in to main screen

---

### Test 5: Cancel/Dismiss OAuth Flow

**Steps:**
1. Tap **"Continue with Google"**
2. Browser opens
3. **Immediately tap "Cancel"** or swipe down to dismiss
4. Return to app

**Expected Results:**
- ✅ Returns to login screen
- ✅ Error message: "OAuth flow not completed: cancel" or similar
- ✅ App remains stable (no crash)
- ✅ Can retry sign-in immediately

---

### Test 6: Network Interruption

**Steps:**
1. Tap **"Continue with Google"**
2. **Turn off WiFi/cellular** during OAuth flow
3. Observe behavior

**Expected Results:**
- ✅ Google page shows network error
- ✅ User can dismiss and retry
- ✅ No app crash or frozen state

---

### Test 7: Concurrent Email & Google Accounts

**Steps:**
1. Create account via **"Login with Email"** (e.g., test@example.com)
2. Logout
3. Sign in with Google using a DIFFERENT email
4. Verify separate user profiles

**Expected Results:**
- ✅ Two separate accounts in database
- ✅ No cross-contamination of user data
- ✅ Can switch between accounts by logging out/in

---

## 📱 Platform-Specific Tests

### iOS (Expo Go)
- [ ] **Test 1-7** on iOS device/simulator
- [ ] Safari browser sheet opens for OAuth
- [ ] Smooth return to app (no manual navigation)

### Android (Expo Go)
- [ ] **Test 1-7** on Android device/emulator
- [ ] Chrome Custom Tab opens for OAuth
- [ ] Smooth return to app

---

## 🐛 Common Issues & Debugging

### Issue: "No authorization code received"
**Cause:** Redirect URL mismatch  
**Fix:** Verify `https://auth.expo.io/@mgane/olive-expo` is in Supabase Redirect URLs

### Issue: "OAuth initialization error"
**Cause:** Google provider not enabled in Supabase  
**Fix:** Enable Google in Supabase Dashboard → Authentication → Providers

### Issue: Browser doesn't close after sign-in
**Cause:** `returnUrl` mismatch in `AuthSession.startAsync`  
**Fix:** Already handled in `lib/googleOAuth.ts` (both `authUrl` and `returnUrl` set)

### Issue: "Session exchange error"
**Cause:** PKCE flow misconfiguration  
**Fix:** Ensure `skipBrowserRedirect: true` in `signInWithOAuth` options

---

## 🎯 Success Criteria

**All tests pass if:**
- ✅ 7/7 scenarios succeed on iOS
- ✅ 7/7 scenarios succeed on Android
- ✅ No console errors related to OAuth
- ✅ User data persists across app restarts
- ✅ Email/password login still works (no regression)

---

## 📊 Test Log Template

| Test | iOS Result | Android Result | Notes |
|------|-----------|----------------|-------|
| Test 1: Fresh Sign-Up | ⏳ | ⏳ | |
| Test 2: Returning User | ⏳ | ⏳ | |
| Test 3: Sign-Out | ⏳ | ⏳ | |
| Test 4: Modal Flow | ⏳ | ⏳ | |
| Test 5: Cancel Flow | ⏳ | ⏳ | |
| Test 6: Network Error | ⏳ | ⏳ | |
| Test 7: Concurrent Accounts | ⏳ | ⏳ | |

Legend: ⏳ Pending | ✅ Pass | ❌ Fail

---

**Happy Testing! 🚀**

