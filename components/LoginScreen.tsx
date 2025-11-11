
import React from 'react';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">Welcome Back</h1>
        <p className="text-gray-400 text-lg mb-10">Sign in to continue your conversations.</p>
      </div>
      <button
        onClick={onLogin}
        className="flex items-center justify-center bg-white text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-200 transition-all duration-300 shadow-lg transform hover:scale-105"
      >
        <svg className="w-6 h-6 mr-4" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M24 9.5c3.23 0 6.13 1.11 8.4 3.29l6.39-6.39C34.81 2.97 29.87 1 24 1 14.7 1 6.87 6.64 3.81 14.54l7.74 6.01C13.23 14.63 18.25 9.5 24 9.5z"></path>
          <path fill="#34A853" d="M46.19 24.5c0-1.62-.14-3.18-.4-4.69H24v9h12.45c-.54 2.92-2.19 5.42-4.71 7.12l7.74 6.01c4.52-4.17 7.11-10.31 7.11-17.44z"></path>
          <path fill="#FBBC05" d="M11.55 20.55C10.74 18.23 10.25 15.7 10.25 13.09c0-2.61.49-5.14 1.3-7.46L3.81 0C1.4 4.14 0 8.86 0 14.09c0 5.23 1.4 9.95 3.81 14.09l7.74-6.01z"></path>
          <path fill="#EA4335" d="M24 47c5.87 0 10.81-1.97 14.42-5.31l-7.74-6.01c-1.92 1.29-4.38 2.07-7.18 2.07-5.75 0-10.77-5.13-12.45-11.97l-7.74 6.01C6.87 40.36 14.7 47 24 47z"></path>
          <path fill="none" d="M0 0h48v48H0z"></path>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
};

export default LoginScreen;