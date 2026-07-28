import { ScrollView, StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvents } from '../../../src/providers/EventProvider';
import { useBabies } from '../../../src/providers/BabyProvider';
import {
  isSameLocalDay,
  summarizeEvents,
} from '../../../src/utils/eventSummary';

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export default function StatsScreen() {
  const theme = useTheme();
  const { selectedBaby } = useBabies();
  const { events } = useEvents();

  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const dayEvents = events.filter(event => isSameLocalDay(event.startTime, date));
    const summary = summarizeEvents(dayEvents);
    return {
      date,
      feeds: summary.feeds,
      diapers: summary.diapers,
      sleepMinutes: summary.sleepMinutes,
    };
  });

  const totals = days.reduce(
    (summary, day) => ({
      feeds: summary.feeds + day.feeds,
      diapers: summary.diapers + day.diapers,
      sleepMinutes: summary.sleepMinutes + day.sleepMinutes,
    }),
    { feeds: 0, diapers: 0, sleepMinutes: 0 },
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          7-day summary
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {selectedBaby?.name || 'Baby'} · a simple view of recent care
        </Text>

        <View style={styles.totalRow}>
          <Surface style={styles.totalCard} elevation={1}>
            <Text variant="headlineSmall">{totals.feeds}</Text>
            <Text variant="bodySmall">Feeds</Text>
          </Surface>
          <Surface style={styles.totalCard} elevation={1}>
            <Text variant="headlineSmall">{totals.diapers}</Text>
            <Text variant="bodySmall">Nappies</Text>
          </Surface>
          <Surface style={styles.totalCard} elevation={1}>
            <Text variant="headlineSmall">
              {(totals.sleepMinutes / 60).toFixed(1)}h
            </Text>
            <Text variant="bodySmall">Sleep</Text>
          </Surface>
        </View>

        <Text variant="titleLarge" style={styles.sectionTitle}>
          By day
        </Text>
        {days.map(day => (
          <Surface key={dateKey(day.date)} style={styles.dayRow} elevation={1}>
            <View style={styles.dayLabel}>
              <Text variant="titleMedium">
                {day.date.toLocaleDateString([], { weekday: 'short' })}
              </Text>
              <Text variant="bodySmall" style={styles.dayDate}>
                {day.date.toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={styles.dayMetric}>
              <Text variant="titleMedium">{day.feeds}</Text>
              <Text variant="bodySmall">feeds</Text>
            </View>
            <View style={styles.dayMetric}>
              <Text variant="titleMedium">{day.diapers}</Text>
              <Text variant="bodySmall">nappies</Text>
            </View>
            <View style={styles.dayMetric}>
              <Text variant="titleMedium">
                {(day.sleepMinutes / 60).toFixed(1)}
              </Text>
              <Text variant="bodySmall">sleep h</Text>
            </View>
          </Surface>
        ))}

        <Text variant="bodySmall" style={styles.note}>
          This summary is for everyday tracking only and is not medical advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.65,
  },
  totalRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  totalCard: {
    flex: 1,
    borderRadius: 16,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  dayRow: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayLabel: {
    width: 66,
  },
  dayDate: {
    opacity: 0.6,
  },
  dayMetric: {
    flex: 1,
    alignItems: 'center',
  },
  note: {
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 18,
  },
});
