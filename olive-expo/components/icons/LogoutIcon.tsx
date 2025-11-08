import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface LogoutIconProps {
  color?: string;
  size?: number;
}

const LogoutIcon: React.FC<LogoutIconProps> = ({ color = 'currentColor', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default LogoutIcon;

