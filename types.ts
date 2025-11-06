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
  photoUrl: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
