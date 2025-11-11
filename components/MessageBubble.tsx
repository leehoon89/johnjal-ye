
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, Character } from '../types';

interface MessageBubbleProps {
  message: Message;
  character: Character;
  onSetReply: (message: Message) => void;
  parentMessage?: Message;
  isFirstInSequence: boolean;
  isLastInSequence: boolean;
}

const LoadingBubble: React.FC<{ loadingText?: string }> = ({ loadingText }) => (
  <div className="bg-gray-700 text-white rounded-2xl p-3 flex flex-col items-center space-y-2">
    <div className="flex items-center space-x-1">
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
    </div>
    {loadingText && <p className="text-sm text-gray-300">{loadingText}</p>}
  </div>
);

const ParentMessagePreview: React.FC<{ parent: Message; characterName: string, isUser: boolean }> = ({ parent, characterName, isUser }) => (
    <div className={`mb-1.5 rounded-lg p-2 text-xs border-l-2 ${isUser ? 'bg-black/20 border-blue-300' : 'bg-black/20 border-gray-500'}`}>
        <p className={`font-bold ${isUser ? 'text-blue-300' : 'text-gray-400'}`}>
            Replying to {parent.sender === 'user' ? 'You' : characterName}
        </p>
        <p className={`truncate ${isUser ? 'text-gray-200' : 'text-gray-400'}`}>
            {parent.text || (parent.imageUrls && parent.imageUrls.length > 0 ? (parent.imageUrls.length > 1 ? `📷 사진 ${parent.imageUrls.length}장` : '📷 사진') : '')}
        </p>
    </div>
);

const ImageCarousel: React.FC<{ imageUrls: string[] }> = ({ imageUrls }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const newIndex = Math.round(scrollLeft / (clientWidth || 1));
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const goToPrevious = () => {
    scrollContainerRef.current?.scrollBy({
      left: -scrollContainerRef.current.clientWidth,
      behavior: 'smooth',
    });
  };

  const goToNext = () => {
    scrollContainerRef.current?.scrollBy({
      left: scrollContainerRef.current.clientWidth,
      behavior: 'smooth',
    });
  };

  if (imageUrls.length === 1) {
    return <img src={imageUrls[0]} alt="media" className="w-full max-w-xs object-cover block" />;
  }

  return (
    <div className="group relative w-full max-w-xs aspect-square">
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto snap-x snap-mandatory h-full w-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {imageUrls.map((url, index) => (
          <img
            key={index}
            src={url}
            alt={`media ${index + 1}`}
            className="w-full h-full object-cover flex-shrink-0 snap-center"
          />
        ))}
      </div>
      
      {currentIndex > 0 && (
        <button 
          onClick={goToPrevious}
          className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/60"
          aria-label="Previous image"
        >
          <i className="fas fa-chevron-left text-sm"></i>
        </button>
      )}
      {currentIndex < imageUrls.length - 1 && (
         <button 
          onClick={goToNext}
          className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/60"
          aria-label="Next image"
        >
          <i className="fas fa-chevron-right text-sm"></i>
        </button>
      )}

      {imageUrls.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5 bg-black/50 backdrop-blur-sm p-1 px-2 rounded-full pointer-events-none">
          {imageUrls.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                currentIndex === index ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, character, onSetReply, parentMessage, isFirstInSequence, isLastInSequence }) => {
  const isUser = message.sender === 'user';

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getBubbleClasses = () => {
    const base = isUser 
      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
      : 'bg-gray-700 text-white';

    const roundingClasses = [];
    if (isUser) {
        roundingClasses.push('rounded-tl-2xl', 'rounded-bl-2xl');
        roundingClasses.push(isFirstInSequence ? 'rounded-tr-2xl' : 'rounded-tr-md');
        roundingClasses.push(isLastInSequence ? 'rounded-br-2xl' : 'rounded-br-md');
    } else { // AI
        roundingClasses.push('rounded-tr-2xl', 'rounded-br-2xl');
        roundingClasses.push(isFirstInSequence ? 'rounded-tl-2xl' : 'rounded-tl-md');
        roundingClasses.push(isLastInSequence ? 'rounded-bl-2xl' : 'rounded-bl-md');
    }

    return `overflow-hidden ${base} ${roundingClasses.join(' ')}`;
  };


  const renderContent = () => {
    if (message.isLoading) {
      return <LoadingBubble loadingText={message.loadingText} />;
    }
    
    if (message.isError) {
      return (
        <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-2xl px-4 py-3 flex items-start space-x-3">
          <i className="fas fa-exclamation-triangle mt-1 flex-shrink-0"></i>
          <p className="text-base whitespace-pre-wrap">{message.text}</p>
        </div>
      );
    }
    
    const hasText = message.text && message.text.trim().length > 0;
    const hasImages = message.imageUrls && message.imageUrls.length > 0;

    if (!hasText && !hasImages && !parentMessage) {
      return null;
    }

    return (
      <div className={getBubbleClasses()}>
        {hasImages && <ImageCarousel imageUrls={message.imageUrls!} />}
        {(hasText || parentMessage) && (
            <div className="px-4 py-3">
                {parentMessage && <ParentMessagePreview parent={parentMessage} characterName={character.name} isUser={isUser}/>}
                {hasText && <p className="text-base whitespace-pre-wrap">{message.text}</p>}
            </div>
        )}
      </div>
    );
  };
  
  const content = renderContent();
  if (!content) return null;

  const containerClasses = [
    'group flex items-end gap-2 animate-message-in',
    isUser ? 'justify-end' : 'justify-start',
    isFirstInSequence ? 'mt-4' : 'mt-0.5' // Space between groups vs within a group
  ].join(' ');

  return (
    <div className={containerClasses}>
      {!isUser && (
        <div className="w-8 h-8 flex-shrink-0 self-end">
         {isLastInSequence && (
            <img
            src={character.avatarUrl}
            alt={character.name}
            className="w-8 h-8 rounded-full object-cover"
            />
         )}
        </div>
      )}
       <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                {content}
                {isLastInSequence && (
                  <p className="text-xs text-gray-500 mt-1 px-1">
                    {formatTimestamp(message.timestamp)}
                  </p>
                )}
            </div>
            <button 
                onClick={() => onSetReply(message)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white rounded-full w-8 h-8 flex items-center justify-center bg-gray-800/50"
                aria-label="Reply to this message"
            >
                <i className="fas fa-reply"></i>
            </button>
       </div>
    </div>
  );
};

export default MessageBubble;
