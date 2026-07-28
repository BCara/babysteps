import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Menu,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import QuickLogButton from '../../../src/components/QuickLogButton';
import DailySummary from '../../../src/components/DailySummary';
import BabySelector from '../../../src/components/BabySelector';
import LogModal, { QuickLogInput } from '../../../src/components/LogModal';
import ActiveTimer from '../../../src/components/ActiveTimer';
import EventCard from '../../../src/components/EventCard';
import EventEditModal from '../../../src/components/EventEditModal';
import { eventColors } from '../../../src/theme/eventColors';
import { BabyEvent } from '../../../src/services/firebase/events';
import { useBabies } from '../../../src/providers/BabyProvider';
import { useEvents } from '../../../src/providers/EventProvider';

export default function HomeScreen() {
  const theme = useTheme();
  const { babies, selectedBaby, selectBaby, loading: babiesLoading } = useBabies();
  const {
    events,
    todayEvents,
    activeSleep,
    loading: eventsLoading,
    error: eventsError,
    logFeed,
    logDiaper,
    startSleep,
    stopSleep,
    editEvent,
    deleteEvent,
  } = useEvents();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'feed' | 'diaper' | null>(
    null,
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [sleepBusy, setSleepBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);

  if (babiesLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!selectedBaby) {
    return <Redirect href="/(app)/onboarding" />;
  }

  const openLog = (action: 'feed' | 'diaper') => {
    setSelectedAction(action);
    setLogModalVisible(true);
  };

  const handleSaveLog = async (input: QuickLogInput) => {
    if (input.type === 'feed') {
      await logFeed(input);
      setMessage('Feed logged');
    } else {
      await logDiaper(input.condition, input.notes);
      setMessage('Nappy logged');
    }
  };

  const handleSleep = async () => {
    setSleepBusy(true);
    try {
      if (activeSleep) {
        await stopSleep();
        setMessage('Sleep stopped');
      } else {
        await startSleep();
        setMessage('Sleep started');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update sleep.');
    } finally {
      setSleepBusy(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text variant="bodyMedium" style={styles.eyebrow}>
              Caring for
            </Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <BabySelector
                  currentBabyName={selectedBaby.name}
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              {babies.map(baby => (
                <Menu.Item
                  key={baby.id}
                  title={baby.name}
                  leadingIcon={
                    baby.id === selectedBaby.id ? 'check-circle' : 'baby-face-outline'
                  }
                  onPress={async () => {
                    setMenuVisible(false);
                    if (baby.id) await selectBaby(baby.id);
                  }}
                />
              ))}
            </Menu>
          </View>
          <Text variant="titleMedium">
            {new Date().toLocaleDateString([], {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>

        <DailySummary events={todayEvents} />

        {activeSleep ? (
          <ActiveTimer
            activityType="sleep"
            startTime={activeSleep.startTime}
            onStop={handleSleep}
            stopping={sleepBusy}
          />
        ) : null}

        <View style={styles.quickLogGrid}>
          <QuickLogButton
            title="Feed"
            icon="baby-bottle-outline"
            color={eventColors.feed}
            onPress={() => openLog('feed')}
            accessibilityHint="Opens the feed logging form"
          />
          <QuickLogButton
            title={activeSleep ? 'Stop sleep' : 'Sleep'}
            icon={activeSleep ? 'stop-circle-outline' : 'sleep'}
            color={eventColors.sleep}
            onPress={handleSleep}
            disabled={sleepBusy}
            accessibilityHint={
              activeSleep ? 'Stops the active sleep timer' : 'Starts a sleep timer'
            }
          />
          <QuickLogButton
            title="Nappy"
            icon="human-baby-changing-table"
            color={eventColors.diaper}
            onPress={() => openLog('diaper')}
            accessibilityHint="Opens the nappy logging form"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Recent activity
          </Text>
          {eventsLoading ? <ActivityIndicator size="small" /> : null}
        </View>
        {events.slice(0, 4).map(event => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => setEditingEvent(event)}
          />
        ))}
        {!eventsLoading && events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">Nothing logged yet</Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Use the buttons above to add the first feed, sleep or nappy.
            </Text>
          </View>
        ) : null}
        {eventsError ? (
          <View style={styles.errorState}>
            <Text style={{ color: theme.colors.error }}>{eventsError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <LogModal
        visible={logModalVisible}
        type={selectedAction}
        onClose={() => {
          setLogModalVisible(false);
          setSelectedAction(null);
        }}
        onSave={handleSaveLog}
      />
      <EventEditModal
        visible={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={editEvent}
        onDelete={deleteEvent}
      />
      <Snackbar
        visible={Boolean(message)}
        onDismiss={() => setMessage('')}
        duration={2600}
      >
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    opacity: 0.64,
    marginBottom: 2,
  },
  quickLogGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    justifyContent: 'space-between',
  },
  sectionHeader: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  emptyState: {
    margin: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.65,
    lineHeight: 20,
  },
  errorState: {
    margin: 16,
    padding: 16,
  },
});
