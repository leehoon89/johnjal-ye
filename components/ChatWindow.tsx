

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Character, Conversation as ConversationType, Message } from '../types';
import MessageBubble from './MessageBubble';
import VoiceChatModal from './VoiceChatModal';

interface ChatWindowProps {
  character: Character | null;
  conversation: ConversationType | null;
  onSendMessage: (character: Character, text: string, file?: File, threadParentId?: string) => void;
  isTyping: boolean;
  onResetConversation: (character: Character) => void;
  onLeaveChat: (character: Character) => void;
  onLogout: () => void;
  onBack?: () => void;
  onAvatarClick?: (url: string) => void;
  hasUnreadFromOthers?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ character, conversation, onSendMessage, isTyping, onResetConversation, onLeaveChat, onLogout, onBack, onAvatarClick, hasUnreadFromOthers }) => {
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isVoiceChatVisible, setIsVoiceChatVisible] = useState(false);
  const [showInviteToast, setShowInviteToast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollToBottom, [conversation?.messages, isTyping]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  
  useEffect(() => {
      setInputText('');
      setAttachedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setReplyingTo(null);
      setIsVoiceChatVisible(false); // Close voice chat on character switch
  }, [character]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputText.trim() || attachedFile) && character && conversation?.chatActive) {
      onSendMessage(character, inputText.trim(), attachedFile, replyingTo?.id);
      setInputText('');
      setAttachedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setReplyingTo(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setAttachedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeAttachment = () => {
      setAttachedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleSetReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleResetClick = useCallback(() => {
    if (character) {
      onResetConversation(character);
    }
  }, [character, onResetConversation]);

  const handleLeaveClick = useCallback(() => {
    if (character) {
      onLeaveChat(character);
    }
  }, [character, onLeaveChat]);

  const handleInviteClick = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        setShowInviteToast(true);
        setTimeout(() => setShowInviteToast(false), 2000);
    });
  };

  if (!character || !conversation) {
    return (
      <main className="w-2/3 flex-grow bg-black flex-col items-center justify-center text-gray-400 hidden md:flex">
        <i className="far fa-comments text-6xl mb-4"></i>
        <h2 className="text-2xl font-semibold">Select a chat</h2>
        <p>Start a conversation with one of your matches.</p>
      </main>
    );
  }

  return (
    <>
    <main className="w-full md:w-2/3 flex-grow bg-black flex flex-col relative">
      {showInviteToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in z-20">
              Invitation link copied to clipboard!
          </div>
      )}
      <header className="flex items-center p-3 border-b border-gray-800 bg-black flex-shrink-0 z-10">
        {onBack && (
            <button onClick={onBack} className="relative md:hidden mr-2 text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800">
                <i className="fas fa-arrow-left"></i>
                {hasUnreadFromOthers && (
                    <span className="absolute top-1 right-1 block h-3 w-3 rounded-full bg-blue-500 ring-2 ring-black" title="New messages from others"></span>
                )}
            </button>
        )}
        <img 
            src={character.avatarUrl} 
            alt={character.name} 
            className="w-10 h-10 rounded-full mr-4 object-cover cursor-pointer transition-transform duration-200 hover:scale-110"
            onClick={() => onAvatarClick?.(character.avatarUrl)}
        />
        <div className="flex-grow">
          <h2 className="text-lg font-bold text-white">{character.name}</h2>
          <p className={`text-sm ${conversation.chatActive ? 'text-green-400' : 'text-gray-500'}`}>
            {conversation.chatActive ? 'Online' : 'Offline'}
          </p>
        </div>
        <button onClick={handleInviteClick} className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 flex-shrink-0" title="Invite a Friend">
            <i className="fas fa-share-square"></i>
        </button>
        <button onClick={() => setIsVoiceChatVisible(true)} className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 flex-shrink-0" title="음성 통화 시작">
            <i className="fas fa-phone-alt"></i>
        </button>
         <button onClick={handleResetClick} className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 flex-shrink-0" title="대화 초기화">
            <i className="fas fa-sync-alt"></i>
        </button>
        <button onClick={handleLeaveClick} className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 flex-shrink-0" title="대화방 나가기">
            <i className="fas fa-trash-alt"></i>
        </button>
         <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-800 flex-shrink-0" title="로그아웃">
            <i className="fas fa-sign-out-alt"></i>
        </button>
      </header>
      
      <div className="flex-grow p-4 overflow-y-auto">
        {conversation.warning && (
            <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg p-3 mb-4 text-sm flex items-start space-x-3">
                <i className="fas fa-exclamation-triangle mt-1 flex-shrink-0"></i>
                <div>
                    <h4 className="font-bold">관리자 경고</h4>
                    <p>{conversation.warning}</p>
                </div>
            </div>
        )}
        <div className="flex flex-col">
          {conversation.messages.map((msg, index, messages) => {
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];
            const TIME_GROUP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

            const isFirstInSequence = !prevMsg || 
                                      prevMsg.sender !== msg.sender || 
                                      (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > TIME_GROUP_THRESHOLD_MS);

            const isLastInSequence = !nextMsg || 
                                     nextMsg.sender !== msg.sender ||
                                     (new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime() > TIME_GROUP_THRESHOLD_MS);

            const parentMessage = msg.threadParentId
                ? conversation.messages.find(p => p.id === msg.threadParentId)
                : undefined;
            return (
                <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    character={character} 
                    onSetReply={handleSetReply} 
                    parentMessage={parentMessage}
                    isFirstInSequence={isFirstInSequence}
                    isLastInSequence={isLastInSequence}
                />
            );
          })}
          {isTyping && (
             <div className="flex justify-start animate-message-in mt-4">
               <img src={character.avatarUrl} alt={character.name} className="w-8 h-8 rounded-full self-start object-cover flex-shrink-0"/>
               <div className="ml-2">
                <div className="bg-gray-700 text-white rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center space-x-1">
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
                    </div>
                </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <footer className="p-4 border-t border-gray-800 bg-black flex-shrink-0">
        {replyingTo && (
            <div className="bg-gray-800 p-2 rounded-t-lg flex justify-between items-center text-sm mb-2">
                <div className="border-l-2 border-blue-500 pl-2 text-gray-300 overflow-hidden">
                    <p className="font-bold text-blue-400">Replying to {replyingTo.sender === 'user' ? 'You' : character.name}</p>
                    <p className="truncate">{replyingTo.text || (replyingTo.imageUrls && replyingTo.imageUrls.length > 0 ? 'Image' : '')}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white p-2 flex-shrink-0">
                    <i className="fas fa-times"></i>
                </button>
            </div>
        )}
        {previewUrl && (
            <div className="mb-2 relative w-24 h-24">
                <img src={previewUrl} alt="preview" className="rounded-lg w-full h-full object-cover" />
                <button onClick={removeAttachment} className="absolute -top-2 -right-2 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center text-white hover:bg-red-500">
                    <i className="fas fa-times text-xs"></i>
                </button>
            </div>
        )}
        {!conversation.chatActive ? (
          <div className="text-center text-gray-500 py-3">
            <p>{character.name}님이 대화를 떠났습니다.</p>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
            <>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white transition-colors h-12 w-12 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-paperclip text-xl"></i>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message..."
              className="flex-grow bg-gray-800 border border-gray-700 rounded-full py-3 px-5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="off"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white rounded-full h-12 w-12 flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-gray-500 flex-shrink-0"
              disabled={!inputText.trim() && !attachedFile}
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        )}
      </footer>
    </main>
    {isVoiceChatVisible && (
        <VoiceChatModal 
            character={character} 
            conversation={conversation}
            onClose={() => setIsVoiceChatVisible(false)}
            onAvatarClick={onAvatarClick} 
        />
    )}
    </>
  );
};

export default ChatWindow;