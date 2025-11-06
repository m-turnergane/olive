import { User } from '../types';

// This is a placeholder for a real Supabase authentication service.
export const loginWithGoogle = async (): Promise<User> => {
  console.log("Simulating Google login...");
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network request
  const mockUser: User = {
    id: 'usr_12345',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    photoUrl: 'https://picsum.photos/seed/janedoe/40/40',
  };
  return mockUser;
};

export const loginWithEmail = async (email: string, pass: string): Promise<User> => {
    console.log("Simulating Email login...");
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const mockUser: User = {
      id: 'usr_67890',
      name: 'John Smith',
      email: email,
      photoUrl: 'https://picsum.photos/seed/johnsmith/40/40',
    };
    return mockUser;
}
