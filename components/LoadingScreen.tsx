import React from 'react';
import OliveBranchIcon from './icons/OliveBranchIcon';

const LoadingScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-olive-deep text-olive-light animate-fade-in">
    <div className="relative">
      <OliveBranchIcon className="w-24 h-24 text-olive-mint" />
      <div className="absolute top-0 left-0 w-full h-full border-4 border-olive-sage rounded-full animate-spin border-t-transparent"></div>
    </div>
    <p className="mt-4 text-lg tracking-wider">Loading...</p>
  </div>
);

export default LoadingScreen;
