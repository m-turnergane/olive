/**
 * Derive a calm, context-aware thinking text based on the last user message.
 * Mimics frontier model behavior by acknowledging specific intents.
 */

const GENERIC_THINKING_MESSAGES = [
  "Considering how to respond...",
  "Reflecting on your message...",
  "Thinking...",
  "Processing your thoughts...",
  "Taking a moment to reflect...",
  "Contemplating the best response...",
  "Formulating a thoughtful reply...",
];

export function getThinkingText(lastUserMessage: string | null): string {
  if (!lastUserMessage) {
    return "Considering how to respond in a caring way...";
  }

  const text = lastUserMessage.toLowerCase().trim();
  const matches = (keywords: string[]) =>
    keywords.some((keyword) => text.includes(keyword));

  // 0. Care/Search Intent (Specific logic to extract search term)
  const searchPrefixes = [
    "find ",
    "search for ",
    "looking for ",
    "recommend ",
    "suggest ",
    "need ",
    "where is ",
  ];
  const careKeywords = [
    "therapist",
    "psychiatrist",
    "doctor",
    "counselor",
    "provider",
    "clinic",
    "help",
    "professional",
    "care",
    "specialist",
  ];

  // Check if it's a care-related search
  if (matches(careKeywords) && matches(searchPrefixes.map((p) => p.trim()))) {
    // Try to extract the target noun (simple heuristic)
    for (const keyword of careKeywords) {
      if (text.includes(keyword)) {
        // Handle "find a therapist" -> "Searching for a therapist near you..."
        // Or just "Searching for [keyword] near you..."
        return `Searching for ${keyword}s near you...`;
      }
    }
    return "Searching for care providers near you...";
  }

  // 1. Specific Emotional Contexts
  const anxietyKeywords = [
    "anxious",
    "anxiety",
    "panic",
    "overwhelmed",
    "scared",
    "fear",
    "worry",
    "worried",
  ];
  if (matches(anxietyKeywords))
    return "Thinking about how to support your anxiety...";

  const workKeywords = [
    "work",
    "job",
    "boss",
    "manager",
    "burnout",
    "office",
    "career",
    "promotion",
    "deadline",
    "colleague",
  ];
  if (matches(workKeywords)) return "Reflecting on your work situation...";

  const sleepKeywords = [
    "sleep",
    "insomnia",
    "rest",
    "tired",
    "fatigue",
    "dream",
    "nightmare",
    "awake",
  ];
  if (matches(sleepKeywords)) return "Considering ways to support your rest...";

  const griefKeywords = [
    "grief",
    "loss",
    "lost",
    "passed",
    "funeral",
    "death",
    "mourning",
    "miss",
  ];
  if (matches(griefKeywords))
    return "Holding space for what you're going through...";

  const relationshipKeywords = [
    "relationship",
    "partner",
    "breakup",
    "family",
    "friend",
    "husband",
    "wife",
    "dating",
    "boyfriend",
    "girlfriend",
    "marriage",
    "divorce",
  ];
  if (matches(relationshipKeywords))
    return "Reflecting on this relationship dynamic...";

  const healthKeywords = [
    "pain",
    "health",
    "symptom",
    "injury",
    "medical",
    "sick",
    "illness",
    "medication",
  ];
  if (matches(healthKeywords))
    return "Considering supportive guidance for your health...";

  // 2. Cognitive/Task Intents (Frontier Model Style)
  const summaryKeywords = [
    "summary",
    "summarize",
    "brief",
    "recap",
    "tl;dr",
    "overview",
    "chapter",
    "book",
    "article",
  ];
  if (matches(summaryKeywords)) return "Summarizing the material...";

  const explainKeywords = [
    "explain",
    "how does",
    "what is",
    "define",
    "meaning",
    "concept",
    "understand",
  ];
  if (matches(explainKeywords)) return "Formulating a clear explanation...";

  const comparisonKeywords = [
    "compare",
    "difference",
    "versus",
    "vs",
    "better",
    "worse",
    "pros and cons",
  ];
  if (matches(comparisonKeywords)) return "Comparing the options...";

  const listKeywords = ["list", "ideas", "suggestions", "examples", "ways to"];
  if (matches(listKeywords)) return "Generating a list of ideas...";

  const analysisKeywords = ["analyze", "why", "reason", "cause", "assess"];
  if (matches(analysisKeywords)) return "Analyzing the context...";

  const planningKeywords = [
    "plan",
    "schedule",
    "organize",
    "steps",
    "next steps",
    "prepare",
    "strategy",
    "goal",
  ];
  if (matches(planningKeywords)) return "Figuring out a step-by-step plan...";

  const searchKeywords = [
    "find",
    "search",
    "look for",
    "where",
    "location",
    "spot",
  ];
  if (matches(searchKeywords)) return "Searching for relevant information...";

  const creativeKeywords = [
    "write",
    "create",
    "poem",
    "story",
    "draft",
    "email",
    "essay",
    "script",
  ];
  if (matches(creativeKeywords)) return "Drafting a response...";

  // 3. Question Types (if no specific keywords matched)
  if (text.startsWith("why")) return "Thinking through the reasons...";
  if (text.startsWith("how")) return "Considering the method...";
  if (text.startsWith("what")) return "Thinking...";

  // 4. Generic Fallback with Variability
  // Use a pseudo-random selection to avoid static feeling
  const randomIndex = Math.floor(
    Math.random() * GENERIC_THINKING_MESSAGES.length
  );
  return GENERIC_THINKING_MESSAGES[randomIndex];
}
