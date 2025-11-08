import React from 'react';
import { View, StyleSheet } from 'react-native';
import OliveBranchIcon from './icons/OliveBranchIcon';

const BackgroundPattern: React.FC = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.topLeft}>
        <OliveBranchIcon size={256} color="#1B3A2F" />
      </View>
      <View style={styles.bottomRight}>
        <OliveBranchIcon size={224} color="#1B3A2F" />
      </View>
      <View style={styles.middleRight}>
        <OliveBranchIcon size={192} color="#1B3A2F" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  topLeft: {
    position: 'absolute',
    top: -96,
    left: -96,
    opacity: 0.5,
    transform: [{ rotate: '-45deg' }],
  },
  bottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    opacity: 0.5,
    transform: [{ rotate: '12deg' }],
  },
  middleRight: {
    position: 'absolute',
    top: '33%',
    right: -96,
    opacity: 0.5,
    transform: [{ rotate: '45deg' }],
  },
});

export default BackgroundPattern;

