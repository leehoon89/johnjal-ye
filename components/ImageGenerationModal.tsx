import React, { useState, useEffect } from 'react';
import type { ImageStyle } from '../types';

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, style: ImageStyle) => void;
  suggestedPrompt: string;
}

const styles: ImageStyle[] = ['Photorealistic', 'Anime / Webtoon', 'Fantasy Art', 'Watercolor', 'Sketch'];

const StyleButton: React.FC<{ style: ImageStyle; isSelected: boolean; onClick: (style: ImageStyle) => void; }> = ({ style, isSelected, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(style)}
    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border-2 ${
      isSelected
        ? 'bg-blue-500 border-blue-500 text-white shadow-lg'
        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
    }`}
  >
    {style}
  </button>
);

const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({ isOpen, onClose, onSubmit, suggestedPrompt }) => {
  const [prompt, setPrompt] = useState(suggestedPrompt);
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('Photorealistic');

  useEffect(() => {
    setPrompt(suggestedPrompt);
  }, [suggestedPrompt]);
  
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
        window.addEventListener('keydown', handleEscape);
    }
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(prompt, selectedStyle);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in"
      style={{ animationDuration: '0.3s' }}
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-6 w-full max-w-lg flex flex-col text-white transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Create an Image</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl w-8 h-8">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the image you want to create..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Style</label>
            <div className="flex flex-wrap gap-2">
              {styles.map(style => (
                <StyleButton key={style} style={style} isSelected={selectedStyle === style} onClick={setSelectedStyle} />
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 text-white rounded-lg py-2 px-5 font-bold hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white rounded-lg py-2 px-5 font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-500"
              disabled={!prompt.trim()}
            >
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImageGenerationModal;
