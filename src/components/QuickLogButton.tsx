import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';

interface QuickLogButtonProps {
  title: string;
  icon?: string;
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function QuickLogButton({ title, color, onPress, onLongPress }: QuickLogButtonProps) {
  const theme = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring' }}
      style={styles.wrapper}
    >
      <Pressable onPress={onPress} onLongPress={onLongPress}>
        {({ pressed }) => (
          <Surface 
            style={[
              styles.button, 
              { backgroundColor: color },
              pressed && styles.pressed
            ]} 
            elevation={pressed ? 1 : 2}
          >
            <Text variant="titleMedium" style={styles.text}>{title}</Text>
          </Surface>
        )}
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '45%',
    aspectRatio: 1,
  },
  button: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  text: {
    fontWeight: 'bold',
    color: '#333333',
  }
});
