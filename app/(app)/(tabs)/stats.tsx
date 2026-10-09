import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  FAB,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvents } from '../../../src/providers/EventProvider';
import { useBabies } from '../../../src/providers/BabyProvider';
import {
  getEventDurationMinutes,
  isSameLocalDay,
  summarizeEvents,
} from '../../../src/utils/eventSummary';
import {
  buildCareDataJson,
  buildCareStatsCsv,
} from '../../../src/utils/statsExport';
import AdBanner from '../../../src/components/AdBanner';
import type { BabyEvent } from '../../../src/services/firebase/events';
import {
  careActionByType,
} from '../../../src/constants/careActions';
import {
  formatNursingDuration,
  summarizeNursingSides,
} from '../../../src/utils/breastFeed';
import SummaryDayNavigator from '../../../src/components/SummaryDayNavigator';
import DayTimeline from '../../../src/components/DayTimeline';
import EventEditModal from '../../../src/components/EventEditModal';
import CareLogModal, {
  AdditionalCareType,
  CareLogInput,
} from '../../../src/components/CareLogModal';
import AddEntryPicker from '../../../src/components/AddEntryPicker';
import AddEntrySheet from '../../../src/components/AddEntrySheet';
import type { HomeActionKey } from '../../../src/constants/careActions';
import {
  shiftedEventTimes,
  usesEventEditModal,
} from '../../../src/utils/eventEditing';
import {
  formatClock,
  timelineEventLabel,
} from '../../../src/utils/dayTimeline';

type MetricKey = 'feeds' | 'diapers' | 'sleepMinutes';
type ViewMode = 'today' | 'week' | 'insights';
type SummaryPage = 'overview' | 'feed' | 'sleep' | 'diaper';

interface DayStat {
  date: Date;
  feeds: number;
  diapers: number;
  sleepMinutes: number;
}

