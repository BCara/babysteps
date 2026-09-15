import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Icon,
  Text,
  Surface,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

interface BabySelectorProps {
  currentBabyName: string;
  currentBabyAge?: string | null;
  onPress: () => void;
}

export default function BabySelector({
  currentBabyName,
  currentBabyAge,
  onPress,
}: BabySelectorProps) {
  const theme = useTheme();

  return (
    <TouchableRipple
      onPress={onPress}
      style={styles.container}
      borderless
      accessibilityRole="button"
      accessibilityLabel={`Caring for ${currentBabyName}${
        currentBabyAge ? `, age ${currentBabyAge}` : ''
      }`}
      accessibilityHint="Opens the baby selector"
    >
      <Surface
        style={[
          styles.pill,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
        elevation={0}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Icon
            source="baby-face-outline"
            size={18}
            color={theme.colors.onPrimary}
          />
        </View>
        <View style={styles.labelRow}>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={[
              styles.nameText,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {currentBabyName}
          </Text>
          {currentBabyAge ? (
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              style={[
                styles.ageText,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              · {currentBabyAge}
            </Text>
          ) : null}
        </View>
        <Icon
          source="chevron-down"
          size={20}
          color={theme.colors.onPrimaryContainer}
        />
      </Surface>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    maxWidth: 220,
    borderRadius: 24,
    overflow: 'hidden',
  },
  pill: {
    minHeight: 48,
    paddingLeft: 6,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  labelRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  nameText: {
    flexShrink: 1,
    fontWeight: '700',
  },
  ageText: {
    flexShrink: 0,
    fontWeight: '500',
  },
});
