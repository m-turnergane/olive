// supabase/functions/gate/index.ts
// Cheap scope classifier: determines if user message is within Olive's support scope

// @ts-ignore - Supabase client from ESM
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// @ts-ignore - Deno is available in Supabase Edge Runtime
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
// @ts-ignore
const OPENAI_CHAT_MODEL = Deno.env.get('OPENAI_CHAT_MODEL') ?? 'gpt-5-nano'; // GPT-5 nano for scope classification

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

    const { user_text } = await req.json();

    // Authenticate user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    if (!user_text || typeof user_text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid user_text' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Use OpenAI to classify the message scope
    const classificationPrompt = [
      {
        role: 'system',
        content: `You are a scope classifier for Olive, an emotional support and mental wellbeing AI companion.

Your task: Classify if a user message is WITHIN or OUT OF scope.

IN SCOPE (respond with "in"):
- Emotional support (stress, anxiety, sadness, loneliness, anger, etc.)
- Mental wellbeing and self-care
- Coping strategies and mindfulness
- Relationship concerns (interpersonal, not legal advice)
- Work stress and burnout
- General life challenges and decision-making
- Journaling, reflection, and personal growth
- Casual conversation and check-ins
- Questions about Olive's capabilities

OUT OF SCOPE (respond with "out"):
- Medical diagnosis or treatment advice
- Prescription medication questions
- Legal advice or representation
- Financial investment or trading advice
- Tax preparation or accounting
- Emergency situations requiring immediate professional help
- Requests to perform actions outside conversation (e.g., "book me an appointment")

Respond with ONLY one word: "in" or "out"

Examples:
User: "I'm feeling really anxious about my presentation tomorrow"
Assistant: in

User: "Should I invest in cryptocurrency?"
Assistant: out

User: "What medication should I take for depression?"
Assistant: out

User: "How can I set better boundaries with my coworker?"
Assistant: in

User: "Can you review this contract for me?"
Assistant: out

User: "I'm having trouble sleeping because of stress"
Assistant: in`,
      },
      {
        role: 'user',
        content: user_text,
      },
    ];

    // Call OpenAI for classification
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_CHAT_MODEL,
        messages: classificationPrompt,
        temperature: 0.1, // Very low temperature for consistent classification
        max_tokens: 5,
      }),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Classification failed', scope: 'in' }), // Default to 'in' on error
        { status: 200, headers: corsHeaders } // Return 200 so client can proceed
      );
    }

    const openaiData = await openaiRes.json();
    const classification = openaiData.choices?.[0]?.message?.content?.trim().toLowerCase() ?? 'in';

    // Normalize response to 'in' or 'out'
    const scope = classification.includes('out') ? 'out' : 'in';

    console.log(`Scope classification for "${user_text.substring(0, 50)}...": ${scope}`);

    return new Response(
      JSON.stringify({
        scope,
        message: scope === 'in'
          ? 'Message is within support scope'
          : 'Message appears to be outside primary support scope',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('Gate error:', e);
    // Default to 'in' on errors to avoid blocking legitimate support requests
    return new Response(
      JSON.stringify({ scope: 'in', error: String(e) }),
      { status: 200, headers: corsHeaders }
    );
  }
});

