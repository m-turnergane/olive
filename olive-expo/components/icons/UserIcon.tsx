import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface UserIconProps {
  color?: string;
  size?: number;
}

const UserIcon: React.FC<UserIconProps> = ({ color = 'currentColor', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} />
    <Path
      d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default UserIcon;

