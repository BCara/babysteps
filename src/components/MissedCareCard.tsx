import { StyleSheet, View } from 'react-native';
import { Button, Icon, Surface, Text } from 'react-native-paper';
import { useCarePalette } from '../hooks/useCarePalette';
import { eventColors } from '../theme/eventColors';
import type { MissedCareSuggestion } from '../utils/missedCare';

interface Props {
  suggestion: MissedCareSuggestion;
  onAdd: () => void;
  onDismiss: () => void;
}

const clock = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * A quiet question, not an alert: one line on what looks missing and the time
 * it would go, with "Add it" opening a form that can be changed before saving.
 */
export default function MissedCareCard({ suggestion, onAdd, onDismiss }: Props) {
  const { careColor, careInk } = useCarePalette();
  const isSleep = suggestion.kind === 'sleep';
  const noun = isSleep ? 'sleep' : 'feed';
  const between = suggestion.open
    ? `since ${clock(suggestion.gapStart)}`
    : `between ${clock(suggestion.gapStart)} and ${clock(suggestion.gapEnd)}`;
  const guess = isSleep && suggestion.endTime
    ? `${clock(suggestion.startTime)}–${clock(suggestion.endTime)}`
    : `around ${clock(suggestion.startTime)}`;

  return (
    <Surface elevation={0} style={[styles.card, { backgroundColor: careColor(eventColors[noun]) }]}>
      <View style={styles.row}>
        <Icon
          source={isSleep ? 'sleep' : 'baby-bottle-outline'}
          size={20}
          color={careInk}
        />
        <View style={styles.copy}>
          <Text variant="titleSmall" style={[styles.title, { color: careInk }]}>
            Missed a {noun}?
          </Text>
          <Text variant="bodySmall" style={{ color: careInk }}>
            No {noun} logged {between}. Add one {guess}?
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          compact
          mode="text"
          textColor={careInk}
          onPress={onDismiss}
          accessibilityLabel={`No ${noun} was missed`}
          accessibilityHint="Hides this suggestion. You will not be asked about this gap again."
        >
          No
        </Button>
        <Button
          compact
          mode="contained-tonal"
          onPress={onAdd}
          accessibilityHint={`Opens a ${noun} entry filled in with this time, ready to change before saving.`}
        >
          Add it
        </Button>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    borderRadius: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
});
