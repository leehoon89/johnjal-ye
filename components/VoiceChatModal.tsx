

import React, { useEffect } from 'react';
import type { Character, Conversation } from '../types';
import { useLiveChat } from '../hooks/useLiveChat';

interface VoiceChatModalProps {
  character: Character;
  conversation: Conversation;
  onClose: () => void;
  onAvatarClick?: (url: string) => void;
}

const VoiceChatModal: React.FC<VoiceChatModalProps> = ({ character, conversation, onClose, onAvatarClick }) => {
  const { connectionState, error, startSession, closeSession, currentAmbient } = useLiveChat(character, conversation);

  useEffect(() => {
    startSession();
    // Cleanup on component unmount
    return () => {
      closeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIndicator = () => {
    switch (connectionState) {
      case 'CONNECTING':
        return <div className="text-yellow-400">연결 중...</div>;
      case 'CONNECTED':
        return <div className="text-green-400 flex items-center"><div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>실시간 대화 중</div>;
      case 'CLOSED':
        return <div className="text-gray-400">연결 종료됨</div>;
      case 'ERROR':
        return <div className="text-red-400">연결 오류</div>;
      default:
        return null;
    }
  };
  
  const isConnected = connectionState === 'CONNECTED';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" style={{ animationDuration: '0.3s' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl p-6 w-full max-w-md flex flex-col items-center text-white">
        <div className="flex items-start w-full mb-6">
            <img 
                src={character.avatarUrl} 
                alt={character.name} 
                className="w-20 h-20 rounded-full object-cover cursor-pointer transition-transform duration-200 hover:scale-110"
                onClick={() => onAvatarClick?.(character.avatarUrl)}
            />
            <div className="ml-4 flex-grow">
                <h2 className="text-3xl font-bold">{character.name}</h2>
                <div className="mt-1 h-5">{getStatusIndicator()}</div>
                {currentAmbient && (
                    <div className="text-sm text-gray-400 mt-1 transition-opacity duration-500 animate-fade-in" style={{ animationDuration: '0.5s' }}>
                        <i className="fas fa-volume-up mr-2"></i>
                        <span>{currentAmbient.description}</span>
                    </div>
                )}
            </div>
        </div>

        <div className={`w-32 h-32 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-8 transition-transform duration-300 ${isConnected ? 'animate-pulse scale-105' : 'scale-100'}`}>
            <i className="fas fa-microphone-alt text-6xl text-white"></i>
        </div>
        
        {error && (
            <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4 text-center">
                <p>{error}</p>
            </div>
        )}

        <p className="text-gray-400 mb-8 text-center">
            마이크에 대고 말하면 {character.name}님이 바로 듣고 답장해줄 거예요.
        </p>
        
        <button
          onClick={onClose}
          className="bg-red-600 text-white rounded-full py-3 px-8 font-bold hover:bg-red-700 transition-colors w-full"
        >
          통화 종료
        </button>
      </div>
    </div>
  );
};

export default VoiceChatModal;