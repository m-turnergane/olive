// supabase/functions/summarize/index.ts
// Creates or updates rolling conversation summary for context compression

// @ts-ignore - Supabase client from ESM
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore - Deno is available in Supabase Edge Runtime
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
// @ts-ignore
const OPENAI_CHAT_MODEL = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-5-nano';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with user's JWT
    // @ts-ignore
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL')!,
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { conversation_id } = await req.json();

    // Authenticate user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Fetch conversation history (last 50 messages for summary)
    const { data: history, error: historyErr } = await supabase
      .from('messages')
      .select('role,content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (historyErr || !history || history.length === 0) {
      console.error('Error fetching history or no messages:', historyErr);
      return new Response(JSON.stringify({ ok: false, error: 'No messages to summarize' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Build summarization prompt
    const prompt = [
      {
        role: 'system',
        content: `You are a conversation summarizer for Olive, an emotional support AI companion.

Your task: Create a concise, factual summary of this conversation for context in future sessions.

Guidelines:
- Maximum 120 words
- Focus on key emotional themes, concerns, and user context
- Include any coping strategies discussed or found helpful
- Note significant life events or stressors mentioned
- Preserve user preferences (nickname, communication style, etc.)
- Keep it factual and non-judgmental
- DO NOT include sensitive PII beyond what's necessary for context
- Write in third person ("User discussed...", "They expressed...")

Example good summary:
"User (prefers 'Alex') discussed anxiety about upcoming job interview. Expressed fear of failure and imposter syndrome. Found box breathing technique helpful during practice session. Mentioned supportive partner who helps with affirmations. Prefers direct, practical advice over lengthy reassurance. Previous conversations covered work stress and boundary-setting with manager."`,
      },
      {
        role: 'user',
        content: `Summarize this conversation history:\n\n${JSON.stringify(history, null, 2)}`,
      },
    ];

    // Call OpenAI for summary
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_CHAT_MODEL,
        messages: prompt,
        temperature: 0.3, // Lower temperature for more consistent summaries
        max_tokens: 200,
      }),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error('OpenAI API error:', errorText);
      return new Response(JSON.stringify({ ok: false, error: 'OpenAI API error' }), {
        status: openaiRes.status,
        headers: corsHeaders,
      });
    }

    const openaiData = await openaiRes.json();
    const summary = openaiData.choices?.[0]?.message?.content?.trim() ?? '';

    if (!summary) {
      return new Response(JSON.stringify({ ok: false, error: 'Empty summary generated' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Upsert summary into conversation_summaries table
    const { error: upsertErr } = await supabase
      .from('conversation_summaries')
      .upsert({
        conversation_id,
        summary,
        updated_at: new Date().toISOString(),
      });

    if (upsertErr) {
      console.error('Error upserting summary:', upsertErr);
      return new Response(JSON.stringify({ ok: false, error: 'Failed to save summary' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log(`Summary updated for conversation ${conversation_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        summary,
        message_count: history.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('Summarize error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

