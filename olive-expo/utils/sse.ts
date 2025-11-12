// olive-expo/utils/sse.ts
// Server-Sent Events (SSE) parser for OpenAI streaming responses

/**
 * Parse a single SSE line and extract the data payload
 * @param line Raw SSE line (e.g., "data: {...}")
 * @returns Parsed JSON object or null if invalid
 */
export function parseSSELine(line: string): any | null {
  // Skip empty lines
  if (!line.trim()) {
    return null;
  }

  // SSE lines start with "data: "
  if (!line.startsWith("data:")) {
    return null;
  }

  // Extract payload after "data: "
  const payload = line.replace(/^data:\s*/, "").trim();

  // Skip [DONE] marker
  if (payload === "[DONE]") {
    return null;
  }

  // Skip empty payloads
  if (!payload) {
    return null;
  }

  // Parse JSON
  try {
    return JSON.parse(payload);
  } catch (error) {
    // Invalid JSON - return null
    return null;
  }
}

/**
 * Extract content token from OpenAI SSE chunk
 * @param chunk Parsed SSE data object
 * @returns Token string or null
 */
export function extractTokenFromChunk(chunk: any): string | null {
  return chunk?.choices?.[0]?.delta?.content || null;
}

/**
 * Parse SSE chunk and extract token in one step
 * @param line Raw SSE line
 * @returns Token string or null
 */
export function parseSSEToken(line: string): string | null {
  const parsed = parseSSELine(line);
  if (!parsed) return null;
  return extractTokenFromChunk(parsed);
}

/**
 * Parse multiple SSE lines from a chunk
 * @param chunk Raw chunk text containing multiple lines
 * @returns Array of tokens (non-null only)
 */
export function parseSSEChunk(chunk: string): string[] {
  const lines = chunk.split("\n");
  const tokens: string[] = [];

  for (const line of lines) {
    const token = parseSSEToken(line);
    if (token) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Process a stream of SSE data
 * @param text Accumulated text from stream
 * @param onToken Callback for each token
 */
export function processSSEStream(
  text: string,
  onToken: (token: string) => void
): void {
  const lines = text.split("\n");

  for (const line of lines) {
    const token = parseSSEToken(line);
    if (token) {
      onToken(token);
    }
  }
}
