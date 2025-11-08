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
  - **"This email is registered with Google. Please use 'Continue with Google' to sign in."**

**Implementation:**
- `signInWithEmail()` in `supabaseService.ts` checks if email exists in database when login fails
- If user exists but login failed = OAuth user trying to use password
- Custom error message guides user to correct login method

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

## Edge Case 3: Email Sign-Up → Email Sign-Up Attempt (Duplicate)

**Scenario:**
1. User signs up with email/password (`m.turnergane@gmail.com`)
2. Later, user tries to sign up again with same email

**What Happens:**
- ❌ Supabase rejects: `"User already registered"`
- Standard Supabase error, no custom handling needed
- User should use "Sign In" instead of "Sign Up"

---

## Edge Case 4: Google Sign-Up → Google Sign-In Attempt (Duplicate)

**Scenario:**
1. User signs up with Google OAuth (`m.turnergane@gmail.com`)
2. Later, user signs in with Google OAuth again

**What Happens:**
- ✅ Works perfectly - user logs in to existing account
- No duplicate user created
- Supabase recognizes existing OAuth identity

---

## Edge Case 5: Different Emails, Same Person

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

| Scenario | Protection | Error Message |
|----------|-----------|---------------|
| Google user tries email login | Custom error | "This email is registered with Google..." |
| Duplicate email signup | Supabase built-in | "User already registered" |
| Invalid credentials | Supabase built-in | "Invalid login credentials" |

### Allowed Scenarios ✅

| Scenario | Behavior |
|----------|----------|
| Google sign-in (existing user) | Logs in to existing account |
| Email sign-in (existing user) | Logs in to existing account |
| Email user adds Google | Accounts linked automatically |
| Google user adds email | Not supported (no password to set) |

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
- [ ] Sign up with email → Sign in with Google → Both methods work
- [ ] Sign up with email → Try signing up again → See error
- [ ] Sign in with wrong password → See standard error
- [ ] Sign in with non-existent email → See standard error

---

## Future Enhancements

1. **Password Reset for Email Users:**
   - Add "Forgot Password" flow
   - Use Supabase's built-in password reset

2. **Profile Linking Page:**
   - Show which auth methods are connected
   - Allow users to link/unlink providers

3. **OAuth Provider Expansion:**
   - Add Apple Sign-In
   - Add Facebook Login
   - Add GitHub (for developers)

4. **Account Merging:**
   - Manual email verification to merge accounts
   - Useful if user creates multiple accounts accidentally

---

## Related Files

- `services/supabaseService.ts` - Auth functions with edge case handling
- `components/LoginScreen.tsx` - UI for login/signup
- `supabase-setup.sql` - Database schema and RLS policies
- `App.tsx` - Session management and routing

---

**Last Updated:** Nov 7, 2025  
**Version:** 1.0.0


