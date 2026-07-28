import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { BabyEvent } from '../services/firebase/events';
import { eventColors } from '../theme/eventColors';

interface EventCardProps {
  event: BabyEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const color = eventColors[event.type] || '#E0E0E0';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Surface style={[styles.card, { borderLeftColor: color }]} elevation={1}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ textTransform: 'capitalize' }}>
            {event.type}
          </Text>
          <Text variant="bodySmall" style={styles.time}>
            {formatTime(event.startTime)} 
            {event.endTime ? ` - ${formatTime(event.endTime)}` : ' (Ongoing)'}
          </Text>
        </View>
        
        {event.duration && (
          <Text variant="bodyMedium">Duration: {Math.round(event.duration)} min</Text>
        )}
        
        {event.notes && (
          <Text variant="bodyMedium" style={styles.notes}>{event.notes}</Text>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderLeftWidth: 6,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  time: {
    opacity: 0.6,
  },
  notes: {
    marginTop: 8,
    fontStyle: 'italic',
    opacity: 0.8,
  }
});
