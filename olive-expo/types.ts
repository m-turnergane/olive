export enum Speaker {
  User = 'user',
  Model = 'model',
  System = 'system',
}

export interface TranscriptionTurn {
  speaker: Speaker;
  text: string;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// Chat Persistence Types
// ============================================================================

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

export interface ConversationSummary {
  conversation_id: string;
  summary: string;
  updated_at: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  fact: string;
  source_message_id: string | null;
  confidence: number;
  last_refreshed_at: string;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  data: {
    nickname?: string;
    pronouns?: string;
    tone?: 'casual' | 'professional' | 'supportive';
    opt_out_topics?: string[];
    crisis_prefs?: Record<string, any>;
  };
  updated_at: string;
}

