# Supabase Migration Guide - Chat Schema

## Overview

This migration adds complete chat persistence infrastructure to Olive:

- ✅ Conversations with user ownership
- ✅ Messages with role-based content
- ✅ Conversation summaries (short-term memory)
- ✅ User memories (long-term facts)
- ✅ User preferences (JSONB storage)
- ✅ Secure RPC functions for safe operations
- ✅ Row Level Security (RLS) on all tables

## How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Open your Supabase project**

   - Go to [supabase.com](https://supabase.com)
   - Navigate to your Olive project

2. **Open SQL Editor**

   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy & Run Migration**

   - Open: `olive-expo/supabase/migrations/20251112000000_chat_schema.sql`
   - Copy the entire contents
   - Paste into the SQL editor
   - Click "Run" or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Scroll down to see verification query results showing:
     - 5 new tables created
     - RLS enabled on all tables
     - Policies created for each table
     - 2 RPC functions created

### Option 2: Supabase CLI (Advanced)

If you have the Supabase CLI installed:

```bash
# From the olive-expo directory
cd olive-expo

# Link to your project (first time only)
supabase link --project-ref <your-project-ref>

# Run the migration
supabase db push
```

## Verification Steps

After running the migration, verify in Supabase Dashboard:

### 1. Check Tables

Go to **Table Editor** → You should see:

- ✅ `conversations`
- ✅ `messages`
- ✅ `conversation_summaries`
- ✅ `user_memories`
- ✅ `user_preferences`

### 2. Check RLS Policies

For each table, click the table name → RLS toggle should be **ON** (green).

Click "View Policies" to see:

- **conversations**: 4 policies (select, insert, update, delete)
- **messages**: 4 policies (select, insert, update, delete)
- **conversation_summaries**: 3 policies (select, insert, update)
- **user_memories**: 3 policies (select, insert, update)
- **user_preferences**: 3 policies (select, insert, update)

### 3. Test RPC Functions

In SQL Editor, test the functions:

```sql
-- Test creating a conversation
SELECT public.create_conversation('My First Chat', 'gpt-4o');

-- Note the returned conversation ID, then test adding a message
-- Replace <conversation-id> with the UUID from above
SELECT public.add_message(
  '<conversation-id>'::uuid,
  'user',
  'Hello, Olive!',
  0,
  0
);
```

If both queries succeed, your migration is working! 🎉

## Schema Details

### Conversations Table

```sql
conversations (
  id UUID PRIMARY KEY,
  user_id UUID (references auth.users),
  title TEXT,
  model TEXT DEFAULT 'gpt-4o',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Messages Table

```sql
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID (references conversations),
  user_id UUID (references auth.users),
  role TEXT CHECK IN ('system', 'user', 'assistant', 'tool'),
  content TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TIMESTAMPTZ
)
```

### Conversation Summaries Table

```sql
conversation_summaries (
  conversation_id UUID PRIMARY KEY (references conversations),
  summary TEXT,
  updated_at TIMESTAMPTZ
)
```

### User Memories Table

```sql
user_memories (
  id UUID PRIMARY KEY,
  user_id UUID (references auth.users),
  fact TEXT,
  source_message_id UUID,
  confidence REAL DEFAULT 0.7,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

### User Preferences Table

```sql
user_preferences (
  user_id UUID PRIMARY KEY (references auth.users),
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ
)
```

## Security Model

### Row Level Security (RLS)

All tables use **owner-only** RLS policies:

1. **Direct user ownership** (`conversations`, `messages`, `user_memories`, `user_preferences`):

   - Users can only access rows where `user_id = auth.uid()`

2. **Indirect ownership** (`conversation_summaries`):
   - Users can only access summaries for conversations they own
   - Uses `EXISTS` subquery to check conversation ownership

### RPC Functions (Security Definer)

Two secure server-side functions:

1. **`create_conversation(p_title, p_model)`**

   - Automatically sets `user_id` from `auth.uid()`
   - Prevents users from creating conversations for others

2. **`add_message(p_conversation_id, p_role, p_content, p_tokens_in, p_tokens_out)`**
   - Validates user owns the conversation before inserting
   - Automatically sets correct `user_id`

## Performance Optimizations

### Indexes Created

```sql
-- Conversations: Fast lookup by user + time ordering
idx_conversations_user_id_created ON (user_id, created_at DESC)

-- Messages: Fast lookup by conversation + time ordering
idx_messages_conversation_time ON (conversation_id, created_at)

-- Memories: Fast lookup by user + freshness
idx_user_memories_user_time ON (user_id, last_refreshed_at DESC)
```

### Auto-Update Triggers

Tables with `updated_at` timestamps auto-update on changes:

- `conversations`
- `conversation_summaries`
- `user_preferences`

## Troubleshooting

### Issue: "relation already exists"

**Solution**: This is safe to ignore. The migration is idempotent and uses `IF NOT EXISTS`.

### Issue: "permission denied"

**Solution**:

1. Make sure you're logged in to Supabase
2. Check you have admin access to the project
3. Try running in SQL Editor (has elevated permissions)

### Issue: "policy already exists"

**Solution**: Safe to ignore. The migration drops existing policies before recreating them.

### Issue: RPC functions not showing up

**Solution**:

1. Check verification query at end of migration
2. Run manually:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public'
   AND routine_name IN ('create_conversation', 'add_message');
   ```

## Reference

- **Migration File**: `olive-expo/supabase/migrations/20251112000000_chat_schema.sql`
- **Supabase Docs**: https://supabase.com/docs/guides/database
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **RPC Functions**: https://supabase.com/docs/guides/database/functions

---

**Need Help?**

- Review the migration file for detailed inline comments
- Check Supabase Dashboard → Database → Roles to ensure proper permissions
- Test RPC functions with the SQL snippets above
