

import React from 'react';
import type { Character, Conversations } from '../types';

interface ChatListProps {
  characters: Character[];
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string) => void;
  conversations: Conversations;
  onSwitchGender: () => void;
  favoriteCharacterIds: string[];
  onToggleFavorite: (characterId: string) => void;
  onAddNewCharacter: () => void;
  isCreatingCharacter: boolean;
  onAvatarClick: (url: string) => void;
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  onWarnCharacter: (characterId: string) => void;
  onLeaveChat: (character: Character) => void;
}

const ChatListItem: React.FC<{
  character: Character;
  isSelected: boolean;
  lastMessageText: string;
  hasUnread: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: (characterId: string) => void;
  onAvatarClick: (url: string) => void;
  isAdminMode: boolean;
  onWarnCharacter: (characterId: string) => void;
  onLeaveChat: (character: Character) => void;
  // FIX: Added 'conversations' to the props interface
  conversations: Conversations;
}> = ({ character, isSelected, lastMessageText, hasUnread, isFavorite, onClick, onToggleFavorite, onAvatarClick, isAdminMode, onWarnCharacter, onLeaveChat, conversations }) => (
  <li
    onClick={onClick}
    className={`flex items-center p-3 cursor-pointer transition-colors duration-200 ${
      isSelected ? 'bg-gray-800' : 'hover:bg-gray-900'
    }`}
  >
    <img 
        src={character.avatarUrl} 
        alt={character.name} 
        className="w-14 h-14 rounded-full mr-4 object-cover flex-shrink-0 cursor-pointer transition-transform duration-200 hover:scale-110"
        onClick={(e) => {
            e.stopPropagation();
            onAvatarClick(character.avatarUrl);
        }}
    />
    <div className="flex-grow overflow-hidden">
      <div className="flex items-center">
        <h3 className="font-bold text-lg text-white">{character.name}</h3>
        {conversations[character.id]?.warning && <i className="fas fa-exclamation-triangle text-yellow-400 text-xs ml-2" title={`Warning: ${conversations[character.id].warning}`}></i>}
      </div>
      <p className={`text-gray-400 text-sm truncate ${hasUnread ? 'font-bold text-white' : ''}`}>
        {lastMessageText}
      </p>
    </div>
    <div className="flex items-center flex-shrink-0">
        {isAdminMode && (
            <>
                <button
                    onClick={(e) => { e.stopPropagation(); onWarnCharacter(character.id); }}
                    className="p-2 text-lg text-yellow-500 hover:text-yellow-400 transition-colors"
                    title="Warn Character"
                >
                    <i className="fas fa-exclamation-triangle"></i>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onLeaveChat(character); }}
                    className="p-2 text-lg text-red-500 hover:text-red-400 transition-colors"
                    title="Kick Character"
                >
                    <i className="fas fa-user-slash"></i>
                </button>
            </>
        )}
        <button
          onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(character.id);
          }}
          className="p-2 text-lg text-gray-600 hover:text-yellow-400 transition-colors"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
            <i className={`${isFavorite ? 'fas text-yellow-400' : 'far'} fa-star`}></i>
        </button>
        {hasUnread && !isSelected && (
            <div className="w-3 h-3 bg-blue-500 rounded-full ml-2"></div>
        )}
    </div>
  </li>
);


const ChatList: React.FC<ChatListProps> = ({ characters, selectedCharacterId, onSelectCharacter, conversations, onSwitchGender, favoriteCharacterIds, onToggleFavorite, onAddNewCharacter, isCreatingCharacter, onAvatarClick, isAdminMode, onToggleAdminMode, onWarnCharacter, onLeaveChat }) => {
    
  const sortedCharacters = React.useMemo(() => {
    const favoriteChars = characters.filter(c => favoriteCharacterIds.includes(c.id));
    const nonFavoriteChars = characters.filter(c => !favoriteCharacterIds.includes(c.id));

    const getLastTimestamp = (charId: string) => {
        const convo = conversations[charId];
        return convo?.messages?.length > 0
            ? convo.messages[convo.messages.length - 1].timestamp.getTime()
            : 0;
    };
    
    favoriteChars.sort((a, b) => getLastTimestamp(b.id) - getLastTimestamp(a.id));
    nonFavoriteChars.sort((a, b) => getLastTimestamp(b.id) - getLastTimestamp(a.id));
    
    return [...favoriteChars, ...nonFavoriteChars];
}, [characters, favoriteCharacterIds, conversations]);
    
  const getLastMessageText = (conversation: Conversations[string]): string => {
    if (!conversation || conversation.messages.length === 0) {
      return "No messages yet.";
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage.imageUrls && lastMessage.imageUrls.length > 0) {
        return lastMessage.imageUrls.length > 1 ? `📷 사진 ${lastMessage.imageUrls.length}장` : "📷 사진";
    }
    if (lastMessage.text) return lastMessage.text;
    if (lastMessage.isLoading) return "...";
    return "대화를 시작해보세요.";
  };
    
  return (
    <aside className="w-full md:w-1/3 md:min-w-[320px] bg-black md:border-r md:border-gray-800 flex flex-col">
      <header className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Messages</h2>
        <div className="flex items-center space-x-2">
            <button 
                onClick={onToggleAdminMode}
                className={`transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 ${isAdminMode ? 'text-red-500' : 'text-gray-400'}`}
                title="Admin Mode"
            >
                <i className="fas fa-shield-alt"></i>
            </button>
            <button 
                onClick={onAddNewCharacter}
                disabled={isCreatingCharacter}
                className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isCreatingCharacter ? "새 친구를 만들고 있어요..." : "새 친구 만들기"}
            >
                {isCreatingCharacter ? (
                    <i className="fas fa-spinner fa-spin"></i>
                ) : (
                    <i className="fas fa-user-plus"></i>
                )}
            </button>
            <button 
                onClick={onSwitchGender} 
                className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800"
                title="캐릭터 성별 바꾸기"
            >
                <i className="fas fa-exchange-alt"></i>
            </button>
        </div>
      </header>
      <ul className="flex-grow overflow-y-auto h-0">
        {sortedCharacters.map(character => {
          const conversation = conversations[character.id];
          if (!conversation) return null;
          const isFavorite = favoriteCharacterIds.includes(character.id);
          return (
            <ChatListItem
              key={character.id}
              character={character}
              isSelected={selectedCharacterId === character.id}
              lastMessageText={getLastMessageText(conversation)}
              hasUnread={conversation.hasUnreadMessages}
              isFavorite={isFavorite}
              onClick={() => onSelectCharacter(character.id)}
              onToggleFavorite={onToggleFavorite}
              onAvatarClick={onAvatarClick}
              isAdminMode={isAdminMode}
              onWarnCharacter={onWarnCharacter}
              onLeaveChat={onLeaveChat}
              conversations={conversations}
            />
          );
        })}
      </ul>
    </aside>
  );
};

export default ChatList;