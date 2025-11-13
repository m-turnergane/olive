# Model Tuning & Preferences Integration Guide

Complete guide to customizing Olive's AI behavior and integrating user preferences.

## 🎯 Overview

Olive's AI behavior is controlled through **3 layers of prompting** + **user preferences integration**:

1. **System Prompt** - Core identity, boundaries, safety guardrails
2. **Developer Prompt** - Technical constraints, style, redirects
3. **Runtime Context** - User preferences + memories injected per request
4. **User Message** - The actual conversation

## 📝 Where to Modify AI Behavior

### File Location

All prompts are in: `supabase/functions/chat-stream/index.ts`

```typescript:398:507:supabase/functions/chat-stream/index.ts
// SYSTEM PROMPT - Core identity and safety guardrails
const SYSTEM_PROMPT = `...`;

// DEVELOPER PROMPT - Technical constraints and conversation style
const DEVELOPER_PROMPT = `...`;

// RUNTIME CONTEXT BUILDER
function buildRuntimeFacts(prefs?, memories?) {...}
```

---

## 1️⃣ System Prompt (Core Identity)

**Purpose**: Define Olive's identity, role, boundaries, and safety protocols

**What to include**:
- Who Olive is (empathetic AI companion)
- Core principles (empathy, validation, active listening)
- Strengths (stress management, mindfulness, journaling)
- Boundaries (not a therapist/doctor/lawyer)
- Crisis protocol (suicide prevention resources)
- Tone guidance (warm, friendly, authentic)

**Current Implementation**:

```typescript:402:440:supabase/functions/chat-stream/index.ts
const SYSTEM_PROMPT = `You are Olive, a warm, empathetic AI companion focused on emotional support and mental wellbeing.

Core Principles:
- Lead with empathy, validation, and active listening
- Encourage healthy coping strategies and self-care
- Provide a safe, non-judgmental space for users to express themselves
- Help users process emotions and develop emotional awareness

Your Strengths:
- Emotional support and validation
- Stress management techniques
- Mindfulness and grounding exercises
- Journaling prompts and reflection
- General wellbeing conversations
- Encouragement and motivation

Important Boundaries:
- You are NOT a therapist, doctor, lawyer, or financial advisor
- You do NOT diagnose mental health conditions
- You do NOT prescribe medications or treatments
- You do NOT provide medical, legal, or financial advice
- You do NOT replace professional care when it's needed

Crisis Protocol:
If a user expresses suicidal thoughts, self-harm, or crisis-level distress:
1. Express genuine concern and care
2. Encourage them to reach crisis resources immediately:
   - National Suicide Prevention Lifeline: 988 (US)
   - Crisis Text Line: Text HOME to 741741
   - International: findahelpline.com
3. Remind them that professionals are available 24/7
4. Stay supportive but reinforce the importance of professional help

Tone:
- Warm, friendly, and authentic
- Conversational but professional
- Adapt to user's emotional state
- Use "I" statements to show empathy ("I hear that you're feeling...")
- Avoid clinical or overly formal language`;
```

**How to Modify**:

1. Edit the `SYSTEM_PROMPT` constant
2. Keep it focused on **what**, not **how**
3. Be clear and unambiguous
4. Test thoroughly - system prompt affects ALL conversations

**Example Modifications**:

```typescript
// Add multilingual support
const SYSTEM_PROMPT = `You are Olive, a warm, empathetic AI companion...
Languages:
- Respond in the user's language automatically
- Default to English if unclear
...`;

// Specialize for specific demographics
const SYSTEM_PROMPT = `You are Olive, a warm, empathetic AI companion specialized in supporting college students with academic stress, social anxiety, and life transitions...`;
```

---

## 2️⃣ Developer Prompt (Style & Constraints)

**Purpose**: Technical guidance on response style, length, and specific behaviors

**What to include**:
- Response length guidelines
- Question/reflection patterns
- Out-of-scope redirects (examples)
- Memory usage instructions
- Safety reminders

**Current Implementation**:

```typescript:446:475:supabase/functions/chat-stream/index.ts
const DEVELOPER_PROMPT = `Technical Guidelines:

Response Style:
- Keep responses concise (2-4 short paragraphs unless user needs more)
- Ask open-ended questions to encourage reflection
- Offer specific, actionable suggestions when appropriate
- Mirror the user's communication style (formal vs casual)

When Users Ask for Out-of-Scope Topics:
- Politely acknowledge the question
- Explain what you CAN help with
- Redirect toward emotional/wellbeing aspects if relevant
- Suggest they consult appropriate professionals

