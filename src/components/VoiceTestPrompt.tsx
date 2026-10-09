import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useVoiceTestLog } from '../hooks/useVoiceTestLog';

interface Props {
  /** The logged attempt to answer; nothing renders without one. */
  entryId: string | null;
  color?: string;
}

/** Voice testing only: asks whether the last voice attempt was right. */
export default function VoiceTestPrompt({ entryId, color }: Props) {
  const theme = useTheme();
  const { entries, answer } = useVoiceTestLog();
  const entry = entryId ? entries.find(item => item.id === entryId) : undefined;
  if (!entry) return null;

  const textColor = color ?? theme.colors.onSurfaceVariant;

  if (entry.answer) {
    return (
      <Text variant="labelSmall" style={[styles.done, { color: textColor }]}>
        Voice test: logged as {entry.answer === 'yes' ? 'right' : 'wrong'}
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      <Text variant="labelMedium" style={[styles.question, { color: textColor }]}>
        Voice test: right?
      </Text>
      <Button
        compact
        mode="outlined"
        icon="thumb-up-outline"
        onPress={() => answer(entry.id, 'yes')}
        textColor={textColor}
        accessibilityLabel="Voice test: yes, that was right"
      >
        Yes
      </Button>
      <Button
        compact
        mode="outlined"
        icon="thumb-down-outline"
        onPress={() => answer(entry.id, 'no')}
        textColor={textColor}
        accessibilityLabel="Voice test: no, that was wrong"
      >
        No
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  question: {
    marginRight: 2,
  },
  done: {
    marginTop: 8,
  },
});
