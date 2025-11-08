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

