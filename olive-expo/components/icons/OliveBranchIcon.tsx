import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface OliveBranchIconProps {
  color?: string;
  size?: number;
}

const OliveBranchIcon: React.FC<OliveBranchIconProps> = ({ color = 'currentColor', size = 64 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill={color} fillOpacity={0.1}>
    <Path d="M32 8c-4 0-8 2-10 6-2-4-6-6-10-6-6 0-10 4-10 10 0 8 8 16 20 24 12-8 20-16 20-24 0-6-4-10-10-10z" />
    <Path d="M32 24c-2 4-4 8-4 12 0 6 4 10 10 10s10-4 10-10c0-4-2-8-4-12-2 2-6 4-12 4-6 0-10-2-12-4z" />
    <Path d="M20 36c0 4 2 8 6 10-4 2-8 6-8 10 0 6 4 10 10 10 4 0 8-2 10-6 2 4 6 6 10 6 6 0 10-4 10-10 0-4-4-8-8-10 4-2 6-6 6-10 0-6-4-10-10-10-4 0-8 2-10 6-2-4-6-6-10-6-6 0-10 4-10 10z" />
  </Svg>
);

export default OliveBranchIcon;

