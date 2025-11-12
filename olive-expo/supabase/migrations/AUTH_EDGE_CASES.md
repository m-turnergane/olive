# Authentication Edge Cases - Olive

This document explains how Olive handles edge cases with mixed authentication methods (email/password vs Google OAuth).

---

## Edge Case 1: Google Sign-Up → Email Sign-In Attempt

**Scenario:**

1. User signs up with Google OAuth (`m.turnergane@gmail.com`)
2. Later, user tries to sign in with email/password using same email

**What Happens:**

- ❌ Supabase rejects the login (no password exists for Google OAuth users)
- ✅ Our app detects this and shows helpful error:
  - **"This email is registered with Google. Please use 'Continue with Google', or sign in with Google and then add a password in Settings."**

**Implementation:**

- `signInWithEmail()` in `supabaseService.ts` checks if email exists in database when login fails
- If user exists but login failed = OAuth user trying to use password
- Custom error message guides user to correct login method or to add password via Settings

---

## Edge Case 2: Email Sign-Up → Google Sign-In Attempt

**Scenario:**

1. User signs up with email/password (`m.turnergane@gmail.com`)
2. Later, user tries to sign in with Google OAuth using same email

**What Happens:**

- ✅ **Supabase automatically links the accounts** (default behavior)
- User can now log in with either method:
  - Email/password (original method) ✅
  - Google OAuth (newly linked) ✅
- Both login methods access the same user account

**Note:** Once linked, the user has both authentication methods available.

---

## Edge Case 3: Google Sign-Up → Email Sign-Up Attempt (Same Email)

**Scenario:**

1. User signs up with Google OAuth (`m.turnergane@gmail.com`)
2. Later, user tries to sign up with email/password using same email

**What Happens:**

- ❌ App detects existing Google account before attempting signup
- ✅ Shows helpful error message:
  - **"This email is registered with Google. Please use 'Continue with Google', or sign in with Google and then add a password in Settings."**
- Prevents RLS violations and duplicate account creation attempts

**Implementation:**

- `signUpWithEmail()` checks if email exists in users table before signup
- If email exists and signup fails, provides Google account guidance
- User can add password via Settings → Security after signing in with Google

---

## Edge Case 4: Email Sign-Up → Email Sign-Up Attempt (Duplicate)

**Scenario:**

1. User signs up with email/password (`m.turnergane@gmail.com`)
2. Later, user tries to sign up again with same email

**What Happens:**

- ❌ App detects existing account and shows: `"This email is already registered. Please sign in instead."`
- Prevents duplicate signup attempts
- User should use "Sign In" instead of "Sign Up"

---

## Edge Case 5: Google Sign-Up → Google Sign-In Attempt (Duplicate)

**Scenario:**

1. User signs up with Google OAuth (`m.turnergane@gmail.com`)
2. Later, user signs in with Google OAuth again

**What Happens:**

- ✅ Works perfectly - user logs in to existing account
- No duplicate user created
- Supabase recognizes existing OAuth identity

---

## Edge Case 6: Google User Adds Password Authentication

**Scenario:**

1. User signs up with Google OAuth (`m.turnergane@gmail.com`)
2. User wants to also be able to sign in with email/password

**What Happens:**

- ✅ User signs in with Google
- ✅ User navigates to Settings → Security
- ✅ User sets a password via "Set Password"
- ✅ User can now sign in with either:
  - Google OAuth ✅
  - Email/password ✅

**Implementation:**

- `setPassword()` function in `supabaseService.ts` uses `supabase.auth.updateUser({ password })`
- Settings page shows password status and allows setting/updating password
- Once password is set, user has both authentication methods available

---

## Edge Case 7: Different Emails, Same Person

**Scenario:**

- User signs up with Google using `m.turnergane@gmail.com`
- User signs up with email/password using `m.turner@work.com`

**What Happens:**

- Creates **two separate accounts** (different emails = different users)
- Each account has its own:
  - User profile
  - Conversation history
  - Settings

**Future Enhancement:** Could add email linking/merging feature if needed.

---

## Implementation Summary

### Protected Scenarios ✅

| Scenario                       | Protection        | Error Message                                                                                                                          |
| ------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Google user tries email login  | Custom error      | "This email is registered with Google. Please use 'Continue with Google', or sign in with Google and then add a password in Settings." |
| Google user tries email signup | Pre-signup check  | "This email is registered with Google. Please use 'Continue with Google', or sign in with Google and then add a password in Settings." |
| Duplicate email signup         | Pre-signup check  | "This email is already registered. Please sign in instead."                                                                            |
| Invalid credentials            | Supabase built-in | "Invalid login credentials"                                                                                                            |

### Allowed Scenarios ✅

| Scenario                       | Behavior                               |
| ------------------------------ | -------------------------------------- |
| Google sign-in (existing user) | Logs in to existing account            |
| Email sign-in (existing user)  | Logs in to existing account            |
| Email user adds Google         | Accounts linked automatically          |
| Google user adds password      | Set password in Settings → Security    |
| User updates password          | Change password in Settings → Security |

---

## Supabase Configuration

**Account Linking:**

- **Enabled by default** in Supabase
- Location: Dashboard → Authentication → Providers → "Auto-confirm users"
- When enabled: Same email across providers = linked accounts

**RLS Policies:**

- Ensure users only access their own data
- See `supabase-setup.sql` for policy definitions

---

## Testing Checklist

- [ ] Sign up with Google → Try email login → See helpful error
- [ ] Sign up with Google → Try email signup → See helpful error
- [ ] Sign up with Google → Sign in with Google → Add password in Settings → Sign in with email/password
- [ ] Sign up with email → Sign in with Google → Both methods work
- [ ] Sign up with email → Try signing up again → See error
- [ ] Sign in with wrong password → See standard error
- [ ] Sign in with non-existent email → See standard error
- [ ] Google user sets password → Can sign in with email/password
- [ ] User updates password → New password works

---

## Password Management

**Settings → Security:**

- Shows current password authentication status
- Allows Google OAuth users to set a password
- Allows all users to update their password
- Validates password requirements (minimum 6 characters)
- Confirms password before setting/updating

**Implementation:**

- `setPassword()` - Sets password for users without password auth (Google users)
- `updatePassword()` - Updates password for existing password users
- `hasPasswordAuth()` - Checks if user has password authentication enabled
- UI in `components/SettingsPage.tsx` with Security section

---

## Future Enhancements

1. **Password Reset for Email Users:**

   - Add "Forgot Password" flow
   - Use Supabase's built-in password reset

2. **Profile Linking Page:**

   - Show which auth methods are connected
   - Allow users to link/unlink providers
   - Display authentication methods in user profile

3. **OAuth Provider Expansion:**

   - Add Apple Sign-In
   - Add Facebook Login
   - Add GitHub (for developers)

4. **Account Merging:**

   - Manual email verification to merge accounts
   - Useful if user creates multiple accounts accidentally

5. **Password Strength Indicator:**
   - Show password strength as user types
   - Enforce stronger password requirements

---

## Related Files

- `services/supabaseService.ts` - Auth functions with edge case handling and password management
- `components/LoginScreen.tsx` - UI for login/signup
- `components/SettingsPage.tsx` - Settings UI with Security section for password management
- `supabase-setup.sql` - Database schema and RLS policies
- `App.tsx` - Session management and routing

---

**Last Updated:** December 2024  
**Version:** 2.0.0
