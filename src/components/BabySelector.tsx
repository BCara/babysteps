import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, TouchableRipple } from 'react-native-paper';

interface BabySelectorProps {
  currentBabyName: string;
  onPress: () => void;
}

export default function BabySelector({ currentBabyName, onPress }: BabySelectorProps) {
  return (
    <TouchableRipple onPress={onPress} style={styles.container}>
      <Surface style={styles.pill} elevation={0}>
        <Text variant="titleMedium" style={styles.text}>{currentBabyName}</Text>
      </Surface>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E8E5FA',
    borderRadius: 20,
  },
  text: {
    color: '#2D2764',
    fontWeight: 'bold',
  }
});
