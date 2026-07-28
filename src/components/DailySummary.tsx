import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { BabyEvent } from '../services/firebase/events';
import { summarizeEvents } from '../utils/eventSummary';

interface DailySummaryProps {
  events: BabyEvent[];
}

const formatSleep = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

export default function DailySummary({ events }: DailySummaryProps) {
  const summary = summarizeEvents(events);

  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleMedium" style={styles.title}>
        Today
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text variant="headlineSmall">{summary.feeds}</Text>
          <Text variant="bodySmall">Feeds</Text>
        </View>
        <View style={styles.statBox}>
          <Text variant="headlineSmall">{summary.diapers}</Text>
          <Text variant="bodySmall">Nappies</Text>
        </View>
        <View style={styles.statBox}>
          <Text variant="headlineSmall">{formatSleep(summary.sleepMinutes)}</Text>
          <Text variant="bodySmall">Sleep</Text>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 4,
    minHeight: 76,
    justifyContent: 'center',
  }
});
