import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Icon, Surface, Text } from 'react-native-paper';

interface QuickLogButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
}

export default function QuickLogButton({
  title,
  icon,
  color,
  onPress,
  accessibilityHint,
  disabled = false,
}: QuickLogButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => (
        <Surface
          style={[
            styles.button,
            {
              backgroundColor: color,
              opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
          elevation={pressed ? 1 : 2}
        >
          <Icon source={icon} size={32} color="#302C3B" />
          <Text variant="titleMedium" style={styles.text}>
            {title}
          </Text>
        </Surface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '30%',
    minWidth: 96,
    aspectRatio: 1.05,
  },
  button: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: 'bold',
    color: '#302C3B',
  }
});
