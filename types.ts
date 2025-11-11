
import type { Chat } from "@google/genai";

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  imageUrls?: string[];
  isLoading?: boolean;
  loadingText?: string;
  isError?: boolean;
  threadParentId?: string;
}

export type CharacterCapability = 'image_generate' | 'image_edit';

export interface Character {
  id:string;
  name: string;
  age: number;
  avatarUrl: string;
  systemPrompt: string;
  initialMessage: string;
  initialAffinity: number;
  initialSexyMood: number;
  thinkingTimeMs: { min: number; max: number };
  typingSpeedCpm: { min: number; max: number; };
  mbti: string;
  bloodType: string;
  capabilities?: CharacterCapability[];
  homeAddress?: string;
  voiceName: string;
  ambientSounds?: Record<string, { url: string; description: string }>;
  defaultAmbientSound?: string;
}

export interface Conversation {
  characterId: string;
  messages: Message[];
  chatSession?: Chat;
  affinity: number; // 0-100 scale
  sexyMood: number; // 0-100 scale
  chatActive: boolean;
  hasUnreadMessages: boolean;
  warning?: string; // For admin warnings
}

export type Conversations = Record<string, Conversation>;

export type UserGender = 'male' | 'female';

export type GeminiMessagePart = { text: string } | { inlineData: { mimeType: string, data: string } };

export type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiMessagePart[];
};

export type ImageStyle = 'Photorealistic' | 'Anime / Webtoon' | 'Fantasy Art' | 'Watercolor' | 'Sketch';