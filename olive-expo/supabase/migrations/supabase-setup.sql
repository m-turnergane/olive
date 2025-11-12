-- ============================================================================
-- Olive - Supabase Database Setup (Idempotent - Safe to Run Multiple Times)
-- ============================================================================

-- 1. Create the users table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for user isolation (Canonical Pattern)
-- Drop existing policies first, then recreate (safe to run multiple times)

DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "read_own_profile" ON public.users;
CREATE POLICY "read_own_profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "insert_own_profile" ON public.users;
CREATE POLICY "insert_own_profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "update_own_profile" ON public.users;
CREATE POLICY "update_own_profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;
DROP POLICY IF EXISTS "delete_own_profile" ON public.users;
CREATE POLICY "delete_own_profile"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 4. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to call the function on update
DROP TRIGGER IF EXISTS set_updated_at ON public.users;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON public.users(created_at);

-- ============================================================================
-- 7. Create security-definer RPC function for safe user upsert
-- This allows clients to safely create/update user profiles without RLS violations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_upsert(
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL
) RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.users;
BEGIN
  INSERT INTO public.users (id, email, name, photo_url)
  VALUES (auth.uid(), p_email, p_name, p_photo_url)
  ON CONFLICT (id) DO UPDATE SET
    -- Keep existing non-empty name unless the row was blank
    name = COALESCE(NULLIF(public.users.name, ''), excluded.name),
    photo_url = COALESCE(excluded.photo_url, public.users.photo_url),
    updated_at = NOW()
  RETURNING * INTO u;
  RETURN u;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.user_upsert(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 8. Create a function to handle new user signup (Trigger-based)
-- This ensures a user record is created when auth.users is created
-- Note: The trigger handles initial creation, while user_upsert() can be used
-- for manual updates. Both can coexist safely.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Verification Queries (optional - run these to verify setup)
-- ============================================================================

-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'users';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- Check policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- ============================================================================
-- Done! Your Supabase database is now ready for Olive
-- ============================================================================

