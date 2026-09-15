import { useFocusEffect } from '@react-navigation/native';
import { formatBabyAgeAtDate } from '../../../src/utils/babyAge';
import { reviewTimeline } from '../../../src/utils/timelineReview';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  IconButton,
  Menu,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import TimelineEventRow from '../../../src/components/TimelineEventRow';
import EventEditModal from '../../../src/components/EventEditModal';
import { BabyEvent, BabyEventType } from '../../../src/services/firebase/events';
import { useEvents } from '../../../src/providers/EventProvider';
import { useBabies } from '../../../src/providers/BabyProvider';
import AdBanner from '../../../src/components/AdBanner';
import CareLogModal, { AdditionalCareType, CareLogInput } from '../../../src/components/CareLogModal';
import {
  isActiveBabyEvent,
  shiftedEventTimes,
  usesEventEditModal,
} from '../../../src/utils/eventEditing';
import {
  describeMergeResult,
  mergeBlocker,
} from '../../../src/utils/mergeEvents';
import { careActions, careActionByType } from '../../../src/constants/careActions';
import {
  filterTimelineEvents,
  TimelineTypeFilter,
} from '../../../src/utils/timelineFilters';

interface TimelineTypeMenuProps {
  selectedType: TimelineTypeFilter;
  selectedTypeLabel: string;
  entryCount: number;
  onSelect: (type: TimelineTypeFilter) => void;
}

const TimelineTypeMenu = memo(function TimelineTypeMenu({
  selectedType,
  selectedTypeLabel,
  entryCount,
  onSelect,
}: TimelineTypeMenuProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  const selectType = (type: TimelineTypeFilter) => {
    setVisible(false);
    onSelect(type);
  };

  return (
    <View style={styles.filterRow}>
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <Button
            mode="outlined"
            icon="filter-variant"
            onPress={() => setVisible(true)}
            accessibilityLabel={`Filter activity by type. ${selectedTypeLabel} selected`}
          >
            {selectedTypeLabel}
          </Button>
        }
      >
        <ScrollView style={styles.typeMenu}>
          <Menu.Item
            leadingIcon="view-list-outline"
            title="All activity"
            onPress={() => selectType('all')}
            trailingIcon={selectedType === 'all' ? 'check' : undefined}
          />
          {careActions.map(action => (
            <Menu.Item
              key={action.type}
              leadingIcon={action.icon}
              title={action.pluralLabel}
              onPress={() => selectType(action.type as BabyEventType)}
              trailingIcon={selectedType === action.type ? 'check' : undefined}
            />
          ))}
        </ScrollView>
      </Menu>
      <Text
        variant="bodySmall"
        style={[styles.filterCount, { color: theme.colors.onSurfaceVariant }]}
      >
        {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
      </Text>
    </View>
  );
});

