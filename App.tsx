


import React, { useState, useCallback, useEffect } from 'react';
import { FEMALE_CHARACTERS, MALE_CHARACTERS } from './constants';
// FIX: Import Conversation type to explicitly type object values.
import type { Character, Message, Conversation, Conversations, UserGender, GeminiContent, GeminiMessagePart, ImageStyle } from './types';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import LoginScreen from './components/LoginScreen';
import GenderSelectionScreen from './components/GenderSelectionScreen';
import SplashScreen from './components/SplashScreen';
import { generateChatResponse } from './services/geminiService';
import * as mediaService from './services/mediaService';
import { generateNewCharacter } from './services/characterService';
import * as storageService from './services/storageService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Image Viewer Modal Component ---
const ImageViewerModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 animate-fade-in" 
      style={{ animationDuration: '0.2s' }}
      onClick={onClose}
    >
      <div className="relative p-4" onClick={(e) => e.stopPropagation()}>
        <img 
          src={imageUrl} 
          alt="Enlarged profile" 
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        />
        <button 
          onClick={onClose} 
          className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg hover:bg-red-500 transition-colors"
          aria-label="Close image view"
        >
          &times;
        </button>
      </div>
    </div>
  );
};


// Keys for localStorage
const AUTH_KEY = 'ai_chat_auth_status';
const GENDER_PREFERENCE_KEY = 'ai_chat_gender_preference';
const CONVERSATIONS_KEY_PREFIX = 'ai_chat_conversations_';
const ACTIVE_CHARACTERS_KEY_PREFIX = 'ai_chat_active_characters_';
const FAVORITE_CHARACTERS_KEY_PREFIX = 'ai_chat_favorites_';
const AVATAR_KEY_PREFIX = 'ai_chat_avatar_';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem(AUTH_KEY) === 'true');
  const [genderPreference, setGenderPreference] = useState<UserGender | null>(() => localStorage.getItem(GENDER_PREFERENCE_KEY) as UserGender | null);
  
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversations>({});
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  const [favoriteCharacterIds, setFavoriteCharacterIds] = useState<string[]>([]);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Splash screen effect
  useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  
  // Dynamic localStorage keys based on gender preference
  const CONVERSATIONS_KEY = genderPreference ? `${CONVERSATIONS_KEY_PREFIX}${genderPreference}` : null;
  const ACTIVE_CHARACTERS_KEY = genderPreference ? `${ACTIVE_CHARACTERS_KEY_PREFIX}${genderPreference}` : null;
  const FAVORITE_CHARACTERS_KEY = genderPreference ? `${FAVORITE_CHARACTERS_KEY_PREFIX}${genderPreference}` : null;
  
  // Load characters and conversations when genderPreference is set
  useEffect(() => {
    if (!genderPreference || !ACTIVE_CHARACTERS_KEY || !CONVERSATIONS_KEY || !FAVORITE_CHARACTERS_KEY) {
        setCharacters([]);
        setConversations({});
        setFavoriteCharacterIds([]);
        return;
    };

    const loadData = async () => {
        const ALL_CHARACTERS = genderPreference === 'female' ? FEMALE_CHARACTERS : MALE_CHARACTERS;
        const ALL_CHARACTERS_MAP = new Map(ALL_CHARACTERS.map(c => [c.id, c]));

        let characterShells: (Partial<Character> & { id: string })[];
        try {
          const stored = localStorage.getItem(ACTIVE_CHARACTERS_KEY);
          characterShells = (stored ? JSON.parse(stored) : ALL_CHARACTERS.slice(0, 3)).filter((c: any) => c && c.id);
        } catch (e) {
          console.error("Failed to load active characters from localStorage", e);
          characterShells = ALL_CHARACTERS.slice(0, 3);
        }
        
        const loadedCharacters = await Promise.all(characterShells.map(async (shell) => {
            const isPredefined = ALL_CHARACTERS_MAP.has(shell.id);
            let fullChar: Character | null;

            if (isPredefined) {
                fullChar = { ...ALL_CHARACTERS_MAP.get(shell.id)! };
            } else {
                fullChar = await storageService.getCharacter(shell.id);
                if (fullChar) {
                  // Hydrate with shell data from LS in case IDB is slower
                  fullChar = { ...fullChar, ...shell };
                }
            }

            if (!fullChar) return null;

            const avatarKey = `${AVATAR_KEY_PREFIX}${genderPreference}_${fullChar.id}`;
            const storedAvatar = await storageService.getAvatar(avatarKey);
            
            if (storedAvatar) {
                fullChar.avatarUrl = storedAvatar;
            } else if (isPredefined && fullChar.avatarUrl.includes('i.ibb.co')) {
                console.log(`No stored avatar for ${fullChar.name}, generating...`);
                const promptMatch = fullChar.systemPrompt.match(/- 프롬프트 예시: "([^"]+)"/);
                const avatarPrompt = promptMatch ? promptMatch[1] : null;

                if (avatarPrompt) {
                    try {
                        const result = await mediaService.generateImage(avatarPrompt, 'Photorealistic');
                        if (result.imageUrl) {
                            console.log(`New avatar generated for ${fullChar.name}.`);
                            await storageService.saveAvatar(avatarKey, result.imageUrl);
                            fullChar.avatarUrl = result.imageUrl;
                        } else {
                             console.error(`Failed to generate avatar for ${fullChar.name}:`, result.error);
                        }
                    } catch (e) {
                         console.error(`Exception while generating avatar for ${fullChar.name}:`, e);
                    }
                }
            }
            return fullChar;
        }));

        setCharacters(loadedCharacters.filter((c): c is Character => c !== null));

        // --- Load conversations & favorites ---
        let loadedConversations: Conversations = {};
        try {
          const stored = localStorage.getItem(CONVERSATIONS_KEY);
          if (stored) {
            loadedConversations = JSON.parse(stored);
            Object.values(loadedConversations).forEach(conv => {
                if (conv.messages) conv.messages.forEach(msg => msg.timestamp = new Date(msg.timestamp));
            });
          }
        } catch (e) { console.error("Failed to load conversations from localStorage", e); }
        setConversations(loadedConversations);
        
        try {
            const stored = localStorage.getItem(FAVORITE_CHARACTERS_KEY);
            setFavoriteCharacterIds(stored ? JSON.parse(stored) : []);
        } catch (e) { console.error("Failed to load favorites from localStorage", e); }
    };

    loadData();

  }, [genderPreference, ACTIVE_CHARACTERS_KEY, CONVERSATIONS_KEY, FAVORITE_CHARACTERS_KEY]);

  // Effect to initialize conversations for active characters
  useEffect(() => {
    if (characters.length === 0) return;
    setConversations(prevConvos => {
        const newConvos = { ...prevConvos };
        let conversationsUpdated = false;
        characters.forEach(char => {
            if (!newConvos[char.id]) {
                newConvos[char.id] = {
                    characterId: char.id,
                    messages: [{ id: `initial-${char.id}`, text: char.initialMessage, sender: 'ai', timestamp: new Date() }],
                    affinity: char.initialAffinity,
                    sexyMood: char.initialSexyMood,
                    chatActive: true,
                    hasUnreadMessages: true,
                };
                conversationsUpdated = true;
            }
        });
        return conversationsUpdated ? newConvos : prevConvos;
    });
  }, [characters]);


  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    const characterExists = selectedCharacterId && characters.some(c => c.id === selectedCharacterId);
    if (!isMobileView) {
      if (characters.length > 0 && !characterExists) setSelectedCharacterId(characters[0].id);
    } else {
      if (selectedCharacterId && !characterExists) setSelectedCharacterId(null);
    }
  }, [characters, selectedCharacterId, isMobileView]);


  useEffect(() => {
    if (!conversations || Object.keys(conversations).length === 0 || !CONVERSATIONS_KEY) return;
    try {
        const conversationsToSave: Conversations = {};
        for (const charId in conversations) {
            if (!characters.some(c => c.id === charId)) continue;
            const conversation = conversations[charId];
            const truncatedMessages = conversation.messages.slice(-30).map(msg => {
                const { imageUrls, isLoading, loadingText, ...rest } = msg;
                return (imageUrls && !rest.text) ? { ...rest, text: "📷 사진" } : rest;
            });
            conversationsToSave[charId] = { ...conversation, messages: truncatedMessages, chatSession: undefined };
        }
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversationsToSave));
    } catch (error) { console.error("Failed to save conversations to localStorage", error); }
  }, [conversations, CONVERSATIONS_KEY, characters]);
  
  useEffect(() => {
    if (FAVORITE_CHARACTERS_KEY) {
      try {
        localStorage.setItem(FAVORITE_CHARACTERS_KEY, JSON.stringify(favoriteCharacterIds));
      } catch (error) { console.error("Failed to save favorites to localStorage", error); }
    }
  }, [favoriteCharacterIds, FAVORITE_CHARACTERS_KEY]);
  
   useEffect(() => {
    if (ACTIVE_CHARACTERS_KEY && genderPreference) {
      const ALL_PREDEFINED_CHARS = genderPreference === 'female' ? FEMALE_CHARACTERS : MALE_CHARACTERS;
      const PREDEFINED_CHARACTER_IDS = new Set(ALL_PREDEFINED_CHARS.map(c => c.id));
      
      const charactersForLocalStorage: Partial<Character>[] = [];
      const characterSavePromises: Promise<void>[] = [];

      for (const char of characters) {
        if (PREDEFINED_CHARACTER_IDS.has(char.id)) {
          charactersForLocalStorage.push({ id: char.id });
        } else {
          // For custom characters, store a minimal shell in localStorage
          const { systemPrompt, avatarUrl, ambientSounds, ...shell } = char;
          charactersForLocalStorage.push(shell);
          // And store the full data in IndexedDB
          characterSavePromises.push(storageService.saveCharacter(char));
        }
      }

      Promise.all(characterSavePromises)
        .then(() => {
            try { localStorage.setItem(ACTIVE_CHARACTERS_KEY, JSON.stringify(charactersForLocalStorage)); } 
            catch (e) { console.error("Failed to save active characters to localStorage", e); }
        })
        .catch(e => console.error("Failed to save some character data to IndexedDB", e));
    }
  }, [characters, ACTIVE_CHARACTERS_KEY, genderPreference]);


  const handleLogin = useCallback(() => {
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.clear(); // Clear all data on logout for a clean state
    setIsAuthenticated(false);
    setGenderPreference(null);
    setCharacters([]);
    setConversations({});
    setSelectedCharacterId(null);
  }, []);
  
  const handleSwitchGender = useCallback(() => {
      if (window.confirm("다른 성별의 캐릭터와 대화하시겠습니까? 현재 대화 내용은 유지됩니다.")) {
          localStorage.removeItem(GENDER_PREFERENCE_KEY);
          setGenderPreference(null);
          setSelectedCharacterId(null);
      }
  }, []);

  const handleGenderSelect = useCallback((gender: UserGender) => {
    localStorage.setItem(GENDER_PREFERENCE_KEY, gender);
    setGenderPreference(gender);
  }, []);

  const handleSelectCharacter = useCallback((characterId: string) => {
    setSelectedCharacterId(characterId);
    setConversations(prev => {
        if (prev[characterId]?.hasUnreadMessages) {
            const conversation = prev[characterId];
            return { ...prev, [characterId]: { ...conversation, hasUnreadMessages: false } };
        }
        return prev;
    });
  }, []);
  
  const handleAddNewCharacter = useCallback(async () => {
    if (isCreatingCharacter || !genderPreference) return;
    setIsCreatingCharacter(true);
    try {
        const newChar = await generateNewCharacter(characters, genderPreference);
        const avatarKey = `${AVATAR_KEY_PREFIX}${genderPreference}_${newChar.id}`;
        await storageService.saveAvatar(avatarKey, newChar.avatarUrl);
        await storageService.saveCharacter(newChar);
        setCharacters(prev => [newChar, ...prev]);
        handleSelectCharacter(newChar.id);
    } catch (error) {
        console.error("Failed to create new character", error);
        alert(`새로운 캐릭터를 만드는 데 실패했어요. 😢\n${error instanceof Error ? error.message : ''}`);
    } finally { setIsCreatingCharacter(false); }
  }, [characters, genderPreference, isCreatingCharacter, handleSelectCharacter]);


  const handleBackToList = useCallback(() => setSelectedCharacterId(null), []);
  const handleShowImage = useCallback((url: string) => setEnlargedImageUrl(url), []);

  // FIX: Made this state update safer by checking for the existence of the conversation first.
  const addMessageToConversation = useCallback((charId: string, message: Message) => {
    setConversations(prev => {
        const conversation = prev[charId];
        if (!conversation) return prev;
        return {
            ...prev,
            [charId]: {
                ...conversation,
                messages: [...conversation.messages, message],
                hasUnreadMessages: charId !== selectedCharacterId,
            }
        };
    });
  }, [selectedCharacterId]);
  
  // FIX: Made this state update safer by checking for the existence of the conversation first.
  const updateMessageInConversation = useCallback((charId: string, messageId: string, updates: Partial<Message>) => {
    setConversations(prev => {
        const conversation = prev[charId];
        if (!conversation) return prev;
        return {
            ...prev,
            [charId]: {
                ...conversation,
                messages: conversation.messages.map(msg => msg.id === messageId ? { ...msg, ...updates } : msg)
            }
        };
    });
  }, []);
  
  const handleToggleFavorite = useCallback((characterId: string) => {
    setFavoriteCharacterIds(prevIds => prevIds.includes(characterId) ? prevIds.filter(id => id !== characterId) : [...prevIds, characterId]);
  }, []);

  const handleEditImage = async (character: Character, prompt: string, file: File) => {
    const loadingMessageId = `loading-${Date.now()}`;
    addMessageToConversation(character.id, { id: loadingMessageId, text: '', sender: 'ai', timestamp: new Date(), isLoading: true, loadingText: '이미지를 수정하고 있어요...' });
    const result = await mediaService.editImage(file, prompt);
    if (result.imageUrl) {
        updateMessageInConversation(character.id, loadingMessageId, { isLoading: false, imageUrls: [result.imageUrl], loadingText: '' });
    } else {
        updateMessageInConversation(character.id, loadingMessageId, { isLoading: false, text: result.error || "알 수 없는 오류로 이미지를 수정하지 못했습니다.", loadingText: '', isError: true });
    }
  };

  const handleSendMessage = useCallback(async (character: Character, text: string, attachedFile?: File, threadParentId?: string) => {
    const currentConversation = conversations[character.id];
    if (!currentConversation?.chatActive) return;

    const userMessage: Message = { id: `user-${Date.now()}`, text: text.trim(), sender: 'user', timestamp: new Date(), imageUrls: attachedFile ? [URL.createObjectURL(attachedFile)] : undefined, threadParentId };
    addMessageToConversation(character.id, userMessage);
    
    // --- Dynamic Thinking Time ---
    const { thinkingTimeMs } = character;
    const { affinity } = currentConversation;
    // Higher affinity -> shorter thinking time (closer to min)
    const affinityFactor = affinity / 100;
    const baseThinkingTime = thinkingTimeMs.max - (thinkingTimeMs.max - thinkingTimeMs.min) * affinityFactor;
    // Add some random variation to feel more human
    const randomJitter = (Math.random() - 0.5) * (baseThinkingTime * 0.3); // +/- 15%
    const finalThinkingTime = Math.max(500, baseThinkingTime + randomJitter);

    await sleep(finalThinkingTime);
    // --- End Dynamic Thinking Time ---

    let fileData;
    if (attachedFile) {
        fileData = { mimeType: attachedFile.type, data: await fileToBase64(attachedFile) };
    }

    const fullHistory = [...currentConversation.messages, userMessage];
    
    // --- START: Robust History Preparation ---
    const mergedContents = fullHistory.reduce<GeminiContent[]>((acc, msg) => {
        const role = msg.sender === 'user' ? 'user' : 'model';
        const parts: GeminiMessagePart[] = [];
        
        if (msg.id === userMessage.id && fileData) {
            parts.push({ inlineData: fileData });
        }
        
        if (msg.text?.trim()) {
            parts.push({ text: msg.text.trim() });
        }
        
        if (parts.length === 0) {
            return acc;
        }

        const lastContent = acc[acc.length - 1];
        if (lastContent && lastContent.role === role) {
            lastContent.parts.push(...parts);
        } else {
            acc.push({ role, parts });
        }
        return acc;
    }, []);

    const firstUserIndex = mergedContents.findIndex(c => c.role === 'user');
    
    if (firstUserIndex === -1) {
      console.error("Cannot generate response: No user message in the processed history.");
      return;
    }

    const validHistory = mergedContents.slice(firstUserIndex);
    const finalContents = validHistory.slice(-20);
    // --- END: Robust History Preparation ---

    if (finalContents.length === 0) {
        console.error("Cannot generate response: Final content history is empty after processing.");
        return;
    }

    setIsTyping(prev => ({ ...prev, [character.id]: true }));

    const response = await generateChatResponse(character, finalContents);

    setIsTyping(prev => ({ ...prev, [character.id]: false }));
    
    if (response.hasLeft) {
        setConversations(prev => ({ ...prev, [character.id]: { ...prev[character.id], chatActive: false } }));
        return;
    }

    // Calculate new affinity value to use it for typing speed calculation
    const currentConversationState = conversations[character.id];
    const newAffinity = Math.max(0, Math.min(100, currentConversationState.affinity + response.affinityAdjustment));

    // Update state with affinity and mood adjustments using a functional update
    // FIX: Made this state update safer by checking for the existence of the conversation first.
    setConversations(prev => {
        const currentConvo = prev[character.id];
        if (!currentConvo) return prev;
        const updatedAffinity = Math.max(0, Math.min(100, currentConvo.affinity + response.affinityAdjustment));
        const updatedSexyMood = Math.max(0, Math.min(100, currentConvo.sexyMood + response.sexyMoodAdjustment));
        return { ...prev, [character.id]: { ...currentConvo, affinity: updatedAffinity, sexyMood: updatedSexyMood } };
    });

    // Display AI text messages first
    for (const [index, messageText] of response.texts.entries()) {
        const messageId = `ai-${Date.now()}-${index}`;
        const aiMessage: Message = { id: messageId, text: messageText, sender: 'ai', timestamp: new Date(), isError: response.isError };
        addMessageToConversation(character.id, aiMessage);
        
        if (index < response.texts.length - 1) {
            const { min, max } = character.typingSpeedCpm;
            
            // Use an ease-out curve for a more natural acceleration of typing speed
            const easeOutQuad = (x: number): number => 1 - (1 - x) * (1 - x);
            const affinityFactor = easeOutQuad(newAffinity / 100);
            
            const baseTypingSpeed = min + (max - min) * affinityFactor;
            
            // Make jitter proportional to the speed for a more natural feel
            const jitterMagnitude = baseTypingSpeed * 0.1; // +/- 10%
            const randomJitter = (Math.random() * 2 - 1) * jitterMagnitude;
            
            const finalTypingSpeedCpm = baseTypingSpeed + randomJitter;

            const delay = (messageText.length / (finalTypingSpeedCpm / 60)) * 1000 + 500;
            setIsTyping(prev => ({ ...prev, [character.id]: true }));
            await sleep(Math.max(500, Math.min(delay, 3000))); // Realistic delay
            setIsTyping(prev => ({ ...prev, [character.id]: false }));
        }
    }
    
    // Then, handle automatic image generation
    if (response.imageGenerationPrompt) {
        const loadingText = '사진을 만드는 중...';
        const loadingMessageId = `loading-${Date.now()}`;
        
        addMessageToConversation(character.id, { id: loadingMessageId, text: '', sender: 'ai', timestamp: new Date(), isLoading: true, loadingText });

        const result = await mediaService.generateImage(response.imageGenerationPrompt, 'Photorealistic');
        
        if (result.imageUrl) {
             updateMessageInConversation(character.id, loadingMessageId, { isLoading: false, imageUrls: [result.imageUrl], loadingText: '', text: result.error ? `이미지를 생성하지 못했어요: ${result.error}` : '', isError: !!result.error });
        } else {
             updateMessageInConversation(character.id, loadingMessageId, { isLoading: false, text: result.error || "알 수 없는 오류로 미디어를 생성하지 못했습니다.", loadingText: '', isError: true, });
        }
    }
  }, [conversations, addMessageToConversation, updateMessageInConversation]);
  
  const handleResetConversation = useCallback((character: Character) => {
    if (window.confirm(`${character.name}님과의 대화 내용을 모두 지우고 처음부터 다시 시작하시겠습니까?`)) {
        setConversations(prev => ({
            ...prev,
            [character.id]: {
                characterId: character.id,
                messages: [{ id: `initial-${character.id}`, text: character.initialMessage, sender: 'ai', timestamp: new Date() }],
                affinity: character.initialAffinity,
                sexyMood: character.initialSexyMood,
                chatActive: true,
                hasUnreadMessages: true,
            }
        }));
    }
  }, []);
  
  const handleLeaveChat = useCallback(async (character: Character) => {
      if (window.confirm(`${character.name}님과의 대화방을 정말로 나가시겠습니까? 이 캐릭터는 목록에서 사라지며, 대화 내용은 모두 삭제됩니다.`)) {
          setSelectedCharacterId(null);
          setCharacters(prev => prev.filter(c => c.id !== character.id));
          setConversations(prev => {
              const newConvos = { ...prev };
              delete newConvos[character.id];
              return newConvos;
          });
          setFavoriteCharacterIds(prev => prev.filter(id => id !== character.id));
          
          if(genderPreference) {
            const avatarKey = `${AVATAR_KEY_PREFIX}${genderPreference}_${character.id}`;
            await storageService.deleteAvatar(avatarKey);
            await storageService.deleteCharacter(character.id);
          }
      }
  }, [genderPreference]);

  // FIX: Made this state update safer by checking for the existence of the conversation first.
  const handleToggleAdminMode = useCallback(() => setIsAdminMode(prev => !prev), []);
  const handleWarnCharacter = useCallback((characterId: string) => {
      const warningMessage = prompt("경고 메시지를 입력하세요:");
      if (warningMessage) {
          setConversations(prev => {
              const conversation = prev[characterId];
              if (!conversation) return prev;
              return {
                  ...prev,
                  [characterId]: {
                      ...conversation,
                      warning: warningMessage,
                  },
              };
          });
          alert(`${characters.find(c => c.id === characterId)?.name}님에게 경고를 보냈습니다.`);
      }
  }, [characters]);

  if (isLoading) return <SplashScreen />;
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;
  if (!genderPreference) return <GenderSelectionScreen onSelect={handleGenderSelect} />;

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);
  const selectedConversation = selectedCharacter ? conversations[selectedCharacter.id] : null;
  const showChatWindow = !isMobileView || (isMobileView && selectedCharacterId);
  const showChatList = !isMobileView || (isMobileView && !selectedCharacterId);
  // FIX: Explicitly typed 'c' as Conversation to resolve TypeScript errors.
  const hasUnreadFromOthers = Object.values(conversations)
    .some((c: Conversation) => c.hasUnreadMessages && c.characterId !== selectedCharacterId);

  return (
    <div className="flex h-screen w-screen bg-black text-white font-sans">
      {showChatList && (
        <ChatList
          characters={characters}
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={handleSelectCharacter}
          conversations={conversations}
          onSwitchGender={handleSwitchGender}
          favoriteCharacterIds={favoriteCharacterIds}
          onToggleFavorite={handleToggleFavorite}
          onAddNewCharacter={handleAddNewCharacter}
          isCreatingCharacter={isCreatingCharacter}
          onAvatarClick={handleShowImage}
          isAdminMode={isAdminMode}
          onToggleAdminMode={handleToggleAdminMode}
          onWarnCharacter={handleWarnCharacter}
          onLeaveChat={handleLeaveChat}
        />
      )}
      {showChatWindow && (
        <ChatWindow
          character={selectedCharacter || null}
          conversation={selectedConversation || null}
          onSendMessage={handleSendMessage}
          isTyping={selectedCharacterId ? !!isTyping[selectedCharacterId] : false}
          onResetConversation={handleResetConversation}
          onLeaveChat={handleLeaveChat}
          onLogout={handleLogout}
          onBack={isMobileView ? handleBackToList : undefined}
          onAvatarClick={handleShowImage}
          hasUnreadFromOthers={hasUnreadFromOthers}
        />
      )}
      {enlargedImageUrl && (
          <ImageViewerModal imageUrl={enlargedImageUrl} onClose={() => setEnlargedImageUrl(null)} />
      )}
    </div>
  );
};

export default App;