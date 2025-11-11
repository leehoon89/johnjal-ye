
import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 tracking-wider animate-fade-in" style={{ fontFamily: `'Times New Roman', serif` }}>
          John.Jal&Ye
        </h1>
        <p className="text-gray-400 text-lg animate-fade-in" style={{ animationDelay: '0.5s', opacity: 0 }}>
          Loading your AI companions...
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;