export default function ActivityScreen() {
  const theme = useTheme();
  const { selectedBaby } = useBabies();
  const {
    events,
    activeFeed,
    activeSleep,
    activePumping,
    loading,
    error,
    editEvent,
    deleteEvent,
    deleteEvents,
    mergeEvents,
  } = useEvents();
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [editingCareEvent, setEditingCareEvent] = useState<BabyEvent | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [reviewNow, setReviewNow] = useState(() => new Date());
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedType, setSelectedType] = useState<TimelineTypeFilter>('all');

  useFocusEffect(useCallback(() => {
    setReviewNow(new Date());
    const timer = setInterval(() => setReviewNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []));
  const reviews = useMemo(() => reviewTimeline(events, reviewNow), [events, reviewNow]);
  const babyAge = selectedBaby
    ? formatBabyAgeAtDate(selectedBaby.dateOfBirth, reviewNow)
    : null;

  const filteredEvents = useMemo(
    () => filterTimelineEvents(events, selectedType).filter(event => !reviewOnly || reviews.has(event.id!)),
    [events, selectedType, reviewOnly, reviews],
  );

  const sections = useMemo(() => {
    const grouped = new Map<string, BabyEvent[]>();
    filteredEvents.forEach(event => {
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
  }, [filteredEvents]);

  const selectedTypeLabel =
    selectedType === 'all'
      ? 'All activity'
      : careActionByType[selectedType].pluralLabel;

  const chooseType = useCallback((type: TimelineTypeFilter) => {
    setSelectedType(type);
    setSelectedIds([]);
  }, []);

  const isActiveEvent = (event: BabyEvent) =>
    isActiveBabyEvent(event, {
      feed: activeFeed?.id,
      sleep: activeSleep?.id,
      pumping: activePumping?.id,
    });

  const selectedEvents = useMemo(
    () => events.filter(event => event.id && selectedIds.includes(event.id)),
    [events, selectedIds],
  );
  const selecting = selectedIds.length > 0;
  const mergeProblem = selecting ? mergeBlocker(selectedEvents) : null;

  const clearSelection = () => setSelectedIds([]);

  const toggleSelected = (event: BabyEvent) => {
    if (!event.id || isActiveEvent(event)) return;
    const eventId = event.id;
    setSelectedIds(current =>
      current.includes(eventId)
        ? current.filter(id => id !== eventId)
        : [...current, eventId],
    );
  };

  const runBulkAction = async (action: () => Promise<void>, fallback: string) => {
    setBulkBusy(true);
    try {
      await action();
      clearSelection();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : fallback);
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmDeleteSelected = () => {
    const count = selectedIds.length;
    Alert.alert(
      count === 1 ? 'Delete this activity?' : `Delete ${count} activities?`,
      'They will be removed from the shared timeline.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void runBulkAction(async () => {
              await deleteEvents(selectedIds);
              setNotice(
                count === 1 ? 'Activity deleted' : `${count} activities deleted`,
              );
            }, 'Unable to delete these activities.'),
        },
      ],
    );
  };

  const confirmMergeSelected = () => {
    if (mergeProblem) {
      setNotice(mergeProblem);
      return;
    }

    Alert.alert('Merge these activities?', describeMergeResult(selectedEvents), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: () =>
          void runBulkAction(async () => {
            await mergeEvents(selectedIds);
            setNotice('Activities merged');
          }, 'Unable to merge these activities.'),
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Activity
        </Text>
        <View style={styles.babyRow}>
          <Text variant="titleLarge" style={styles.babyName}>
            {selectedBaby?.name || 'Baby'}
          </Text>
          {babyAge ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {babyAge} old
            </Text>
          ) : null}
        </View>
        <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Tap to edit · Hold to select
        </Text>
      </View>
      {!selecting ? (
        <TimelineTypeMenu
          selectedType={selectedType}
          selectedTypeLabel={selectedTypeLabel}
          entryCount={filteredEvents.length}
          onSelect={chooseType}
        />
      ) : null}
      {!selecting ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <View style={styles.reviewActions}>
          <Button mode={reviewOnly ? 'contained-tonal' : 'text'} icon="playlist-check"
            style={styles.reviewButton}
            onPress={() => { setReviewOnly(value => !value); setSelectedIds([]); }}>
            {reviewOnly ? 'Show all entries' : `Review flagged entries (${reviews.size})`}
          </Button>
          <IconButton icon="information-outline" size={20}
            style={styles.reviewInfo}
            accessibilityLabel="Why is an entry flagged?"
            onPress={() => Alert.alert(
            'About timeline flags',
            'Check duration: feeds over 90 minutes, pumping over 60 minutes, and sleep over 12 hours. These are review prompts, not medical limits. Also checks future dates, negative durations and overlapping sessions.\n\nPossible merge: compatible completed feed, sleep or pumping sessions up to 10 minutes apart. Review the details before merging; entries may be separate sessions.',
          )} />
          </View>
        </View>
      ) : null}
      {selecting ? (
        <Surface
          style={[
            styles.selectionBar,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
          elevation={1}
        >
          <View style={styles.selectionHeader}>
            <IconButton
              icon="close"
              size={20}
              onPress={clearSelection}
              disabled={bulkBusy}
              accessibilityLabel="Clear selection"
              style={styles.selectionClose}
            />
            <Text variant="titleMedium" style={styles.selectionCount}>
              {selectedIds.length} selected
            </Text>
            <Button
              mode="text"
              icon="call-merge"
              onPress={confirmMergeSelected}
              disabled={bulkBusy || Boolean(mergeProblem)}
              accessibilityHint="Combines the selected activities into one entry"
            >
              Merge
            </Button>
            <Button
              mode="text"
              icon="delete-outline"
              textColor={theme.colors.error}
              onPress={confirmDeleteSelected}
              loading={bulkBusy}
              disabled={bulkBusy}
            >
              Delete
            </Button>
          </View>
          <Text
            variant="bodySmall"
            style={[
              styles.selectionHint,
              { color: theme.colors.onPrimaryContainer },
            ]}
          >
            {mergeProblem || 'Tap more activities to add them to the selection.'}
          </Text>
        </Surface>
      ) : null}
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
            <TimelineEventRow
              event={item}
              review={reviews.get(item.id!)}
              onReviewMerge={() => {
                const otherId = reviews.get(item.id!)?.mergeWithId;
                if (item.id && otherId) setSelectedIds([item.id, otherId]);
              }}
              active={isActiveEvent(item)}
              selectable={selecting && !isActiveEvent(item)}
              selected={Boolean(item.id && selectedIds.includes(item.id))}
              onDelete={deleteEvent}
              onDeleted={() => setNotice('Activity deleted')}
              onError={setNotice}
              onLongPress={() => toggleSelected(item)}
              onPress={
                isActiveEvent(item)
                  ? undefined
                  : selecting
                    ? () => toggleSelected(item)
                    : () => {
                        if (usesEventEditModal(item.type)) {
                          setEditingEvent(item);
                        } else {
                          setEditingCareEvent(item);
                        }
                      }
              }
            />
          )}
          contentContainerStyle={
            sections.length ? styles.listContent : styles.emptyContent
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text variant="titleMedium">
                {reviewOnly ? 'No flagged entries in this view' : selectedType === 'all'
                  ? 'No activity yet'
                  : `No ${selectedTypeLabel.toLowerCase()} yet`}
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {reviewOnly ? 'Show all entries to return to your timeline.' : selectedType === 'all'
                  ? 'Logs from the Home screen will appear here.'
                  : 'Choose another type or show all activity.'}
              </Text>
              {selectedType !== 'all' ? (
                <Button
                  mode="text"
                  onPress={() => chooseType('all')}
                  style={styles.showAllButton}
                >
                  Show all activity
                </Button>
              ) : null}
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
      <AdBanner />
      <EventEditModal
        visible={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={editEvent}
        onDelete={deleteEvent}
      />
      <CareLogModal
        visible={Boolean(editingCareEvent)}
        type={(editingCareEvent?.type as AdditionalCareType) || null}
        event={editingCareEvent}
        onClose={() => setEditingCareEvent(null)}
        onSave={async (input: CareLogInput) => {
          if (!editingCareEvent?.id) return;
          await editEvent(editingCareEvent.id, {
            ...(input.startTime
              ? shiftedEventTimes(editingCareEvent, input.startTime)
              : {}),
            durationMinutes: input.durationMinutes,
            notes: input.notes?.trim() || '',
            metadata: input.metadata,
          });
        }}
        onDelete={deleteEvent}
      />
      <Snackbar
        visible={Boolean(notice)}
        onDismiss={() => setNotice('')}
        duration={3000}
      >
        {notice}
      </Snackbar>
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
    marginTop: 6,
  },
  babyRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 10,
    rowGap: 2,
  },
  babyName: {
    fontWeight: '700',
    flexShrink: 1,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterCount: {
    flexShrink: 0,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewButton: {
    flexShrink: 1,
  },
  reviewInfo: {
    margin: 0,
    width: 44,
    height: 44,
  },
  typeMenu: {
    maxHeight: 420,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingBottom: 10,
    borderRadius: 16,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  selectionClose: {
    margin: 2,
  },
  selectionCount: {
    flex: 1,
    fontWeight: '700',
  },
  selectionHint: {
    paddingHorizontal: 14,
    marginTop: -4,
    lineHeight: 17,
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
  },
  showAllButton: {
    marginTop: 8,
  },
});