interface MetricDefinition {
  key: MetricKey;
  label: string;
  emptyLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

interface DayPart {
  label: string;
  range: string;
  startHour: number;
  endHour: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface Insight {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  value: string;
  detail: string;
  color: string;
}

interface DetailMetric {
  key: string;
  label: string;
  value: string;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

const metrics: MetricDefinition[] = [
  {
    key: 'feeds',
    label: 'Feeds',
    emptyLabel: 'feed',
    icon: 'baby-bottle-outline',
    color: '#E9826B',
  },
  {
    key: 'diapers',
    label: 'Nappies',
    emptyLabel: 'nappy',
    icon: 'human-baby-changing-table',
    color: '#55A57E',
  },
  {
    key: 'sleepMinutes',
    label: 'Sleep',
    emptyLabel: 'sleep',
    icon: 'weather-night',
    color: '#648FD8',
  },
];

const summaryPages: Array<{
  key: SummaryPage;
  label: string;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  metric?: MetricKey;
}> = [
  {
    key: 'overview',
    label: 'All care',
    title: 'Care summary',
    icon: 'view-dashboard-outline',
  },
  {
    key: 'feed',
    label: 'Feeds',
    title: 'Feed summary',
    icon: 'baby-bottle-outline',
    metric: 'feeds',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    title: 'Sleep summary',
    icon: 'weather-night',
    metric: 'sleepMinutes',
  },
  {
    key: 'diaper',
    label: 'Nappies',
    title: 'Nappy summary',
    icon: 'human-baby-changing-table',
    metric: 'diapers',
  },
];

const dayParts: DayPart[] = [
  {
    label: 'Overnight',
    range: '12am–6am',
    startHour: 0,
    endHour: 6,
    icon: 'weather-night',
  },
  {
    label: 'Morning',
    range: '6am–12pm',
    startHour: 6,
    endHour: 12,
    icon: 'weather-sunset-up',
  },
  {
    label: 'Afternoon',
    range: '12pm–6pm',
    startHour: 12,
    endHour: 18,
    icon: 'white-balance-sunny',
  },
  {
    label: 'Evening',
    range: '6pm–12am',
    startHour: 18,
    endHour: 24,
    icon: 'weather-sunset-down',
  },
];

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const metricValue = (day: DayStat, metric: MetricKey) =>
  metric === 'sleepMinutes' ? day.sleepMinutes / 60 : day[metric];

const formatValue = (value: number, metric: MetricKey, compact = false) => {
  if (metric === 'sleepMinutes') {
    const formatted = value.toFixed(value >= 10 ? 0 : 1);
    return compact ? `${formatted}h` : `${formatted} hours`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const formatAverage = (value: number, metric: MetricKey) => {
  if (metric === 'sleepMinutes' && value < 1) {
    return `${Math.round(value * 60)}m`;
  }
  return formatValue(value, metric, true);
};

const eventColor = (event: BabyEvent) =>
  event.type !== 'feed' && event.type !== 'sleep' && event.type !== 'diaper'
    ? careActionByType[event.type].color
    :
  metrics.find(metric =>
    event.type === 'diaper'
      ? metric.key === 'diapers'
      : event.type === 'sleep'
        ? metric.key === 'sleepMinutes'
        : metric.key === 'feeds',
  )?.color || metrics[0].color;

const eventHour = (event: BabyEvent) =>
  event.startTime.getHours() + event.startTime.getMinutes() / 60;

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatBottleAmount = (events: BabyEvent[]) => {
  const totals = events.reduce<Record<'ml' | 'oz', number>>(
    (amounts, event) => {
      const amount = event.metadata?.amount;
      const unit = event.metadata?.unit || 'ml';
      if (typeof amount === 'number' && amount > 0) amounts[unit] += amount;
      return amounts;
    },
    { ml: 0, oz: 0 },
  );
  const parts = (['ml', 'oz'] as const)
    .filter(unit => totals[unit] > 0)
    .map(unit => `${Number.isInteger(totals[unit]) ? totals[unit] : totals[unit].toFixed(1)}${unit}`);
  return parts.join(' + ');
};

const averageGapMinutes = (events: BabyEvent[]) => {
  const times = events
    .map(event => event.startTime.getTime())
    .sort((left, right) => left - right);
  if (times.length < 2) return null;
  const gaps = times
    .slice(1)
    .map((time, index) => time - times[index])
    .filter(gap => gap <= 12 * 60 * 60 * 1000);
  if (gaps.length === 0) return null;
  return gaps.reduce((total, gap) => total + gap, 0) / gaps.length / 60000;
};

export default function StatsScreen() {
  const theme = useTheme();
  const { selectedBaby, customSleepLocations } = useBabies();
  const { events, editEvent, deleteEvent } = useEvents();
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [editingCareEvent, setEditingCareEvent] = useState<BabyEvent | null>(null);
  // Adding happens in two steps: choose what, then fill it in. `addAt` holds
  // the tapped hour through both (undefined for the + button, which is "now").
  const [pickingEntry, setPickingEntry] = useState(false);
  const [addAt, setAddAt] = useState<Date | undefined>();
  const [addEntry, setAddEntry] = useState<HomeActionKey | null>(null);

  // A block held on the timeline stops the page scrolling under the finger.
  const [draggingBlock, setDraggingBlock] = useState(false);
  const [moved, setMoved] = useState<{
    event: BabyEvent;
    message: string;
  } | null>(null);

  const moveEvent = async (
    event: BabyEvent,
    updates: Partial<Pick<BabyEvent, 'startTime' | 'endTime' | 'durationMinutes'>>,
  ) => {
    if (!event.id) return;
    try {
      await editEvent(event.id, updates);
      const label = timelineEventLabel(event);
      setMoved({
        event,
        message: updates.startTime
          ? `${label} moved to ${formatClock(updates.startTime)}`
          : `${label} now ends at ${formatClock(updates.endTime || event.startTime)}`,
      });
    } catch {
      Alert.alert('Could not move entry', 'Please try again.');
    }
  };

  const undoMove = async () => {
    const original = moved?.event;
    setMoved(null);
    if (!original?.id) return;
    await editEvent(original.id, {
      startTime: original.startTime,
      endTime: original.endTime,
      ...(original.durationMinutes !== undefined
        ? { durationMinutes: original.durationMinutes }
        : {}),
    });
  };

  const openForEditing = (event: BabyEvent) => {
    if (usesEventEditModal(event.type)) setEditingEvent(event);
    else setEditingCareEvent(event);
  };

  const startAdding = (at?: Date) => {
    setAddAt(at);
    setPickingEntry(true);
  };

  const closeAdding = () => {
    setPickingEntry(false);
    setAddEntry(null);
    setAddAt(undefined);
  };
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [summaryPage, setSummaryPage] =
    useState<SummaryPage>('overview');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('feeds');
  const [exporting, setExporting] = useState(false);

  const days = useMemo<DayStat[]>(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        const dayEvents = events.filter(event =>
          isSameLocalDay(event.startTime, date),
        );
        const summary = summarizeEvents(dayEvents);
        return {
          date,
          feeds: summary.feeds,
          diapers: summary.diapers,
          sleepMinutes: summary.sleepMinutes,
        };
      }),
    [events],
  );

  const totals = useMemo(
    () =>
      days.reduce(
        (summary, day) => ({
          feeds: summary.feeds + day.feeds,
          diapers: summary.diapers + day.diapers,
          sleepMinutes: summary.sleepMinutes + day.sleepMinutes,
        }),
        { feeds: 0, diapers: 0, sleepMinutes: 0 },
      ),
    [days],
  );

  const selectedDayEvents = useMemo(() => {
    return events
      .filter(event => isSameLocalDay(event.startTime, selectedDay))
      .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
  }, [events, selectedDay]);

  const visibleDayEvents = useMemo(
    () =>
      summaryPage === 'overview'
        ? selectedDayEvents
        : selectedDayEvents.filter(event => event.type === summaryPage),
    [summaryPage, selectedDayEvents],
  );

  const selectedDaySummary = useMemo(
    () => summarizeEvents(selectedDayEvents, true),
    [selectedDayEvents],
  );

  const weekEvents = useMemo(
    () =>
      events.filter(event =>
        days.some(day => isSameLocalDay(event.startTime, day.date)),
      ),
    [days, events],
  );

  const displayedEvents =
    viewMode === 'today' ? selectedDayEvents : weekEvents;

  const detailMetrics = useMemo<DetailMetric[]>(() => {
    if (summaryPage === 'overview') return [];

    if (summaryPage === 'feed') {
      const nursingEvents = displayedEvents.filter(
        event => event.type === 'feed' && event.metadata?.feedType === 'breast',
      );
      const bottleEvents = displayedEvents.filter(
        event => event.type === 'feed' && event.metadata?.feedType === 'bottle',
      );
      const nursingSides = summarizeNursingSides(nursingEvents);
      const nursingSeconds =
        nursingSides.leftSeconds + nursingSides.rightSeconds;
      const bottleAmount = formatBottleAmount(bottleEvents);

      return [
        {
          key: 'nursing-time',
          label: 'Nursing time',
          value: formatNursingDuration(nursingSeconds),
          detail: `${nursingEvents.length} ${nursingEvents.length === 1 ? 'feed' : 'feeds'} · L ${formatNursingDuration(nursingSides.leftSeconds)} · R ${formatNursingDuration(nursingSides.rightSeconds)}`,
          icon: 'mother-nurse',
          color: '#B871A8',
        },
        {
          key: 'bottles',
          label: 'Bottles',
          value: bottleAmount || String(bottleEvents.length),
          detail: bottleAmount
            ? `${bottleEvents.length} ${bottleEvents.length === 1 ? 'bottle feed' : 'bottle feeds'} logged`
            : bottleEvents.length
              ? `${bottleEvents.length} ${bottleEvents.length === 1 ? 'feed' : 'feeds'} · add amounts to total volume`
              : 'No bottles logged',
          icon: 'baby-bottle-outline',
          color: '#E9826B',
        },
      ];
    }

    if (summaryPage === 'sleep') {
      const completedSleeps = displayedEvents.filter(
        event => event.type === 'sleep' && event.endTime,
      );
      const longestSleep = completedSleeps.reduce<BabyEvent | null>(
        (longest, event) =>
          !longest ||
          getEventDurationMinutes(event) > getEventDurationMinutes(longest)
            ? event
            : longest,
        null,
      );

      return [
        {
          key: 'sleep-count',
          label: 'Sleeps',
          value: String(
            displayedEvents.filter(event => event.type === 'sleep').length,
          ),
          detail: viewMode === 'today' ? 'Logged on this day' : 'Logged in the last 7 days',
          icon: 'weather-night',
          color: '#648FD8',
        },
        {
          key: 'longest-sleep',
          label: 'Longest sleep',
          value: longestSleep
            ? formatDuration(getEventDurationMinutes(longestSleep))
            : '—',
          detail: longestSleep
            ? longestSleep.startTime.toLocaleString([], {
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'Complete a sleep to compare it here',
          icon: 'sleep',
          color: '#648FD8',
        },
      ];
    }

    const nappies = displayedEvents.filter(event => event.type === 'diaper');
    const nappyCount = (condition: 'wet' | 'dirty' | 'both') =>
      nappies.filter(event => event.metadata?.diaperCondition === condition)
        .length;
    return [
      {
        key: 'wet-nappies',
        label: 'Wet',
        value: String(nappyCount('wet')),
        detail: 'Wet only',
        icon: 'water-outline',
        color: '#55A57E',
      },
      {
        key: 'dirty-nappies',
        label: 'Dirty',
        value: String(nappyCount('dirty')),
        detail: 'Dirty only',
        icon: 'emoticon-poop-outline',
        color: '#9D7449',
      },
      {
        key: 'mixed-nappies',
        label: 'Mixed',
        value: String(nappyCount('both')),
        detail: 'Wet + dirty',
        icon: 'water-plus-outline',
        color: '#3E91A7',
      },
    ];
  }, [displayedEvents, summaryPage, viewMode]);

  const partEvents = useMemo(
    () =>
      dayParts.map(part => ({
        ...part,
        events: visibleDayEvents.filter(event => {
          const hour = eventHour(event);
          return hour >= part.startHour && hour < part.endHour;
        }),
      })),
    [visibleDayEvents],
  );

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const busiest = [...partEvents].sort(
      (left, right) => right.events.length - left.events.length,
    )[0];

    if (visibleDayEvents.length === 0) {
      result.push({
        icon: 'timeline-clock-outline',
        title:
          summaryPage === 'overview'
            ? 'No activity on this day'
            : `No ${summaryPage === 'diaper' ? 'nappies' : `${summaryPage}s`} on this day`,
        value: 'No events yet',
        detail:
          summaryPage === 'overview'
            ? 'No care events were recorded for this date.'
            : `No ${summaryPage === 'diaper' ? 'nappies' : `${summaryPage}s`} were recorded for this date.`,
        color: theme.colors.primary,
      });
    } else if (busiest?.events.length) {
      result.push({
        icon: busiest.icon,
        title: 'Busiest part of the day',
        value: busiest.label,
        detail: `${busiest.events.length} ${busiest.events.length === 1 ? 'event' : 'events'} between ${busiest.range}.`,
        color: '#9B6BC6',
      });
    }

    const recentFeeds = events
      .filter(event => event.type === 'feed')
      .filter(event => days.some(day => isSameLocalDay(event.startTime, day.date)));
    const feedGap = averageGapMinutes(recentFeeds);
    if (summaryPage === 'overview' || summaryPage === 'feed') {
      result.push({
        icon: 'clock-outline',
        title: 'Average logged feed gap',
        value: feedGap === null ? 'More data needed' : formatDuration(feedGap),
        detail:
          feedGap === null
            ? 'Log at least two feeds to see the average time between them.'
            : `Average gap across ${recentFeeds.length} feeds in the last 7 days.`,
        color: metrics[0].color,
      });
    }

    const completedSleeps = events
      .filter(event => event.type === 'sleep' && event.endTime)
      .filter(event => days.some(day => isSameLocalDay(event.startTime, day.date)));
    const longestSleep = completedSleeps.reduce<BabyEvent | null>(
      (longest, event) =>
        !longest ||
        getEventDurationMinutes(event) > getEventDurationMinutes(longest)
          ? event
          : longest,
      null,
    );
    if (summaryPage === 'overview' || summaryPage === 'sleep') {
      result.push({
        icon: 'sleep',
        title: 'Longest sleep',
        value: longestSleep
          ? formatDuration(getEventDurationMinutes(longestSleep))
          : 'More data needed',
        detail: longestSleep
          ? `${longestSleep.startTime.toLocaleDateString([], { weekday: 'long' })} at ${longestSleep.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
          : 'Completed sleeps will be compared across the last 7 days.',
        color: metrics[2].color,
      });
    }

    if (summaryPage === 'overview' || summaryPage === 'diaper') {
      const recentNappies = events
        .filter(event => event.type === 'diaper')
        .filter(event =>
          days.some(day => isSameLocalDay(event.startTime, day.date)),
        );
      const wet = recentNappies.filter(event =>
        ['wet', 'both'].includes(event.metadata?.diaperCondition || ''),
      ).length;
      const dirty = recentNappies.filter(event =>
        ['dirty', 'both'].includes(event.metadata?.diaperCondition || ''),
      ).length;
      result.push({
        icon: 'human-baby-changing-table',
        title: 'Nappy mix',
        value: recentNappies.length
          ? `${recentNappies.length} logged`
          : 'More data needed',
        detail: recentNappies.length
          ? `${wet} wet and ${dirty} dirty across the last 7 days. “Both” counts in each total.`
          : 'Logged nappy details will be compared across the last 7 days.',
        color: metrics[1].color,
      });
    }

    const activeMetric = summaryPages.find(
      page => page.key === summaryPage,
    )?.metric;
    const loggedDays = days.filter(day =>
      activeMetric
        ? day[activeMetric] > 0
        : day.feeds + day.diapers + day.sleepMinutes > 0,
    ).length;
    result.push({
      icon: 'calendar-check-outline',
      title: 'Logging coverage',
      value: `${loggedDays} of 7 days`,
      detail:
        loggedDays === 7
          ? 'A complete week makes comparisons easier to trust.'
          : 'Missing days can make weekly averages look lower than usual.',
      color: metrics[1].color,
    });

    return result;
  }, [
    days,
    events,
    partEvents,
    summaryPage,
    theme.colors.primary,
    visibleDayEvents.length,
  ]);

  const activeSummaryPage =
    summaryPages.find(page => page.key === summaryPage) || summaryPages[0];
  const visibleMetrics = activeSummaryPage.metric
    ? metrics.filter(metric => metric.key === activeSummaryPage.metric)
    : metrics;

  const selectedDefinition =
    metrics.find(metric => metric.key === selectedMetric) || metrics[0];
  const chartValues = days.map(day => metricValue(day, selectedMetric));
  const chartMaximum = Math.max(...chartValues, 1);
  const selectedTotal =
    selectedMetric === 'sleepMinutes'
      ? totals.sleepMinutes / 60
      : totals[selectedMetric];
  const average = selectedTotal / days.length;
  const activeDays = chartValues.filter(value => value > 0).length;
  const peakIndex = chartValues.indexOf(Math.max(...chartValues));
  const peakDay = days[peakIndex];
  const peakValue = chartValues[peakIndex];
  const displayedTotals =
    viewMode === 'today'
      ? {
          feeds: selectedDaySummary.feeds,
          diapers: selectedDaySummary.diapers,
          sleepMinutes: selectedDaySummary.sleepMinutes,
        }
      : totals;
  const primaryMetric = visibleMetrics[0];
  const summaryStripMetrics: DetailMetric[] =
    summaryPage === 'overview' || !primaryMetric
      ? []
      : [
          {
            key: primaryMetric.key,
            label: primaryMetric.label,
            value: formatValue(
              primaryMetric.key === 'sleepMinutes'
                ? displayedTotals.sleepMinutes / 60
                : displayedTotals[primaryMetric.key],
              primaryMetric.key,
              true,
            ),
            detail: viewMode === 'today' ? 'Selected day' : 'Last 7 days',
            icon: primaryMetric.icon,
            color: primaryMetric.color,
          },
          ...detailMetrics,
        ];

  const selectSummaryPage = (page: (typeof summaryPages)[number]) => {
    setSummaryPage(page.key);
    if (page.metric) setSelectedMetric(page.metric);
  };

  // Totals for whatever the day or week holds. In trends they pick the graph's
  // metric; on their own they are the day's tally, which belongs with the
  // insights rather than on top of the to-scale timeline.
  const metricRow = (
    <View style={styles.metricRow}>
      {visibleMetrics.map(metric => {
        const selected =
          viewMode === 'week' && metric.key === selectedMetric;
        const total =
          metric.key === 'sleepMinutes'
            ? displayedTotals.sleepMinutes / 60
            : displayedTotals[metric.key];
        return (
          <Pressable
            key={metric.key}
            onPress={() => setSelectedMetric(metric.key)}
            disabled={viewMode !== 'week'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={
              viewMode === 'week'
                ? `Show ${metric.label.toLowerCase()} graph`
                : `${metric.label} on the selected day: ${formatValue(total, metric.key, true)}`
            }
            style={({ pressed }) => [
              styles.metricPressable,
              pressed && styles.pressed,
            ]}
          >
            <Surface
              style={[
                styles.metricCard,
                {
                  backgroundColor: selected
                    ? `${metric.color}18`
                    : theme.colors.surface,
                  borderColor: selected
                    ? metric.color
                    : theme.colors.outlineVariant,
                },
              ]}
              elevation={selected ? 1 : 0}
            >
              <View
                style={[
                  styles.metricIcon,
                  { backgroundColor: `${metric.color}24` },
                ]}
              >
                <MaterialCommunityIcons
                  name={metric.icon}
                  size={20}
                  color={metric.color}
                />
              </View>
              <Text
                variant="titleLarge"
                style={[styles.metricValue, { color: metric.color }]}
              >
                {formatValue(total, metric.key, true)}
              </Text>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {metric.label}
              </Text>
            </Surface>
          </Pressable>
        );
      })}
    </View>
  );

  const shareExport = async (format: 'json' | 'csv') => {
    if (exporting) return;

    setExporting(true);
    try {
      const babyName = selectedBaby?.name || 'Baby';
      const report =
        format === 'json'
          ? buildCareDataJson({ babyName, days, events })
          : buildCareStatsCsv({
              babyName,
              days,
              events,
              customSleepLocations,
            });
      await Share.share({
        title:
          format === 'json'
            ? `${babyName} · PitterPatter AI data export`
            : `${babyName} · PitterPatter care report`,
        message: report,
      });
    } catch {
      Alert.alert(
        'Unable to export',
        'The care report could not be opened. Please try again.',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (exporting) return;
    Alert.alert(
      'Export care data',
      'Choose AI-ready JSON or spreadsheet-ready CSV. The last 7 days and detailed care events will be shared.',
      [
        {
          text: 'AI data (JSON)',
          onPress: () => void shareExport('json'),
        },
        {
          text: 'Spreadsheet (CSV)',
          onPress: () => void shareExport('csv'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!draggingBlock}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text variant="headlineMedium" style={styles.title}>
              {activeSummaryPage.title}
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.subtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {selectedBaby?.name || 'Baby'} ·{' '}
              {summaryPage === 'overview'
                ? 'your care at a glance'
                : `${activeSummaryPage.label.toLowerCase()} at a glance`}
            </Text>
          </View>
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Export care data"
            accessibilityHint="Choose an AI-ready JSON or spreadsheet CSV export"
            style={({ pressed }) => [
              styles.exportPressable,
              pressed && styles.pressed,
            ]}
          >
            <Surface
              style={[
                styles.exportButton,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              elevation={0}
            >
              <MaterialCommunityIcons
                name="export-variant"
                size={18}
                color={theme.colors.onPrimaryContainer}
              />
              <Text
                variant="labelLarge"
                style={[styles.buttonLabel, { color: theme.colors.onPrimaryContainer }]}
              >
                {exporting ? 'Opening…' : 'Export'}
              </Text>
            </Surface>
          </Pressable>
        </View>

        <View
          style={[
            styles.viewSwitch,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          accessibilityRole="tablist"
        >
          {([
            ['today', 'Full day', 'calendar-today'],
            ['week', '7-day trends', 'chart-bar'],
            ['insights', 'Insights', 'lightbulb-on-outline'],
          ] as const).map(([mode, label, icon]) => {
            const selected = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} summary`}
                style={({ pressed }) => [
                  styles.viewSwitchOption,
                  selected && {
                    backgroundColor: theme.colors.primaryContainer,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={18}
                  color={
                    selected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface
                  }
                />
                <Text
                  variant="labelLarge"
                  style={{
                    fontWeight: '700',
                    fontSize: 14,
                    textAlign: 'center',
                    color: selected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.summaryPageSwitch,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          accessibilityRole="tablist"
        >
          {summaryPages.map(page => {
            const selected = summaryPage === page.key;
            return (
              <Pressable
                key={page.key}
                onPress={() => selectSummaryPage(page)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${page.label} summary page`}
                style={({ pressed }) => [
                  styles.summaryPageOption,
                  selected && { backgroundColor: theme.colors.primaryContainer },
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={page.icon}
                  size={18}
                  color={
                    selected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface
                  }
                />
                <Text
                  variant="labelLarge"
                  style={{
                    fontWeight: '700',
                    fontSize: 14,
                    textAlign: 'center',
                    color: selected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface,
                  }}
                >
                  {page.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {viewMode !== 'week' ? (
          <SummaryDayNavigator value={selectedDay} onChange={setSelectedDay} />
        ) : null}

        {viewMode !== 'insights' ? (
          <>
            {summaryPage === 'overview' ? (
              viewMode === 'week' ? metricRow : null
            ) : summaryPage === 'diaper' ? (
              <Surface
                style={[
                  styles.nappySummaryStrip,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
                elevation={0}
                accessibilityLabel="Nappy summary"
              >
                <View style={styles.nappySummaryTotal}>
                  <View
                    style={[
                      styles.metricIcon,
                      { backgroundColor: `${primaryMetric?.color || metrics[1].color}24` },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="human-baby-changing-table"
                      size={20}
                      color={primaryMetric?.color || metrics[1].color}
                    />
                  </View>
                  <View>
                    <Text
                      variant="titleLarge"
                      style={[
                        styles.nappySummaryValue,
                        { color: primaryMetric?.color || metrics[1].color },
                      ]}
                    >
                      {summaryStripMetrics[0]?.value || '0'}
                    </Text>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      Nappies
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.nappySummaryDivider,
                    { backgroundColor: theme.colors.outlineVariant },
                  ]}
                />
                <View style={styles.nappySummaryBreakdown}>
                  {detailMetrics.map(metric => (
                    <View key={metric.key} style={styles.nappySummaryItem}>
                      <Text
                        variant="labelSmall"
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {metric.label}
                      </Text>
                      <Text
                        variant="titleMedium"
                        style={[styles.nappySummaryValue, { color: metric.color }]}
                      >
                        {metric.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </Surface>
            ) : (
              <Surface
                style={[
                  styles.summaryStrip,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
                elevation={0}
                accessibilityLabel={`${activeSummaryPage.label} summary`}
              >
                {summaryStripMetrics.map((metric, index) => (
                  <View key={metric.key} style={styles.summaryStripItem}>
                    {index > 0 ? (
                      <View
                        style={[
                          styles.summaryStripDivider,
                          { backgroundColor: theme.colors.outlineVariant },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.metricIcon,
                        { backgroundColor: `${metric.color}24` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={metric.icon}
                        size={20}
                        color={metric.color}
                      />
                    </View>
                    <Text
                      variant="titleLarge"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.metricValue, { color: metric.color }]}
                    >
                      {metric.value}
                    </Text>
                    <Text
                      variant="labelMedium"
                      numberOfLines={1}
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {metric.label}
                    </Text>
                    <Text
                      variant="bodySmall"
                      numberOfLines={2}
                      style={[
                        styles.summaryStripDetail,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {metric.detail}
                    </Text>
                  </View>
                ))}
              </Surface>
            )}

          </>
        ) : null}

        {viewMode === 'today' ? (
          <>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text variant="titleMedium" style={styles.sectionHeading}>
                  {summaryPage === 'overview'
                    ? 'Full day'
                    : `${activeSummaryPage.label} timeline`}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {summaryPage === 'overview'
                    ? 'Midnight to midnight, drawn to scale'
                    : `Logged ${summaryPage === 'diaper' ? 'nappies' : `${summaryPage}s`} across the day, drawn to scale`}
                  {' · hold an entry to move it'}
                </Text>
              </View>
              <View
                style={[
                  styles.eventCountPill,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onPrimaryContainer }}
                >
                  {visibleDayEvents.length}{' '}
                  {visibleDayEvents.length === 1 ? 'event' : 'events'}
                </Text>
              </View>
            </View>

            <Surface
              style={[
                styles.fullDayCard,
                { backgroundColor: theme.colors.surface },
              ]}
              elevation={1}
            >
              <DayTimeline
                events={visibleDayEvents}
                day={selectedDay}
                eventColor={eventColor}
                onSelectEvent={openForEditing}
                onAddAt={startAdding}
                onMoveEvent={moveEvent}
                onDragActiveChange={setDraggingBlock}
                emptyLabel={
                  summaryPage === 'overview'
                    ? 'Nothing logged on this day yet.'
                    : `No ${summaryPage === 'diaper' ? 'nappies' : `${summaryPage}s`} logged on this day yet.`
                }
              />
            </Surface>

            <View style={styles.timelineLegend}>
              {visibleMetrics.map(metric => (
                <View key={metric.key} style={styles.timelineLegendItem}>
                  <View
                    style={[
                      styles.timelineLegendDot,
                      { backgroundColor: metric.color },
                    ]}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : viewMode === 'week' ? (
          <>
            <Surface
              style={[
                styles.chartCard,
                { backgroundColor: theme.colors.surface },
              ]}
              elevation={1}
            >
          <View style={styles.chartHeader}>
            <View>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {selectedDefinition.label.toUpperCase()} THIS WEEK
              </Text>
              <View style={styles.chartTotalRow}>
                <Text variant="headlineLarge" style={styles.chartTotal}>
                  {formatValue(selectedTotal, selectedMetric, true)}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.chartAverage,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatAverage(average, selectedMetric)} / day
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.chartIcon,
                { backgroundColor: `${selectedDefinition.color}1C` },
              ]}
            >
              <MaterialCommunityIcons
                name="chart-bar"
                size={24}
                color={selectedDefinition.color}
              />
            </View>
          </View>

          <View style={styles.plot}>
            {[0, 0.5, 1].map(position => (
              <View
                key={position}
                style={[
                  styles.gridLine,
                  {
                    bottom: 22 + position * 136,
                    backgroundColor: theme.colors.outlineVariant,
                  },
                ]}
              />
            ))}
            <View style={styles.barsRow}>
              {days.map((day, index) => {
                const value = chartValues[index];
                const height = Math.max(4, (value / chartMaximum) * 132);
                const isToday = index === days.length - 1;
                return (
                  <View key={dateKey(day.date)} style={styles.barColumn}>
                    <View style={styles.barArea}>
                      {value > 0 ? (
                        <Text
                          variant="labelSmall"
                          numberOfLines={1}
                          style={[
                            styles.barValue,
                            { color: theme.colors.onSurfaceVariant },
                          ]}
                        >
                          {formatValue(value, selectedMetric, true)}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.bar,
                          {
                            height,
                            backgroundColor: selectedDefinition.color,
                            opacity: value > 0 ? (isToday ? 1 : 0.72) : 0.18,
                          },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.dayPill,
                        isToday && {
                          backgroundColor: `${selectedDefinition.color}1C`,
                        },
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.dayText,
                          {
                            color: isToday
                              ? selectedDefinition.color
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {isToday
                          ? 'Today'
                          : day.date
                              .toLocaleDateString([], { weekday: 'short' })
                              .slice(0, 2)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {selectedTotal === 0 ? (
            <View
              style={[
                styles.emptyOverlay,
                { backgroundColor: theme.colors.surface },
              ]}
              pointerEvents="none"
            >
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={25}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Log a {selectedDefinition.emptyLabel} event to start this
                trend.
              </Text>
            </View>
          ) : null}
        </Surface>

        <Text variant="titleMedium" style={styles.insightTitle}>
          Pattern snapshot
        </Text>
        <Surface
          style={[styles.insightCard, { backgroundColor: theme.colors.surface }]}
          elevation={0}
        >
          <View style={styles.insightItem}>
            <View
              style={[
                styles.insightIcon,
                { backgroundColor: `${selectedDefinition.color}18` },
              ]}
            >
              <MaterialCommunityIcons
                name="calendar-star"
                size={20}
                color={selectedDefinition.color}
              />
            </View>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Peak day
            </Text>
            <Text variant="titleMedium" style={styles.insightValue}>
              {selectedTotal > 0 && peakDay
                ? peakDay.date.toLocaleDateString([], { weekday: 'short' })
                : '—'}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {selectedTotal > 0
                ? formatValue(peakValue, selectedMetric, true)
                : 'No data'}
            </Text>
          </View>
          <View
            style={[
              styles.insightDivider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
          <View style={styles.insightItem}>
            <View
              style={[
                styles.insightIcon,
                { backgroundColor: `${selectedDefinition.color}18` },
              ]}
            >
              <MaterialCommunityIcons
                name="chart-timeline-variant-shimmer"
                size={20}
                color={selectedDefinition.color}
              />
            </View>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Daily average
            </Text>
            <Text variant="titleMedium" style={styles.insightValue}>
              {formatAverage(average, selectedMetric)}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              per day
            </Text>
          </View>
          <View
            style={[
              styles.insightDivider,
              { backgroundColor: theme.colors.outlineVariant },
            ]}
          />
          <View style={styles.insightItem}>
            <View
              style={[
                styles.insightIcon,
                { backgroundColor: `${selectedDefinition.color}18` },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={20}
                color={selectedDefinition.color}
              />
            </View>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Days logged
            </Text>
            <Text variant="titleMedium" style={styles.insightValue}>
              {activeDays} / 7
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              this week
            </Text>
          </View>
        </Surface>

        <View style={styles.legend}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: selectedDefinition.color },
            ]}
          />
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Each bar shows one calendar day. Active timers appear after they
            finish.
          </Text>
        </View>
          </>
        ) : null}

        {viewMode === 'insights' ? (
          <>
            {summaryPage === 'overview' ? metricRow : null}
            <View style={styles.suggestionsHeader}>
              <View>
                <Text variant="titleMedium" style={styles.sectionHeading}>
                  Care insights
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Observations from the selected day and the last 7 days
                </Text>
              </View>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={23}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.suggestionList}>
              {insights.map(insight => (
                <Surface
                  key={insight.title}
                  style={[
                    styles.suggestionCard,
                    { backgroundColor: theme.colors.surface },
                  ]}
                  elevation={0}
                >
                  <View
                    style={[
                      styles.suggestionIcon,
                      { backgroundColor: `${insight.color}18` },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={insight.icon}
                      size={22}
                      color={insight.color}
                    />
                  </View>
                  <View style={styles.suggestionCopy}>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {insight.title}
                    </Text>
                    <Text variant="titleMedium" style={styles.suggestionValue}>
                      {insight.value}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.suggestionDetail,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {insight.detail}
                    </Text>
                  </View>
                </Surface>
              ))}
            </View>

            <Text
              variant="bodySmall"
              style={[styles.note, { color: theme.colors.onSurfaceVariant }]}
            >
              Trends are for everyday tracking only and are not medical advice.
            </Text>
          </>
        ) : null}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.addFab}
        onPress={() => startAdding()}
        accessibilityLabel="Add an activity"
        accessibilityHint="Chooses what to write down, starting now"
      />
      <AddEntryPicker
        visible={pickingEntry}
        title={
          addAt
            ? `Add at ${addAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Add an activity'
        }
        onPick={key => {
          setPickingEntry(false);
          setAddEntry(key);
        }}
        onDismiss={closeAdding}
      />
      <AddEntrySheet entry={addEntry} startTime={addAt} onClose={closeAdding} />
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
          setEditingCareEvent(null);
        }}
        onDelete={deleteEvent}
      />
      <Snackbar
        visible={Boolean(moved)}
        onDismiss={() => setMoved(null)}
        duration={5000}
        action={{ label: 'Undo', onPress: undoMove }}
        wrapperStyle={styles.movedSnackbar}
      >
        {moved?.message}
      </Snackbar>
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Clear of the ad banner and the tab bar below it.
  addFab: { position: 'absolute', right: 16, bottom: 78 },
  movedSnackbar: { bottom: 66 },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 3,
  },
  exportPressable: {
    borderRadius: 20,
  },
  exportButton: {
    minHeight: 48,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPageSwitch: {
    marginTop: 10,
    padding: 4,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 3,
  },
  summaryPageOption: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  viewSwitch: {
    marginTop: 20,
    padding: 4,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 4,
  },
  viewSwitchOption: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 4,
    borderRadius: 14,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 22,
  },
  metricPressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  metricCard: {
    minHeight: 118,
    borderRadius: 20,
    borderWidth: 1,
    padding: 11,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.4,
  },
  summaryStrip: {
    minHeight: 158,
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryStripItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 5,
    position: 'relative',
  },
  summaryStripDivider: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    left: -1,
    top: 2,
    bottom: 2,
  },
  summaryStripDetail: {
    marginTop: 3,
    lineHeight: 16,
  },
  nappySummaryStrip: {
    minHeight: 86,
    marginTop: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nappySummaryTotal: {
    width: 118,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  nappySummaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 14,
  },
  nappySummaryBreakdown: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nappySummaryItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  nappySummaryValue: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionHeadingRow: {
    marginTop: 23,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeading: {
    fontWeight: '700',
  },
  eventCountPill: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullDayCard: {
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timelineLegend: {
    marginTop: 11,
    paddingHorizontal: 7,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  timelineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timelineLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartCard: {
    marginTop: 14,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  chartTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    marginTop: 2,
  },
  chartTotal: {
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  chartAverage: {
    marginBottom: 4,
  },
  chartIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plot: {
    height: 196,
    marginTop: 12,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  barsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barArea: {
    height: 164,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barValue: {
    marginBottom: 4,
    fontSize: 10,
  },
  bar: {
    width: '68%',
    maxWidth: 30,
    minWidth: 12,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  dayPill: {
    height: 26,
    minWidth: 34,
    marginTop: 5,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontWeight: '700',
  },
  emptyOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 50,
    minHeight: 66,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  insightTitle: {
    marginTop: 23,
    marginBottom: 10,
    marginLeft: 2,
    fontWeight: '700',
  },
  insightCard: {
    minHeight: 144,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightItem: {
    flex: 1,
    alignItems: 'center',
  },
  insightIcon: {
    width: 34,
    height: 34,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightValue: {
    marginTop: 3,
    fontWeight: '800',
  },
  insightDivider: {
    width: StyleSheet.hairlineWidth,
    height: 74,
  },
  legend: {
    marginTop: 16,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  suggestionsHeader: {
    marginTop: 26,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionList: {
    gap: 9,
  },
  suggestionCard: {
    minHeight: 104,
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  suggestionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionCopy: {
    flex: 1,
  },
  suggestionValue: {
    marginTop: 1,
    fontWeight: '800',
  },
  suggestionDetail: {
    marginTop: 3,
    lineHeight: 18,
  },
  note: {
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
});
