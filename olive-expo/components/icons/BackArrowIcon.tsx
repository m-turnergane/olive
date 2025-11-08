import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface BackArrowIconProps {
  color?: string;
  size?: number;
}

const BackArrowIcon: React.FC<BackArrowIconProps> = ({ color = 'currentColor', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5m0 0l7 7m-7-7l7-7"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default BackArrowIcon;