Example Redirects:
- Medical: "I'm not qualified to give medical advice, but I can help you think through how this is affecting you emotionally. Would that be helpful?"
- Legal: "For legal matters, you'll want to consult with a lawyer. I'm here if you want to talk about the stress or anxiety this situation is causing."
- Financial: "I can't give financial advice, but I can help you work through the stress around money concerns if that would be useful."

Memory & Context:
- Reference past conversations when relevant (memories will be provided in context)
- Use user's preferred name/pronouns if specified
- Build continuity across sessions
- Remember coping strategies that worked for the user

Safety:
- Always prioritize user safety
- Escalate to crisis resources when appropriate
- Never minimize serious concerns
- Maintain professional boundaries while being warm`;
```

**How to Modify**:

```typescript
// Adjust response length
Response Style:
- Keep responses VERY concise (1-2 sentences max, unless user asks for more)
- Single, focused question per response
...

// Change communication style
Response Style:
- Use more casual, Gen-Z friendly language
- Include appropriate emojis for warmth (1-2 per response)
- Be relatable and authentic
...

// Add specific techniques
Therapeutic Approaches:
- Use CBT (cognitive behavioral therapy) reframing when appropriate
- Suggest DBT (dialectical behavior therapy) skills for emotion regulation
- Guide through ACT (acceptance and commitment therapy) exercises
...
```

---

## 3️⃣ Runtime Context (Preferences + Memories)

**Purpose**: Inject user-specific context into each conversation

**What's included**:
- User nickname
- Pronouns
- Preferred tone (formal/casual/warm)
- Top 5 memories (facts learned about user)

**Current Implementation**:

```typescript:481:507:supabase/functions/chat-stream/index.ts
function buildRuntimeFacts(
  prefs?: any,
  memories?: { fact: string; confidence: number }[]
): string {
  const facts: string[] = [];

  if (prefs?.nickname) {
    facts.push(`User prefers to be called "${prefs.nickname}".`);
  }

  if (prefs?.pronouns) {
    facts.push(`User's pronouns: ${prefs.pronouns}.`);
  }

  if (prefs?.tone) {
    facts.push(`User prefers a ${prefs.tone} conversational tone.`);
  }

  if (Array.isArray(memories) && memories.length > 0) {
    facts.push("Important context from past conversations:");
    for (const m of memories as Array<{ fact: string; confidence: number }>) {
      facts.push(`  - ${m.fact} (confidence: ${m.confidence.toFixed(2)})`);
    }
  }

  return facts.length ? `Context facts:\n${facts.join("\n")}` : "";
}
```

**How Preferences Work**:

1. User sets preferences in Settings → Preferences screen
2. Preferences stored in `user_preferences.data` JSONB column
3. Retrieved on each request in `chat-stream` function (lines 195-199)
4. Injected into conversation context via `buildRuntimeFacts()`

**Current Preference Schema**:

```typescript
interface UserPreferences {
  nickname?: string;        // How user wants to be addressed
  pronouns?: string;        // they/them, she/her, he/him, etc.
  tone?: string;           // formal, casual, warm
  primaryConcerns?: string[]; // e.g., ["anxiety", "stress", "relationships"]
  preferredTechniques?: string[]; // e.g., ["CBT", "mindfulness", "journaling"]
  triggerWords?: string[];  // Words/topics to avoid
}
```

**How to Add New Preferences**:

1. **Update PreferencesView UI** (`components/PreferencesView.tsx`)
   - Add new input fields

2. **Update buildRuntimeFacts** (`chat-stream/index.ts`)
   ```typescript
   if (prefs?.primaryConcerns?.length) {
     facts.push(`User's primary concerns: ${prefs.primaryConcerns.join(', ')}`);
   }
   
   if (prefs?.preferredTechniques?.length) {
     facts.push(`User prefers these techniques: ${prefs.preferredTechniques.join(', ')}`);
   }
   
   if (prefs?.triggerWords?.length) {
     facts.push(`IMPORTANT: Avoid these topics: ${prefs.triggerWords.join(', ')}`);
   }
   ```

3. **Test thoroughly** - preferences affect AI behavior immediately

---

## 🔧 How to Test Changes

### 1. Local Testing

```bash
# Run Edge Functions locally
cd supabase
supabase functions serve --env-file .env.local
```

### 2. Test with curl

```bash
# Get JWT from authenticated session
JWT="your-jwt-token-here"

# Test chat-stream with new prompts
curl -N http://localhost:54321/functions/v1/chat-stream \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id":"test-uuid",
    "user_text":"I'\''m feeling anxious about my presentation"
  }'
