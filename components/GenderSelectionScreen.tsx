
import React from 'react';
import type { UserGender } from '../types';

interface GenderSelectionScreenProps {
  onSelect: (gender: UserGender) => void;
}

const GenderButton: React.FC<{
  gender: UserGender,
  label: string,
  colorClasses: string,
  onClick: (gender: UserGender) => void 
}> = ({ gender, label, colorClasses, onClick }) => (
  <button
    onClick={() => onClick(gender)}
    className={`w-48 h-48 md:w-64 md:h-64 rounded-2xl text-white font-bold text-3xl flex items-center justify-center 
               transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${colorClasses}`}
  >
    {label}
  </button>
);


const GenderSelectionScreen: React.FC<GenderSelectionScreenProps> = ({ onSelect }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white p-4">
      <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Who would you like to talk to?</h2>
      <p className="text-gray-400 mb-12 text-center">Your choice will determine the characters you see.</p>
      <div className="flex flex-col md:flex-row gap-8">
        <GenderButton 
          gender="female"
          label="Women"
          colorClasses="bg-gradient-to-br from-pink-500 to-orange-400 hover:shadow-pink-500/50"
          onClick={onSelect}
        />
        <GenderButton 
          gender="male"
          label="Men"
          colorClasses="bg-gradient-to-br from-blue-500 to-teal-400 hover:shadow-blue-500/50"
          onClick={onSelect}
        />
      </div>
    </div>
  );
};

export default GenderSelectionScreen;