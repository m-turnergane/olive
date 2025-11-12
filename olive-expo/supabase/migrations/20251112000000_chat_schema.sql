-- ============================================================================
-- Olive - Chat Persistence Schema Migration
-- Created: 2025-11-12
-- Description: Implements conversations, messages, summaries, memories, and preferences
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- ============================================================================
-- 1. CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  model TEXT NOT NULL DEFAULT 'gpt-5-nano',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create owner-only RLS policies
DROP POLICY IF EXISTS "conv_select_own" ON public.conversations;
CREATE POLICY "conv_select_own" 
  ON public.conversations
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_insert_own" ON public.conversations;
CREATE POLICY "conv_insert_own" 
  ON public.conversations
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_update_own" ON public.conversations;
CREATE POLICY "conv_update_own" 
  ON public.conversations
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_delete_own" ON public.conversations;
CREATE POLICY "conv_delete_own" 
  ON public.conversations
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_created 
  ON public.conversations (user_id, created_at DESC);

-- ============================================================================
-- 2. MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create owner-only RLS policies
DROP POLICY IF EXISTS "msg_select_own" ON public.messages;
CREATE POLICY "msg_select_own" 
  ON public.messages
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "msg_insert_own" ON public.messages;
CREATE POLICY "msg_insert_own" 
  ON public.messages
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "msg_update_own" ON public.messages;
CREATE POLICY "msg_update_own" 
  ON public.messages
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "msg_delete_own" ON public.messages;
CREATE POLICY "msg_delete_own" 
  ON public.messages
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time 
  ON public.messages (conversation_id, created_at);

