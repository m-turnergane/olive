import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface CogIconProps {
  color?: string;
  size?: number;
}

const CogIcon: React.FC<CogIconProps> = ({ color = 'currentColor', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
    <Path
      d="M12 1v6m0 6v6m6-11h-6m6 0h6m-11 6H1m6 0H1m16.5-9.5L15 8m0 0l-2.5 2.5M8 15l-2.5 2.5M15 16l2.5 2.5M8 9L5.5 6.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default CogIcon;

