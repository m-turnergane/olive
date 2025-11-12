// olive-expo/utils/__tests__/sse.test.ts
// Tests for SSE parser utility

import {
  parseSSELine,
  extractTokenFromChunk,
  parseSSEToken,
  parseSSEChunk,
  processSSEStream,
} from '../sse';

describe('SSE Parser', () => {
  describe('parseSSELine', () => {
    it('should parse valid SSE line', () => {
      const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
      const result = parseSSELine(line);
      
      expect(result).toEqual({
        choices: [{ delta: { content: 'Hello' } }],
      });
    });

    it('should handle line with spaces after data:', () => {
      const line = 'data:   {"test": "value"}';
      const result = parseSSELine(line);
      
      expect(result).toEqual({ test: 'value' });
    });

    it('should return null for [DONE] marker', () => {
      const line = 'data: [DONE]';
      const result = parseSSELine(line);
      
      expect(result).toBeNull();
    });

    it('should return null for empty line', () => {
      const line = '';
      const result = parseSSELine(line);
      
      expect(result).toBeNull();
    });

    it('should return null for line without data: prefix', () => {
      const line = 'event: message';
      const result = parseSSELine(line);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const line = 'data: {invalid json}';
      const result = parseSSELine(line);
      
      expect(result).toBeNull();
    });

    it('should return null for empty payload', () => {
      const line = 'data: ';
      const result = parseSSELine(line);
      
      expect(result).toBeNull();
    });
  });

  describe('extractTokenFromChunk', () => {
    it('should extract token from valid chunk', () => {
      const chunk = {
        choices: [{ delta: { content: 'Hello' } }],
      };
      const token = extractTokenFromChunk(chunk);
      
      expect(token).toBe('Hello');
    });

    it('should return null for chunk without content', () => {
      const chunk = {
        choices: [{ delta: {} }],
      };
      const token = extractTokenFromChunk(chunk);
      
      expect(token).toBeNull();
    });

    it('should return null for empty chunk', () => {
      const chunk = {};
      const token = extractTokenFromChunk(chunk);
      
      expect(token).toBeNull();
    });

    it('should return null for null chunk', () => {
      const token = extractTokenFromChunk(null);
      
      expect(token).toBeNull();
    });

    it('should handle multi-character tokens', () => {
      const chunk = {
        choices: [{ delta: { content: 'This is a longer token' } }],
      };
      const token = extractTokenFromChunk(chunk);
      
      expect(token).toBe('This is a longer token');
    });
  });

  describe('parseSSEToken', () => {
    it('should parse and extract token in one step', () => {
      const line = 'data: {"choices":[{"delta":{"content":"Hi"}}]}';
      const token = parseSSEToken(line);
      
      expect(token).toBe('Hi');
    });

    it('should return null for invalid line', () => {
      const line = 'invalid line';
      const token = parseSSEToken(line);
      
      expect(token).toBeNull();
    });

    it('should return null for [DONE]', () => {
      const line = 'data: [DONE]';
      const token = parseSSEToken(line);
      
      expect(token).toBeNull();
    });
  });

  describe('parseSSEChunk', () => {
    it('should parse multiple lines from chunk', () => {
      const chunk = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" "}}]}
data: {"choices":[{"delta":{"content":"world"}}]}`;
      
      const tokens = parseSSEChunk(chunk);
      
      expect(tokens).toEqual(['Hello', ' ', 'world']);
    });

    it('should skip invalid lines', () => {
      const chunk = `data: {"choices":[{"delta":{"content":"Hello"}}]}
invalid line
data: [DONE]
data: {"choices":[{"delta":{"content":"world"}}]}`;
      
      const tokens = parseSSEChunk(chunk);
      
      expect(tokens).toEqual(['Hello', 'world']);
    });

    it('should handle empty chunk', () => {
      const chunk = '';
      const tokens = parseSSEChunk(chunk);
      
      expect(tokens).toEqual([]);
    });

    it('should handle chunk with only newlines', () => {
      const chunk = '\n\n\n';
      const tokens = parseSSEChunk(chunk);
      
      expect(tokens).toEqual([]);
    });
  });

  describe('processSSEStream', () => {
    it('should call callback for each token', () => {
      const text = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" "}}]}
data: {"choices":[{"delta":{"content":"world"}}]}`;
      
      const tokens: string[] = [];
      processSSEStream(text, (token) => tokens.push(token));
      
      expect(tokens).toEqual(['Hello', ' ', 'world']);
    });

    it('should not call callback for invalid lines', () => {
      const text = `invalid line
data: [DONE]
event: message`;
      
      const tokens: string[] = [];
      processSSEStream(text, (token) => tokens.push(token));
      
      expect(tokens).toEqual([]);
    });

    it('should handle complex OpenAI response', () => {
      const text = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"I"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"'m"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" happy"},"finish_reason":null}]}

data: [DONE]`;
      
      const tokens: string[] = [];
      processSSEStream(text, (token) => tokens.push(token));
      
      expect(tokens).toEqual(['I', "'m", ' happy']);
    });
  });
});

