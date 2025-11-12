# Supabase Setup Guide for Olive

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: Olive (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## Step 2: Run SQL Setup

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `supabase-setup.sql`
4. Paste into the SQL editor
5. Click "Run" or press Ctrl+Enter
6. Verify success - you should see "Success. No rows returned"

## Step 3: Get Your Credentials

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** tab
3. Copy these values:

```env
# Project URL
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co

# Anon/Public Key (under "Project API keys")
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 4: Update Your .env File

Open `/Users/m_gane/olivev2/olive/olive-expo/.env` and update:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth (optional - for later)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id

# Google Gemini API Key (required for chat)
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
```

## Step 5: Enable Google OAuth (Optional)

If you want Google sign-in to work:

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to configure
3. Enable the provider
4. Add your Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `https://your-project.supabase.co/auth/v1/callback`
     - `olive://auth/callback` (for mobile deep linking)
   - Copy Client ID and Client Secret to Supabase
5. Add the Google Client ID to your `.env` file

## Step 6: Test Authentication

1. Make sure your `.env` file is updated with Supabase credentials
2. Start your Expo app: `npm start`
3. Try signing up with email/password
4. Check Supabase dashboard:
   - Go to **Authentication** → **Users** to see new user
   - Go to **Table Editor** → **users** to see user record

## Verification Checklist

- [ ] Supabase project created
- [ ] SQL schema executed successfully
- [ ] users table visible in Table Editor
- [ ] RLS policies visible in Table Editor → users table → "RLS disabled" toggle (should be enabled)
- [ ] .env file updated with correct credentials
- [ ] Test signup works in app
- [ ] New users appear in Authentication tab
- [ ] New users appear in users table
- [ ] Google OAuth configured (optional)

## Database Schema Created

The SQL script creates:

✅ **users table** with fields:

- `id` (UUID, primary key, linked to auth.users)
- `email` (text, unique, not null)
- `name` (text)
- `photo_url` (text)
- `created_at` (timestamp, auto-generated)
- `updated_at` (timestamp, auto-updated)

✅ **Row Level Security (RLS)** enabled with policies:

- Users can only view their own data
- Users can only insert their own data
- Users can only update their own data
- Users can only delete their own data

✅ **Automatic triggers**:

- Auto-update `updated_at` on record changes
- Auto-create user record when auth user is created

✅ **Performance indexes**:

- Email index for fast lookups
- Created_at index for sorting

## Troubleshooting

### Issue: "relation 'users' does not exist"

- **Solution**: Make sure you ran the SQL script in Step 2

### Issue: "permission denied for table users"

- **Solution**: Check that RLS policies are created correctly. Re-run the SQL script.

### Issue: "Cannot find module 'EXPO_PUBLIC_SUPABASE_URL'"

- **Solution**: Make sure .env file exists and is properly formatted. Restart Expo dev server.

### Issue: Google OAuth not working

- **Solution**:
  1. Check Google Cloud Console credentials
  2. Verify redirect URIs are correct
  3. Make sure Google provider is enabled in Supabase
  4. Deep linking might need additional native configuration

## Security Notes

🔒 **Important Security Practices:**

1. **Never commit .env file** - It's in .gitignore, keep it that way
2. **Use Row Level Security** - Already enabled in the SQL script
3. **Anon key is safe to expose** - It's designed for client-side use
4. **Service role key should NEVER be in client code** - We only use anon key
5. **Validate all inputs** - Already done in LoginScreen forms

## Chat Persistence Migration

After completing the basic setup above, add chat persistence with our migration:

**📁 Migration File**: `migrations/20251112000000_chat_schema.sql`

**📖 Full Guide**: See `MIGRATION_GUIDE.md` in this directory for detailed instructions

**Quick Steps**:

1. Go to Supabase Dashboard → SQL Editor → New Query
2. Copy contents of `migrations/20251112000000_chat_schema.sql`
3. Paste and run (Ctrl+Enter or Cmd+Enter)
4. Verify success (should see verification query results)

**What it adds**:

- ✅ `conversations` table (chat sessions)
- ✅ `messages` table (chat history)
- ✅ `conversation_summaries` table (short-term memory)
- ✅ `user_memories` table (long-term facts)
- ✅ `user_preferences` table (user settings in JSONB)
- ✅ RPC functions: `create_conversation()`, `add_message()`
- ✅ Full RLS policies + indexes on all tables

## Next Steps

Once setup is complete, you can:

1. ✅ Test signup/login functionality
2. ✅ Start using the chat feature (needs Gemini API key)
3. ✅ Customize the users table (add more fields if needed)
4. ✅ **NEW**: Run chat persistence migration (see above)
5. ⏳ Implement chat streaming edge functions
6. ⏳ Wire up client-side chat service

---

**Need Help?**

- Supabase Docs: https://supabase.com/docs
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- **Chat Migration**: See `MIGRATION_GUIDE.md` in this directory
