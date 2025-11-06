
import React from 'react';

const OliveBranchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14 10s-1-4-5-4-5 4-5 4" />
    <path d="M12 22s-4-2-4-6 4-6 4-6" />
    <path d="M12 22s4-2 4-6-4-6-4-6" />
    <path d="M12 10V2" />
    <path d="M12 2l4 2-4 2-4-2z" />
    <path d="M5 12s-2 2-2 4 2 4 2 4" />
    <path d="M19 12s2 2 2 4-2 4-2 4" />
  </svg>
);

export default OliveBranchIcon;
