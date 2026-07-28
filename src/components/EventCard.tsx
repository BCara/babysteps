import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Icon, Text, Surface } from 'react-native-paper';
import { BabyEvent } from '../services/firebase/events';
import { eventColors } from '../theme/eventColors';

interface EventCardProps {
  event: BabyEvent;
  onPress?: () => void;
}

const eventIcon: Record<BabyEvent['type'], string> = {
  feed: 'baby-bottle-outline',
  sleep: 'sleep',
  diaper: 'human-baby-changing-table',
};

const eventLabel = (event: BabyEvent) => {
  if (event.type === 'diaper') {
    const condition = event.metadata?.diaperCondition;
    return condition ? `${condition} nappy` : 'nappy';
  }
  if (event.type === 'feed') {
    return event.metadata?.feedType === 'breast' ? 'breastfeed' : 'feed';
  }
  return 'sleep';
};

const eventDetail = (event: BabyEvent) => {
  if (event.type === 'feed') {
    const amount = event.metadata?.amount;
    const unit = event.metadata?.unit;
    if (amount && unit) return `${amount} ${unit}`;
    if (event.durationMinutes) return `${event.durationMinutes} min`;
  }
  if (event.type === 'sleep') {
    if (!event.endTime) return 'In progress';
    if (event.durationMinutes) return `${event.durationMinutes} min`;
  }
  return '';
};

export default function EventCard({ event, onPress }: EventCardProps) {
  const color = eventColors[event.type] || '#E0E0E0';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      {({ pressed }) => (
        <Surface
          style={[
            styles.card,
            { borderLeftColor: color },
            pressed && styles.pressed,
          ]}
          elevation={1}
        >
          <View style={[styles.icon, { backgroundColor: color }]}>
            <Icon source={eventIcon[event.type]} size={24} color="#302C3B" />
          </View>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text variant="titleMedium" style={styles.label}>
                {eventLabel(event)}
              </Text>
              <Text variant="bodySmall" style={styles.time}>
                {formatTime(event.startTime)}
              </Text>
            </View>
            {eventDetail(event) ? (
              <Text variant="bodyMedium">{eventDetail(event)}</Text>
            ) : null}
            {event.notes ? (
              <Text variant="bodySmall" numberOfLines={2} style={styles.notes}>
                {event.notes}
              </Text>
            ) : null}
          </View>
          {onPress ? <Icon source="chevron-right" size={20} /> : null}
        </Surface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.78,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    textTransform: 'capitalize',
  },
  time: {
    opacity: 0.62,
  },
  notes: {
    marginTop: 4,
    opacity: 0.72,
  },
});
