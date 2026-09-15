import type { TimelineReview } from '../utils/timelineReview';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { Swipeable } from 'react-native-gesture-handler';
import type { BabyEvent } from '../services/firebase/events';
import EventCard from './EventCard';

interface Props {
  review?: TimelineReview;
  onReviewMerge?: () => void;
  event: BabyEvent;
  active?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete: (eventId: string) => Promise<void>;
  onDeleted?: () => void;
  onError?: (message: string) => void;
}

export default function TimelineEventRow({
  event,
  review,
  onReviewMerge,
  active = false,
  selected = false,
  selectable = false,
  onPress,
  onLongPress,
  onDelete,
  onDeleted,
  onError,
}: Props) {
  const theme = useTheme();
  const swipeable = useRef<Swipeable>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    if (!event.id || deleting || active) return;
    Alert.alert(
      'Delete this activity?',
      'It will be removed from the shared timeline.',
      [
        {
          text: 'Keep it',
          style: 'cancel',
          onPress: () => swipeable.current?.close(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(event.id!);
              onDeleted?.();
            } catch (nextError) {
              swipeable.current?.close();
              onError?.(
                nextError instanceof Error
                  ? nextError.message
                  : 'Unable to delete this activity.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Swipeable
      ref={swipeable}
      enabled={!active && !deleting && !selectable}
      friction={2}
      rightThreshold={42}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete activity"
          accessibilityHint="Asks for confirmation before deleting this activity"
          onPress={confirmDelete}
          disabled={deleting}
          style={({ pressed }) => [
            styles.deleteAction,
            { backgroundColor: theme.colors.error },
            pressed && styles.pressed,
          ]}
        >
          <Icon source="delete-outline" size={25} color={theme.colors.onError} />
          <Text variant="labelLarge" style={{ color: theme.colors.onError }}>
            Delete
          </Text>
        </Pressable>
      )}
    >
      <EventCard
        event={event}
        review={review}
        onReviewMerge={onReviewMerge}
        onPress={onPress}
        onLongPress={active ? undefined : onLongPress}
        selected={selected}
        selectable={selectable}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    width: 104,
    marginRight: 16,
    marginVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.78,
  },
});
