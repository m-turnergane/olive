import React from 'react';
import OliveBranchIcon from './icons/OliveBranchIcon';

const BackgroundPattern: React.FC = () => {
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-24">
                <OliveBranchIcon className="w-64 h-64 text-olive-deep/5 opacity-50 transform -rotate-45" />
            </div>
            <div className="absolute -bottom-20 -right-20">
                <OliveBranchIcon className="w-56 h-56 text-olive-deep/5 opacity-50 transform rotate-12" />
            </div>
             <div className="absolute top-1/3 -right-24">
                <OliveBranchIcon className="w-48 h-48 text-olive-deep/5 opacity-50 transform rotate-45" />
            </div>
        </div>
    );
};

export default BackgroundPattern;