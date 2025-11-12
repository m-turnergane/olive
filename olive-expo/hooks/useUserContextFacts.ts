// olive-expo/hooks/useUserContextFacts.ts
// Hook to preview what context Olive will use (preferences + memories)

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import type { UserPreferences, UserMemory } from '../types';

interface UserContextFacts {
  preferences: UserPreferences['data'] | null;
  memories: UserMemory[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch user preferences and top memories
 * These are the context facts that Olive will consider during conversations
 */
export function useUserContextFacts(userId: string): UserContextFacts {
  const [preferences, setPreferences] = useState<UserPreferences['data'] | null>(null);
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContextFacts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load preferences
      const { data: prefsData, error: prefsError } = await supabase
        .from('user_preferences')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefsError && prefsError.code !== 'PGRST116') {
        console.error('Error loading preferences:', prefsError);
        setError('Failed to load preferences');
      } else {
        setPreferences(prefsData?.data || null);
      }

      // Load top 5 memories
      const { data: memoriesData, error: memoriesError } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .order('last_refreshed_at', { ascending: false })
        .limit(5);

      if (memoriesError) {
        console.error('Error loading memories:', memoriesError);
        setError(prev => prev ? `${prev}; Failed to load memories` : 'Failed to load memories');
      } else {
        setMemories(memoriesData || []);
      }
    } catch (err) {
      console.error('Unexpected error loading context facts:', err);
      setError('Unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadContextFacts();
    }
  }, [userId]);

  return {
    preferences,
    memories,
    isLoading,
    error,
    refresh: loadContextFacts,
  };
}

/**
 * Format context facts as a human-readable preview
 */
export function formatContextFactsPreview(
  preferences: UserPreferences['data'] | null,
  memories: UserMemory[]
): string {
  const lines: string[] = [];

  if (preferences) {
    if (preferences.nickname) {
      lines.push(`• Prefers to be called "${preferences.nickname}"`);
    }
    if (preferences.pronouns) {
      lines.push(`• Pronouns: ${preferences.pronouns}`);
    }
    if (preferences.tone) {
      lines.push(`• Prefers ${preferences.tone} conversation tone`);
    }
  }

  if (memories.length > 0) {
    lines.push('\nRecent memories:');
    memories.forEach((memory, idx) => {
      lines.push(
        `${idx + 1}. ${memory.fact} (confidence: ${(memory.confidence * 100).toFixed(0)}%)`
      );
    });
  }

  return lines.length > 0
    ? lines.join('\n')
    : 'No preferences or memories yet. Start chatting with Olive!';
}