-- ============================================================================
-- 3. CONVERSATION SUMMARIES TABLE (short-term memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  conversation_id UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Create owner-only RLS policies (via conversation ownership)
DROP POLICY IF EXISTS "sum_select_own" ON public.conversation_summaries;
CREATE POLICY "sum_select_own" 
  ON public.conversation_summaries
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS(
      SELECT 1 
      FROM public.conversations c 
      WHERE c.id = conversation_id 
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sum_upsert_own" ON public.conversation_summaries;
CREATE POLICY "sum_upsert_own" 
  ON public.conversation_summaries
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS(
      SELECT 1 
      FROM public.conversations c 
      WHERE c.id = conversation_id 
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sum_update_own" ON public.conversation_summaries;
CREATE POLICY "sum_update_own" 
  ON public.conversation_summaries
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS(
      SELECT 1 
      FROM public.conversations c 
      WHERE c.id = conversation_id 
      AND c.user_id = auth.uid()
    )
  ) 
  WITH CHECK (
    EXISTS(
      SELECT 1 
      FROM public.conversations c 
      WHERE c.id = conversation_id 
      AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. USER MEMORIES TABLE (long-term memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  source_message_id UUID,  -- Optional reference to messages.id
  confidence REAL NOT NULL DEFAULT 0.7,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

-- Create owner-only RLS policies
DROP POLICY IF EXISTS "mem_select_own" ON public.user_memories;
CREATE POLICY "mem_select_own" 
  ON public.user_memories
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mem_insert_own" ON public.user_memories;
CREATE POLICY "mem_insert_own" 
  ON public.user_memories
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mem_update_own" ON public.user_memories;
CREATE POLICY "mem_update_own" 
  ON public.user_memories
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_memories_user_time 
  ON public.user_memories (user_id, last_refreshed_at DESC);

-- ============================================================================
-- 5. USER PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create owner-only RLS policies
DROP POLICY IF EXISTS "prefs_select_own" ON public.user_preferences;
CREATE POLICY "prefs_select_own" 
  ON public.user_preferences
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "prefs_upsert_own" ON public.user_preferences;
CREATE POLICY "prefs_upsert_own" 
  ON public.user_preferences
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "prefs_update_own" ON public.user_preferences;
CREATE POLICY "prefs_update_own" 
  ON public.user_preferences
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================================================

-- Reuse existing handle_updated_at function if it exists, or create it
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to conversations
DROP TRIGGER IF EXISTS set_updated_at_conversations ON public.conversations;
CREATE TRIGGER set_updated_at_conversations
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to conversation_summaries
DROP TRIGGER IF EXISTS set_updated_at_summaries ON public.conversation_summaries;
CREATE TRIGGER set_updated_at_summaries
  BEFORE UPDATE ON public.conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to user_preferences
DROP TRIGGER IF EXISTS set_updated_at_preferences ON public.user_preferences;
CREATE TRIGGER set_updated_at_preferences
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. RPC FUNCTIONS (Secure server-side operations)
-- ============================================================================

-- Create a new conversation
CREATE OR REPLACE FUNCTION public.create_conversation(
  p_title TEXT DEFAULT NULL, 
  p_model TEXT DEFAULT 'gpt-5-nano'
)
RETURNS public.conversations
LANGUAGE SQL 
SECURITY DEFINER 
SET search_path = public 
AS $$
  INSERT INTO public.conversations (user_id, title, model)
  VALUES (auth.uid(), p_title, p_model)
  RETURNING *;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_conversation(TEXT, TEXT) TO authenticated;

-- Add a message to a conversation
CREATE OR REPLACE FUNCTION public.add_message(
  p_conversation_id UUID, 
  p_role TEXT, 
  p_content TEXT, 
  p_tokens_in INT DEFAULT 0, 
  p_tokens_out INT DEFAULT 0
)
RETURNS public.messages
LANGUAGE SQL 
SECURITY DEFINER 
SET search_path = public 
AS $$
  INSERT INTO public.messages (conversation_id, user_id, role, content, tokens_in, tokens_out)
  SELECT p_conversation_id, c.user_id, p_role, p_content, p_tokens_in, p_tokens_out
  FROM public.conversations c
  WHERE c.id = p_conversation_id 
  AND c.user_id = auth.uid()
  RETURNING *;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_message(UUID, TEXT, TEXT, INT, INT) TO authenticated;

-- ============================================================================
-- 8. OPTIONAL: Message Embeddings (Uncomment to enable pgvector support)
-- ============================================================================

-- Uncomment below if you want to use pgvector for semantic search
-- First enable the extension in Supabase dashboard or run:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- CREATE TABLE IF NOT EXISTS public.message_embeddings (
--   message_id UUID PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
--   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   embedding VECTOR(1536) NOT NULL
-- );

-- ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "emb_select_own" ON public.message_embeddings;
-- CREATE POLICY "emb_select_own" 
--   ON public.message_embeddings 
--   FOR SELECT 
--   TO authenticated 
--   USING (auth.uid() = user_id);

-- DROP POLICY IF EXISTS "emb_insert_own" ON public.message_embeddings;
-- CREATE POLICY "emb_insert_own" 
--   ON public.message_embeddings 
--   FOR INSERT 
--   TO authenticated 
--   WITH CHECK (auth.uid() = user_id);

-- CREATE INDEX IF NOT EXISTS idx_embedding_user 
--   ON public.message_embeddings (user_id);

-- ============================================================================
-- 9. VERIFICATION QUERIES (Optional - Run to verify setup)
-- ============================================================================

-- Check all new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'messages', 'conversation_summaries', 'user_memories', 'user_preferences')
ORDER BY table_name;

-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('conversations', 'messages', 'conversation_summaries', 'user_memories', 'user_preferences')
ORDER BY tablename;

-- Check policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('conversations', 'messages', 'conversation_summaries', 'user_memories', 'user_preferences')
ORDER BY tablename, policyname;

-- Check RPC functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('create_conversation', 'add_message')
ORDER BY routine_name;

-- ============================================================================
-- Chat persistence schema is ready.
-- Next steps: 
-- 1. Test creating a conversation: SELECT public.create_conversation('Test Chat');
-- 2. Test adding a message: SELECT public.add_message(<conv_id>, 'user', 'Hello!');
-- ============================================================================