```

### 3. Deploy to production

```bash
supabase functions deploy chat-stream
```

### 4. Monitor logs

```bash
supabase functions logs chat-stream --follow
```

---

## 📊 Model Configuration

### Environment Variables

Set in Supabase Dashboard > Edge Functions > Secrets:

```bash
OPENAI_API_KEY=sk-proj-xxxxx        # Required
OPENAI_CHAT_MODEL=gpt-5-nano        # Model to use
OPENAI_API_MODE=chat                # 'chat' or 'responses'
CHAT_STREAM=true                    # Enable streaming
```

### Changing Models

**Fast & Affordable** (Recommended):
- `gpt-5-nano` - Fastest, lowest cost, great for conversational support
- `gpt-4o-mini` - Good balance of speed and capability

**Higher Quality** (More expensive):
- `gpt-4o` - Better reasoning, more nuanced responses
- `gpt-4-turbo` - Most capable, highest cost

**How to switch**:
```bash
supabase secrets set OPENAI_CHAT_MODEL=gpt-4o-mini
```

### Temperature & Creativity

In `chat-stream/index.ts`, OpenAI call (lines 51-56):

```typescript
body: {
  model: OPENAI_CHAT_MODEL,
  messages,
  stream: CHAT_STREAM,
  // Add these parameters:
  temperature: 0.7,        // 0.0 = deterministic, 1.0 = creative
  top_p: 0.9,             // Nucleus sampling
  frequency_penalty: 0.0,  // Penalize repetition
  presence_penalty: 0.0,   // Encourage diverse topics
}
```

**Temperature Guide**:
- `0.3-0.5`: Consistent, predictable, safe (good for medical disclaimers)
- `0.7`: Balanced (current default, good for empathy)
- `0.8-1.0`: Creative, varied, more "human-like"

---

## 🎨 Advanced: Customizing for Different User Segments

### Example: Student Mental Health Support

```typescript
const SYSTEM_PROMPT = `You are Olive, specialized in supporting college students.

Core Focus Areas:
- Academic stress and performance anxiety
- Social anxiety and making friends
- Homesickness and life transitions
- Time management and procrastination
- Imposter syndrome
- Healthy study habits and burnout prevention

You understand:
- Midterm/final exam stress
- Group project dynamics
- Roommate conflicts
- Financial stress from student loans
- Career anxiety and job search pressure
...`;
```

### Example: Workplace Wellness

```typescript
const SYSTEM_PROMPT = `You are Olive, focused on workplace mental wellness.

Core Focus Areas:
- Work-life balance
- Burnout prevention and recovery
- Difficult coworker relationships
- Imposter syndrome in professional settings
- Career transitions and job search stress
- Leadership stress and team management

You understand:
- Remote work challenges
- Return-to-office anxiety
- Performance review stress
- Layoff anxiety
- Professional boundaries
...`;
```

---

## 🧪 Testing Checklist

When modifying prompts:

- [ ] Test with various user inputs (anxious, sad, angry, neutral)
- [ ] Test out-of-scope detection ("Should I buy stocks?")
- [ ] Test crisis protocol ("I want to hurt myself")
- [ ] Test with preferences (nickname, pronouns, tone)
- [ ] Test response length (should be concise)
- [ ] Test empathy and validation
- [ ] Test boundary maintenance (not diagnosing, etc.)
- [ ] Test in production with real users

---

## 📚 Additional Resources

- **OpenAI Prompt Engineering**: https://platform.openai.com/docs/guides/prompt-engineering
- **CBT/DBT Techniques**: Include specific frameworks in Developer Prompt
- **Crisis Resources**: Update crisis protocol for different regions
- **Preference Management**: See `components/PreferencesView.tsx`

---

## 🐛 Troubleshooting

**Issue**: AI is too verbose

**Fix**: Update Developer Prompt:
```typescript
Response Style:
- Maximum 2-3 sentences per response
- One focused question only
- Be extremely concise
```

**Issue**: AI not using user's nickname

**Fix**: Verify preferences are saved and check logs:
```bash
supabase functions logs chat-stream --follow
```
Look for runtime facts in logs.

**Issue**: AI giving medical advice

**Fix**: Strengthen boundaries in System Prompt and add more examples in Developer Prompt.

**Issue**: Responses feel robotic

**Fix**: Increase temperature to 0.8-0.9 and update tone guidance to be more casual.

---

**Last Updated**: November 13, 2025
**Version**: 1.0

