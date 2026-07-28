import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventCard from '../../../src/components/EventCard';
import EventEditModal from '../../../src/components/EventEditModal';
import { BabyEvent } from '../../../src/services/firebase/events';
import { useEvents } from '../../../src/providers/EventProvider';
import { useBabies } from '../../../src/providers/BabyProvider';

export default function TimelineScreen() {
  const theme = useTheme();
  const { selectedBaby } = useBabies();
  const { events, loading, error, editEvent, deleteEvent } = useEvents();
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);

  const sections = useMemo(() => {
    const grouped = new Map<string, BabyEvent[]>();
    events.forEach(event => {
      const key = event.startTime.toDateString();
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });

    return Array.from(grouped.entries()).map(([key, data]) => ({
      title: new Date(key).toLocaleDateString([], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      data,
    }));
  }, [events]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Timeline
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {selectedBaby?.name || 'Baby'} · tap a log to correct it
        </Text>
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id!}
          renderSectionHeader={({ section }) => (
            <Text
              variant="labelLarge"
              style={[
                styles.sectionHeader,
                { backgroundColor: theme.colors.background },
              ]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => setEditingEvent(item)} />
          )}
          contentContainerStyle={
            sections.length ? styles.listContent : styles.emptyContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text variant="titleMedium">No activity yet</Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Logs from the Home screen will appear here.
              </Text>
              {error ? (
                <Text style={{ color: theme.colors.error, marginTop: 12 }}>
                  {error}
                </Text>
              ) : null}
            </View>
          }
          stickySectionHeadersEnabled
        />
      )}
      <EventEditModal
        visible={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={editEvent}
        onDelete={deleteEvent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 3,
    opacity: 0.65,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 28,
  },
  emptyContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 6,
    opacity: 0.65,
    textAlign: 'center',
  }
});
