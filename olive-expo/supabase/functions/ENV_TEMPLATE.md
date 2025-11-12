# Environment Variables Template

For local development, create a `.env.local` file in the `supabase/` directory:

```bash
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-proj-xxxxx

# OpenAI Models (Optional)
OPENAI_CHAT_MODEL=gpt-5-nano
OPENAI_EMBED_MODEL=text-embedding-3-small
```

Then run functions locally:

```bash
supabase functions serve --env-file supabase/.env.local
```

For production, set secrets via Supabase Dashboard or CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx
supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano
```
