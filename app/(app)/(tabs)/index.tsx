import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
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
import { Redirect, useRouter } from 'expo-router';
import HomeCareCard from '../../../src/components/HomeCareCard';
import AppointmentsList from '../../../src/components/AppointmentsList';
import DailySummary from '../../../src/components/DailySummary';
import BabySelector from '../../../src/components/BabySelector';
import LogModal, { QuickLogInput } from '../../../src/components/LogModal';
import FeedPanel from '../../../src/components/FeedPanel';
import ActiveFeedTimer from '../../../src/components/ActiveFeedTimer';
import {
  optionalSleepLocation,
  type SleepType,
} from '../../../src/utils/sleepLocation';
import EventCard from '../../../src/components/EventCard';
import EventEditModal from '../../../src/components/EventEditModal';
import { eventColors } from '../../../src/theme/eventColors';
import { BabyEvent } from '../../../src/services/firebase/events';
import { useBabies } from '../../../src/providers/BabyProvider';
import { useEvents } from '../../../src/providers/EventProvider';
import { useMonetization } from '../../../src/providers/MonetizationProvider';
import {
  formatTimerSeconds,
  formatTimeSinceEvent,
} from '../../../src/utils/feedTiming';
import { formatBabyAgeAtDate } from '../../../src/utils/babyAge';
import VoiceInputCard from '../../../src/components/VoiceInputCard';
import type { VoiceCommand } from '../../../src/utils/voiceCommand';
import {
  adjustBreastTimingForStartChange,
  breastDurationsAt,
  breastDurationsForEvent,
  finishBreastTiming,
  formatNursingDuration,
  runningBreastSide,
  startBreastTiming,
  switchBreastSide,
} from '../../../src/utils/breastFeed';
import CareLogModal, {
  AdditionalCareType,
  CareLogInput,
} from '../../../src/components/CareLogModal';
import HomeActionsModal from '../../../src/components/HomeActionsModal';
import {
  careActionByType,
  defaultHomeActions,
  HomeActionKey,
  sanitizeHomeActions,
} from '../../../src/constants/careActions';
import type { BabyEventType } from '../../../src/services/firebase/events';
import ActivePumpingTimer from '../../../src/components/ActivePumpingTimer';
import SleepStartScreen from '../../../src/components/sleep/SleepStartScreen';
import SleepTimerScreen from '../../../src/components/sleep/SleepTimerScreen';
import AppearanceModeToggle from '../../../src/components/AppearanceModeToggle';
import QuickCareConfigModal from '../../../src/components/QuickCareConfigModal';
import ExpandedQuickCareView from '../../../src/components/ExpandedQuickCareView';
import {
  ConfigurableQuickCareKey,
  QuickCarePreference,
  sanitizeQuickCarePreferences,
} from '../../../src/constants/quickCarePreferences';
import {
  EventEditUpdates,
  isActiveBabyEvent,
  saveEventEditAndFinishStartedNursing,
  shiftedEventTimes,
  usesEventEditModal,
} from '../../../src/utils/eventEditing';
import {
  describeMergeResult,
  mergeBlocker,
} from '../../../src/utils/mergeEvents';
import { formatDiaperAmountDetail } from '../../../src/utils/diaperAmounts';
import {
  EventSummaryPeriod,
  eventsInSummaryPeriod,
} from '../../../src/utils/eventSummary';

type QuickCareKey = HomeActionKey;

export default function HomeScreen() {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const isFocused = useIsFocused();
  const router = useRouter();
  const { maybeShowInterstitial } = useMonetization();
  const {
    babies,
    selectedBaby,
    selectBaby,
    profile,
    updateHomeActions,
    updateQuickCarePreference,
    customSleepLocations,
    addSleepLocation,
    loading: babiesLoading,
  } = useBabies();
  const {
    events,
    activeFeed,
    activeSleep,
    activePumping,
    loading: eventsLoading,
    error: eventsError,
    logFeed,
    logSleep,
    startFeed,
    stopFeed,
    cancelFeed,
    switchFeed,
    logDiaper,
    logCareEvent,
    startPumping,
    stopPumping,
    cancelPumping,
    startSleep,
    stopSleep,
    cancelSleep,
    editEvent,
    deleteEvent,
    deleteEvents,
    mergeEvents,
    reopenEvent,
  } = useEvents();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [feedPanelVisible, setFeedPanelVisible] = useState(false);
  const [feedPanelDefaultType, setFeedPanelDefaultType] = useState<
    'breast' | 'bottle'
  >('breast');
  const [sleepPanelVisible, setSleepPanelVisible] = useState(false);
  const [pumpingPanelVisible, setPumpingPanelVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    'feed' | 'sleep' | 'diaper' | null
  >(null);
  const [manualEntryStartTime, setManualEntryStartTime] = useState<Date>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [summaryPeriod, setSummaryPeriod] =
    useState<EventSummaryPeriod>('today');
  const [sleepBusy, setSleepBusy] = useState(false);
  const [sleepCancelBusy, setSleepCancelBusy] = useState(false);
  const [sleepTypeBusy, setSleepTypeBusy] = useState(false);
  const [feedBusy, setFeedBusy] = useState(false);
  const [feedStartTimeBusy, setFeedStartTimeBusy] = useState(false);
  const [feedCancelBusy, setFeedCancelBusy] = useState(false);
  const [nappyBusy, setNappyBusy] = useState(false);
  const [feedStartingType, setFeedStartingType] = useState<
    'breast' | 'left' | 'right' | 'bottle' | 'pause' | null
  >(null);
  const [feedSwitchFallback, setFeedSwitchFallback] =
    useState<BabyEvent | null>(null);
  const [feedStartTimeFallback, setFeedStartTimeFallback] =
    useState<BabyEvent | null>(null);
  const [completedFeed, setCompletedFeed] = useState<BabyEvent | null>(null);
  const [message, setMessage] = useState('');
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);
  const [careLogType, setCareLogType] = useState<AdditionalCareType | null>(null);
  const [editingCareEvent, setEditingCareEvent] = useState<BabyEvent | null>(null);
  const [recentSelectedIds, setRecentSelectedIds] = useState<string[]>([]);
  const [recentBulkBusy, setRecentBulkBusy] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draftHomeActions, setDraftHomeActions] = useState<HomeActionKey[]>(defaultHomeActions);
  const [savingLayout, setSavingLayout] = useState(false);
  const [pumpingBusy, setPumpingBusy] = useState(false);
  const [configuringQuickCare, setConfiguringQuickCare] =
    useState<ConfigurableQuickCareKey | null>(null);
  const [focusedQuickCareKey, setFocusedQuickCareKey] =
    useState<QuickCareKey | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  // A start-time edit is the newest optimistic feed state and must win over
  // an older start/switch fallback while Firestore catches up.
  const displayedActiveFeed =
    feedStartTimeFallback || feedSwitchFallback || activeFeed;
  const feedPanel = completedFeed || displayedActiveFeed;
  // Every nursing screen — starting, running, and the feed just saved — draws
  // its own full-screen chrome, so the quick care hero must stand down rather
  // than stack a second header above it.
  const nursingTimerOwnsScreen =
    (feedPanelVisible &&
      (feedPanel
        ? (feedPanel.metadata?.feedType || 'breast') === 'breast'
        : feedPanelDefaultType === 'breast')) ||
    (logModalVisible &&
      selectedAction === 'feed' &&
      feedPanelDefaultType === 'breast');
  const activeTimerRefreshMs =
    displayedActiveFeed || activeSleep || activePumping ? 1_000 : 30_000;
  const homeActions = sanitizeHomeActions(profile?.homeActions);
  const quickCarePreferences = sanitizeQuickCarePreferences(
    profile?.quickCarePreferences,
  );
  const quickCareKeys = homeActions;
  const selectedQuickCareKey = focusedQuickCareKey;
  const focusedQuickCareDefinition = focusedQuickCareKey
    ? focusedQuickCareKey === 'nursing'
      ? { title: 'Nursing', icon: 'mother-nurse', color: eventColors.feed }
      : focusedQuickCareKey === 'bottle'
        ? {
            title: 'Bottle',
            icon: 'baby-bottle-outline',
            color: eventColors.feed,
          }
        : {
            title: careActionByType[focusedQuickCareKey].label,
            icon: careActionByType[focusedQuickCareKey].icon,
            color: careActionByType[focusedQuickCareKey].color,
          }
    : null;

  useEffect(() => {
    if (!customizing) setDraftHomeActions(homeActions);
  }, [customizing, profile?.homeActions]);

  const homeClockVisible = isFocused && !focusedQuickCareKey && !editingEvent &&
    !editingCareEvent && !customizing && !configuringQuickCare;

  useEffect(() => {
    // Expanded care screens own their timers. Do not rebuild the hidden Home
    // tree every second while those screens (or another tab) handle taps.
    if (!homeClockVisible) return;
    setClockNow(new Date());
    const interval = setInterval(
      () => setClockNow(new Date()),
      activeTimerRefreshMs,
    );
    return () => clearInterval(interval);
  }, [activeTimerRefreshMs, homeClockVisible]);

  useEffect(() => {
    if (!feedSwitchFallback || !activeFeed) return;

    const fallbackOption =
      feedSwitchFallback.metadata?.feedType === 'bottle'
        ? 'bottle'
        : runningBreastSide(feedSwitchFallback.metadata) || 'pause';
    const liveOption =
      activeFeed.metadata?.feedType === 'bottle'
        ? 'bottle'
        : runningBreastSide(activeFeed.metadata) || 'pause';

    const matchingEvent = feedSwitchFallback.id
      ? activeFeed.id === feedSwitchFallback.id &&
        activeFeed.metadata?.breastSideStartedAtMs ===
          feedSwitchFallback.metadata?.breastSideStartedAtMs &&
        activeFeed.metadata?.leftBreastDurationSeconds ===
          feedSwitchFallback.metadata?.leftBreastDurationSeconds &&
        activeFeed.metadata?.rightBreastDurationSeconds ===
          feedSwitchFallback.metadata?.rightBreastDurationSeconds
      : activeFeed.id !== feedSwitchFallback.id;
    if (fallbackOption === liveOption && matchingEvent) {
      setFeedSwitchFallback(null);
      setFeedStartingType(null);
    }
  }, [activeFeed, feedSwitchFallback]);

  useEffect(() => {
    if (!feedStartTimeFallback) return;
    if (!activeFeed) {
      setFeedStartTimeFallback(null);
      return;
    }

    const startTimeMatches =
      activeFeed.id === feedStartTimeFallback.id &&
      activeFeed.startTime.getTime() ===
        feedStartTimeFallback.startTime.getTime();
    const timingMatches =
      feedStartTimeFallback.metadata?.feedType !== 'breast' ||
      (activeFeed.metadata?.breastSideStartedAtMs ===
        feedStartTimeFallback.metadata?.breastSideStartedAtMs &&
        activeFeed.metadata?.leftBreastDurationSeconds ===
          feedStartTimeFallback.metadata?.leftBreastDurationSeconds &&
        activeFeed.metadata?.rightBreastDurationSeconds ===
          feedStartTimeFallback.metadata?.rightBreastDurationSeconds);

    if (startTimeMatches && timingMatches) {
      setFeedStartTimeFallback(null);
    }
  }, [activeFeed, feedStartTimeFallback]);

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

  const selectedBabyAge = formatBabyAgeAtDate(
    selectedBaby.dateOfBirth,
    clockNow,
    'compact',
  );
  const homeSummaryEvents = eventsInSummaryPeriod(
    events,
    summaryPeriod,
    clockNow,
  );

  const clearCompletedFeed = () => setCompletedFeed(null);

  const closeFocusedQuickCare = () => {
    setFocusedQuickCareKey(null);
    setLogModalVisible(false);
    setSelectedAction(null);
    setManualEntryStartTime(undefined);
    setFeedPanelVisible(false);
    setSleepPanelVisible(false);
    setPumpingPanelVisible(false);
    setCareLogType(null);
    setEditingCareEvent(null);
    clearCompletedFeed();
  };

  const openLog = (
    action: 'feed' | 'sleep' | 'diaper',
    startTime?: Date,
  ) => {
    setFocusedQuickCareKey(current =>
      action === 'feed'
        ? current === 'bottle'
          ? 'bottle'
          : 'nursing'
        : action,
    );
    setFeedPanelVisible(false);
    setSleepPanelVisible(false);
    setPumpingPanelVisible(false);
    setCareLogType(null);
    setManualEntryStartTime(startTime);
    setSelectedAction(action);
    setLogModalVisible(true);
  };

  const openFeedPanel = (feedType: 'breast' | 'bottle') => {
    setFocusedQuickCareKey(feedType === 'bottle' ? 'bottle' : 'nursing');
    setLogModalVisible(false);
    setSelectedAction(null);
    setSleepPanelVisible(false);
    setPumpingPanelVisible(false);
    setCareLogType(null);
    setFeedPanelDefaultType(feedType);
    setFeedPanelVisible(true);
  };

  const openSleepPanel = () => {
    setFocusedQuickCareKey('sleep');
    setLogModalVisible(false);
    setSelectedAction(null);
    setFeedPanelVisible(false);
    setPumpingPanelVisible(false);
    setCareLogType(null);
    setSleepPanelVisible(true);
  };

  const openCareLog = (type: AdditionalCareType) => {
    setFocusedQuickCareKey(type);
    setLogModalVisible(false);
    setSelectedAction(null);
    setFeedPanelVisible(false);
    setSleepPanelVisible(false);
    setPumpingPanelVisible(false);
    setEditingCareEvent(null);
    setCareLogType(type);
  };

  const openCareEventEditor = (event: BabyEvent, focusQuickCare = false) => {
    setFocusedQuickCareKey(
      focusQuickCare ? (event.type as QuickCareKey) : null,
    );
    setLogModalVisible(false);
    setSelectedAction(null);
    setFeedPanelVisible(false);
    setSleepPanelVisible(false);
    setPumpingPanelVisible(false);
    setCareLogType(null);
    setEditingCareEvent(event);
  };

  const handleSaveLog = async (input: QuickLogInput) => {
    const isNewLog = !input.eventId;

    if (input.type === 'feed') {
      if (input.eventId) {
        const feedToEdit = events.find(event => event.id === input.eventId);
        if (!feedToEdit) throw new Error('This feed could not be found.');
        await editEvent(input.eventId, {
          ...shiftedEventTimes(feedToEdit, input.startTime || feedToEdit.startTime, input.durationMinutes),
          durationMinutes: input.durationMinutes,
          notes: input.notes?.trim() || '',
          metadata: {
            feedType: input.feedType,
            breastSide:
              input.feedType === 'breast' ? input.breastSide : undefined,
            breastSidesUsed:
              input.feedType === 'breast' && input.breastSidesUsed
                ? input.breastSidesUsed
                : input.feedType === 'breast' && input.breastSide === 'both'
                  ? ['left', 'right']
                : input.feedType === 'breast' &&
                    (input.breastSide === 'left' || input.breastSide === 'right')
                  ? [input.breastSide]
                  : undefined,
            lastBreastSide:
              input.feedType === 'breast'
                ? input.lastBreastSide ||
                  (input.breastSide === 'left' || input.breastSide === 'right'
                    ? input.breastSide
                    : undefined)
                : undefined,
            leftBreastDurationSeconds:
              input.feedType === 'breast'
                ? input.leftBreastDurationSeconds
                : undefined,
            rightBreastDurationSeconds:
              input.feedType === 'breast'
                ? input.rightBreastDurationSeconds
                : undefined,
            amount: input.feedType === 'bottle' ? input.amount : undefined,
            unit: input.feedType === 'bottle' ? input.unit : undefined,
          },
        });
        setMessage('Feed updated');
      } else {
        await logFeed(input);
        setMessage('Feed logged');
      }
    } else if (input.type === 'diaper') {
      if (input.eventId) {
        const nappyToEdit = events.find(event => event.id === input.eventId);
        await editEvent(input.eventId, {
          ...(nappyToEdit && input.startTime
            ? shiftedEventTimes(nappyToEdit, input.startTime)
            : {}),
          notes: input.notes?.trim() || '',
          metadata: {
            ...nappyToEdit?.metadata,
            diaperCondition: input.condition,
            diaperAmount: input.diaperAmount,
            wetDiaperAmount: input.wetDiaperAmount,
            dirtyDiaperAmount: input.dirtyDiaperAmount,
          },
        });
        setMessage('Nappy updated');
      } else {
        await logDiaper(
          input.condition,
          input.notes,
          input.startTime,
          input.diaperAmount,
          input.wetDiaperAmount,
          input.dirtyDiaperAmount,
        );
        setMessage('Nappy logged');
      }
    } else {
      if (input.eventId) {
        await editEvent(input.eventId, {
          startTime: input.startTime,
          endTime: input.endTime,
          durationMinutes: input.durationMinutes,
          notes: input.notes?.trim() || '',
          metadata: { sleepType: input.sleepType },
        });
        setMessage('Sleep updated');
      } else {
        await logSleep(input.durationMinutes, input.notes, input.sleepType, {
          startTime: input.startTime,
          endTime: input.endTime,
        });
        setMessage('Sleep logged');
      }
    }

    if (isNewLog) {
      setTimeout(() => {
        void maybeShowInterstitial();
      }, 500);
    }
  };

  const handleSaveCareLog = async (input: CareLogInput) => {
    if (editingCareEvent?.id) {
      await editEvent(editingCareEvent.id, {
        ...(input.startTime
          ? shiftedEventTimes(editingCareEvent, input.startTime)
          : {}),
        durationMinutes: input.durationMinutes,
        notes: input.notes?.trim() || '',
        metadata: input.metadata,
      });
      setMessage(`${careActionByType[input.type].label} updated`);
    } else {
      await logCareEvent(input);
      setMessage(`${careActionByType[input.type].label} logged`);
    }
    setTimeout(() => { void maybeShowInterstitial(); }, 500);
  };

  const handleSaveEventEdit = async (
    eventId: string,
    updates: EventEditUpdates,
  ) => {
    const eventBeingEdited =
      editingEvent?.id === eventId ? editingEvent : null;

    if (!eventBeingEdited) {
      await editEvent(eventId, updates);
      return;
    }

    const finishedNursing = await saveEventEditAndFinishStartedNursing(
      eventBeingEdited,
      updates,
      editEvent,
      stopFeed,
    );
    setMessage(finishedNursing ? 'Nursing saved' : 'Activity updated');
  };

  const handleSaveLayout = async () => {
    setSavingLayout(true);
    try {
      await updateHomeActions(draftHomeActions);
      setCustomizing(false);
      setMessage('Home layout saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the Home layout.');
    } finally {
      setSavingLayout(false);
    }
  };

  const handleSaveQuickCarePreference = async (
    careKey: ConfigurableQuickCareKey,
    preference: QuickCarePreference,
  ) => {
    await updateQuickCarePreference(careKey, preference);
    setMessage(
      preference.mode === 'auto'
        ? `${careKey === 'diaper' ? 'Nappy' : careActionByType[careKey === 'nursing' || careKey === 'bottle' ? 'feed' : careKey].label} quick action set to Auto`
        : 'Specific quick action saved',
    );
  };

  const lastPumping = events.find(event => event.type === 'pumping');
  const pumpingPreference = quickCarePreferences.pumping;
  const defaultPumpingSide =
    pumpingPreference?.mode === 'specific'
      ? pumpingPreference.pumpingSide || 'both'
      : lastPumping?.metadata?.pumpingSide || 'both';

  const handlePumping = async () => {
    if (!activePumping) return;

    setPumpingBusy(true);
    try {
      const durationMinutes = Math.max(1, Math.round((Date.now() - activePumping.startTime.getTime()) / 60_000));
      await stopPumping();
      setFocusedQuickCareKey(null);
      setPumpingPanelVisible(false);
      setEditingCareEvent(null);
      setEditingEvent({
        ...activePumping,
        endTime: new Date(),
        durationMinutes,
      });
      setMessage('Pumping stopped — add the amount or storage details');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update pumping.');
    } finally {
      setPumpingBusy(false);
    }
  };

  const handleQuickPumping = async () => {
    setPumpingBusy(true);
    try {
      if (activePumping) {
        await stopPumping();
        setPumpingPanelVisible(false);
        setMessage('Pumping timer stopped');
        setTimeout(() => { void maybeShowInterstitial(); }, 500);
      } else {
        await startPumping(defaultPumpingSide);
        setMessage(`Pumping started — ${defaultPumpingSide}`);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to update pumping.',
      );
    } finally {
      setPumpingBusy(false);
    }
  };

  const openPumpingPanel = () => {
    setFocusedQuickCareKey('pumping');
    setLogModalVisible(false);
    setSelectedAction(null);
    setFeedPanelVisible(false);
    setSleepPanelVisible(false);
    setCareLogType(null);
    setPumpingPanelVisible(true);
  };

  const handleCancelPumping = () => {
    Alert.alert('Cancel pumping timer?', 'This pumping record will be discarded.', [
      { text: 'Keep timer', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => {
        setPumpingBusy(true);
        try {
          await cancelPumping();
          setPumpingPanelVisible(false);
          setMessage('Pumping timer cancelled');
        }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to cancel pumping.'); }
        finally { setPumpingBusy(false); }
      } },
    ]);
  };

  const handleSleep = async () => {
    setSleepBusy(true);
    try {
      if (activeSleep) {
        await stopSleep();
        setMessage('Sleep stopped');
        setTimeout(() => {
          void maybeShowInterstitial();
        }, 500);
      } else {
        await startSleep(quickSleepType);
        setMessage('Sleep started');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update sleep.');
    } finally {
      setSleepBusy(false);
    }
  };

  const handleStartBreastFeed = async (
    side: 'left' | 'right',
    selectedStartTime?: Date,
  ) => {
    clearCompletedFeed();
    const startTime = selectedStartTime || new Date();
    if (startTime.getTime() > Date.now()) {
      const error = new Error('Choose a start time that is not in the future.');
      setMessage(error.message);
      throw error;
    }
    setFeedStartingType(side);
    setFeedSwitchFallback({
      type: 'feed',
      startTime,
      endTime: null,
      source: 'app',
      loggedBy: 'pending',
      metadata: startBreastTiming(side, startTime.getTime()),
    });
    try {
      await startFeed({
        feedType: 'breast',
        breastSide: side,
        startTime,
      });
      setMessage(`Nursing started on the ${side} side`);
      if (activeSleep) {
        Alert.alert('Sleep saved - nursing started', `The sleep timer stopped automatically. Nursing is now running on the ${side} side.`);
      }
    } catch (error) {
      setFeedSwitchFallback(null);
      setFeedStartingType(null);
      setMessage(
        error instanceof Error ? error.message : 'Unable to start feed timer.',
      );
      Alert.alert('Feed did not start', error instanceof Error ? error.message : 'Please try again.');
      throw error;
    }
  };

  const handleLogBottleFeed = async (amount: number, unit: 'ml' | 'oz') => {
    setFeedBusy(true);
    clearCompletedFeed();
    try {
      await logFeed({ feedType: 'bottle', amount, unit });
      if (activeSleep) {
        Alert.alert('Sleep saved - bottle logged', `The sleep timer stopped automatically and the ${amount} ${unit} bottle was saved.`);
      }
      setFeedPanelVisible(false);
      setMessage(`Bottle feed logged — ${amount} ${unit}`);
      if (!activeSleep) setTimeout(() => {
        void maybeShowInterstitial();
      }, 500);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to log bottle feed.',
      );
      Alert.alert('Bottle was not saved', error instanceof Error ? error.message : 'Please try again.');
      throw error;
    } finally {
      setFeedBusy(false);
    }
  };

  const handleSwitchActiveFeed = async (
    timerType: 'left' | 'right' | 'bottle',
  ) => {
    const feedToSwitch = feedSwitchFallback?.id
      ? feedSwitchFallback
      : activeFeed;
    if (!feedToSwitch) return;

    const previousFeedType = feedToSwitch.metadata?.feedType || 'breast';

    if (feedToSwitch.metadata?.feedType === timerType) return;

    const activeOption = runningBreastSide(feedToSwitch.metadata);
    if (activeOption === timerType) return;

    const staysInNursing =
      previousFeedType === 'breast' && timerType !== 'bottle';
    const nextMetadata = {
      ...feedToSwitch.metadata,
      feedType: timerType === 'bottle' ? 'bottle' as const : 'breast' as const,
      breastSide: timerType === 'bottle' ? undefined : timerType,
      ...(timerType === 'bottle'
        ? {}
        : switchBreastSide(feedToSwitch.metadata, timerType)),
    };

    clearCompletedFeed();
    setFeedStartingType(timerType);
    setFeedSwitchFallback({
      ...feedToSwitch,
      id: staysInNursing ? feedToSwitch.id : undefined,
      startTime: timerType === 'bottle' ? new Date() : feedToSwitch.startTime,
      endTime: null,
      durationMinutes: undefined,
      metadata: nextMetadata,
    });
    try {
      if (staysInNursing && feedToSwitch.id) {
        await editEvent(feedToSwitch.id, { metadata: nextMetadata });
      } else {
        await switchFeed({
          feedType: timerType === 'bottle' ? 'bottle' : 'breast',
          breastSide: timerType === 'bottle' ? undefined : timerType,
        });
      }
      setMessage(
        timerType === 'bottle'
          ? 'Bottle feed started — nursing session saved'
          : previousFeedType === 'bottle'
            ? `Nursing started on the ${timerType} side — bottle feed saved`
            : `Switched to the ${timerType} side — timer continued`,
      );
    } catch (error) {
      setFeedSwitchFallback(null);
      setFeedStartingType(null);
      setMessage(
        error instanceof Error ? error.message : 'Unable to switch feed timer.',
      );
    }
  };

  const handleQuickStartSleep = async (
    sleepType?: SleepType,
    startTime?: Date,
  ) => {
    setSleepBusy(true);
    try {
      if (activeFeed) {
        throw new Error('Stop the feed timer before starting sleep.');
      }
      await startSleep(sleepType, startTime);
      setMessage('Sleep timer started');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to start sleep timer.',
      );
    } finally {
      setSleepBusy(false);
    }
  };

  const formatTimeSinceLastEvent = (
    event: BabyEvent | undefined,
    emptyLabel: string,
  ) => {
    if (!event) return emptyLabel;
    // Feeds are spaced start-to-start, so a feed's recency runs from when it
    // began rather than when it finished.
    return formatTimeSinceEvent(event, clockNow, {
      fromStart: event.type === 'feed',
    });
  };

  const formatPreviousTime = (value: string) =>
    value === 'Just now' ? value : `${value} ago`;

  const formatEventDuration = (event: BabyEvent | undefined) => {
    if (!event) return '';
    const minutes =
      event.durationMinutes ??
      (event.endTime
        ? Math.max(
            1,
            Math.round(
              (event.endTime.getTime() - event.startTime.getTime()) / 60_000,
            ),
          )
        : undefined);
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours
      ? remainder
        ? `${hours}h ${remainder}m`
        : `${hours}h`
      : `${minutes}m`;
  };

  const formatCareEventDetail = (event: BabyEvent | undefined) => {
    if (!event) return '';
    const metadata = event.metadata;
    const duration = formatEventDuration(event);

    switch (event.type) {
      case 'solids':
        return metadata?.food || metadata?.foodAmount || 'Meal logged';
      case 'potty':
        return [metadata?.pottyType, metadata?.pottyOutcome]
          .filter(Boolean)
          .join(' · ');
      case 'tummyTime':
      case 'bath':
        return duration;
      case 'growth':
        return [
          metadata?.weightKg ? `${metadata.weightKg} kg` : '',
          metadata?.heightCm ? `${metadata.heightCm} cm` : '',
        ]
          .filter(Boolean)
          .join(' · ');
      case 'temperature':
        return metadata?.temperature !== undefined
          ? `${metadata.temperature} °${metadata.temperatureUnit || 'C'}`
          : '';
      case 'medication':
        return [
          metadata?.medicineName,
          metadata?.doseAmount
            ? `${metadata.doseAmount} ${metadata.doseUnit || ''}`.trim()
            : '',
        ]
          .filter(Boolean)
          .join(' · ');
      case 'milestone':
        return metadata?.milestone || '';
      case 'symptom':
        return metadata?.observation || '';
      case 'appointment':
        return [
          metadata?.appointmentType,
          metadata?.provider,
          metadata?.appointmentLocation,
        ].filter(Boolean).join(' · ');
      case 'immunization':
        return [
          metadata?.immunization,
          metadata?.provider,
          metadata?.immunizationLocation,
        ].filter(Boolean).join(' · ');
      case 'teething':
        return metadata?.tooth || '';
      default:
        return duration;
    }
  };

  const latestFeed = events.find(event => event.type === 'feed');
  const lastNursingFeed = events.find(
    event =>
      event.type === 'feed' &&
      event.metadata?.feedType === 'breast' &&
      Boolean(event.endTime),
  );
  const lastBottleFeed = events.find(
    event =>
      event.type === 'feed' &&
      event.metadata?.feedType === 'bottle' &&
      Boolean(event.endTime),
  );
  const timeSinceLastNursing = formatTimeSinceLastEvent(
    lastNursingFeed,
    'No nursing yet',
  );
  const timeSinceLastBottle = formatTimeSinceLastEvent(
    lastBottleFeed,
    'No bottles yet',
  );
  const lastBreastFeed = events.find(
    event => event.type === 'feed' && event.metadata?.feedType === 'breast',
  );
  const lastCompletedBreastFeed = events.find(
    event =>
      event.type === 'feed' &&
      event.metadata?.feedType === 'breast' &&
      Boolean(event.endTime),
  );
  const previousNursingSide: 'left' | 'right' | undefined =
    lastCompletedBreastFeed?.metadata?.lastBreastSide ||
    (lastCompletedBreastFeed?.metadata?.breastSide === 'left' ||
    lastCompletedBreastFeed?.metadata?.breastSide === 'right'
      ? lastCompletedBreastFeed.metadata.breastSide
      : undefined);
  const lastBreastSide =
    lastBreastFeed?.metadata?.lastBreastSide ||
    (lastBreastFeed?.metadata?.breastSide === 'left' ||
    lastBreastFeed?.metadata?.breastSide === 'right'
      ? lastBreastFeed.metadata.breastSide
      : undefined);
  const lastNursingSide =
    lastNursingFeed?.metadata?.lastBreastSide ||
    (lastNursingFeed?.metadata?.breastSide === 'left' ||
    lastNursingFeed?.metadata?.breastSide === 'right'
      ? lastNursingFeed.metadata.breastSide
      : lastNursingFeed?.metadata?.breastSidesUsed?.[0]);
  const usedBothBreasts =
    lastNursingFeed?.metadata?.breastSide === 'both' ||
    lastNursingFeed?.metadata?.breastSidesUsed?.length === 2;
  const lastNursingSideInitial =
    lastNursingSide === 'left' ? 'L' : lastNursingSide === 'right' ? 'R' : '';
  const lastNursingSummary =
    !lastNursingFeed
      ? ''
      : usedBothBreasts
        ? `L+R${lastNursingSideInitial ? ` → ${lastNursingSideInitial}` : ''}`
        : lastNursingSide === 'left'
          ? 'L'
          : lastNursingSide === 'right'
            ? 'R'
            : 'Nursing';
  const activeFeedSide =
    displayedActiveFeed?.metadata?.breastSide === 'left' ||
    displayedActiveFeed?.metadata?.breastSide === 'right'
      ? displayedActiveFeed.metadata.breastSide
      : displayedActiveFeed?.metadata?.lastBreastSide;
  const activeFeedDescription =
    displayedActiveFeed?.metadata?.feedType === 'bottle'
      ? 'BOTTLE'
      : activeFeedSide === 'left'
        ? 'L'
        : activeFeedSide === 'right'
          ? 'R'
          : 'NURSING';
  const hasTrackedFeedTime = Boolean(
    displayedActiveFeed?.metadata?.breastSideStartedAtMs !== undefined ||
      displayedActiveFeed?.metadata?.leftBreastDurationSeconds !== undefined ||
      displayedActiveFeed?.metadata?.rightBreastDurationSeconds !== undefined,
  );
  const activeFeedDurations = breastDurationsAt(
    displayedActiveFeed?.metadata,
    clockNow.getTime(),
  );
  const activeFeedElapsedSeconds = displayedActiveFeed
    ? displayedActiveFeed.metadata?.feedType === 'breast' && hasTrackedFeedTime
      ? activeFeedDurations.leftBreastDurationSeconds +
        activeFeedDurations.rightBreastDurationSeconds
      : (clockNow.getTime() - displayedActiveFeed.startTime.getTime()) / 1_000
    : 0;
  const activeNursing =
    displayedActiveFeed?.metadata?.feedType !== 'bottle'
      ? displayedActiveFeed
      : null;
  const activeFeedTimer = formatTimerSeconds(activeFeedElapsedSeconds);
  const activeBottle =
    displayedActiveFeed?.metadata?.feedType === 'bottle'
      ? displayedActiveFeed
      : null;
  const feedStartPending = Boolean(
    feedSwitchFallback &&
      !activeFeed &&
      (feedStartingType === 'left' || feedStartingType === 'right'),
  );
  const feedSideChangePending = Boolean(
    feedStartingType && feedSwitchFallback?.id,
  );
  const feedTransitionBlocksControls = Boolean(
    feedStartingType && !feedStartPending && !feedSideChangePending,
  );
  const feedControlsDisabled =
    feedBusy ||
    feedCancelBusy ||
    feedTransitionBlocksControls;
  const hasTrackedLastNursingTime = Boolean(
    lastNursingFeed?.metadata?.leftBreastDurationSeconds !== undefined ||
      lastNursingFeed?.metadata?.rightBreastDurationSeconds !== undefined,
  );
  const lastNursingDurations = lastNursingFeed
    ? breastDurationsForEvent(lastNursingFeed, clockNow.getTime())
    : { leftBreastDurationSeconds: 0, rightBreastDurationSeconds: 0 };
  const lastNursingFallbackSeconds = Math.max(
    0,
    (lastNursingFeed?.durationMinutes || 0) * 60,
  );
  const lastNursingLeftSeconds = hasTrackedLastNursingTime
    ? lastNursingDurations.leftBreastDurationSeconds
    : lastNursingSide === 'left'
      ? lastNursingFallbackSeconds
      : 0;
  const lastNursingRightSeconds = hasTrackedLastNursingTime
    ? lastNursingDurations.rightBreastDurationSeconds
    : lastNursingSide === 'right'
      ? lastNursingFallbackSeconds
      : 0;
  const nursingPreference = quickCarePreferences.nursing;
  const preferredNursingSide =
    nursingPreference?.mode === 'specific'
      ? nursingPreference.breastSide || 'left'
      : lastNursingSide || 'left';
  const nursingQuickSides: Array<'left' | 'right'> =
    (activeFeedSide || preferredNursingSide) === 'right'
      ? ['right', 'left']
      : ['left', 'right'];
  const previousNursingTime = formatPreviousTime(timeSinceLastNursing);
  const previousBottleTime = formatPreviousTime(timeSinceLastBottle);
  const lastBottleSummary = lastBottleFeed?.metadata?.amount
    ? `${lastBottleFeed.metadata.amount} ${lastBottleFeed.metadata.unit || 'ml'}`
    : 'Bottle';
  // The hints always describe the previous feed, even while a timer is
  // running, so the live timers on the action buttons cannot be mistaken for
  // the gap since the last feed.
  const nursingHint = lastNursingFeed ? previousNursingTime : 'No nursing yet';
  const previousNursingSides = lastNursingFeed
    ? `L ${formatNursingDuration(lastNursingLeftSeconds)} · R ${formatNursingDuration(
        lastNursingRightSeconds,
      )}`
    : '';
  const bottleHint = lastBottleFeed ? previousBottleTime : 'No bottles yet';
  const lastNappy = events.find(event => event.type === 'diaper');
  const timeSinceLastNappy = formatTimeSinceLastEvent(
    lastNappy,
    'No nappies yet',
  );
  const lastNappyType =
    lastNappy?.metadata?.diaperCondition === 'wet'
      ? 'Wet'
      : lastNappy?.metadata?.diaperCondition === 'dirty'
        ? 'Dirty'
        : lastNappy?.metadata?.diaperCondition === 'both'
          ? 'Wet + dirty'
          : '';
  const lastNappyAmount = formatDiaperAmountDetail(lastNappy?.metadata);
  const nappyHint = lastNappy
    ? formatPreviousTime(timeSinceLastNappy)
    : 'No nappies yet';
  const lastBottleWithUnit = events.find(
    event =>
      event.type === 'feed' &&
      event.metadata?.feedType === 'bottle' &&
      (event.metadata?.unit === 'ml' || event.metadata?.unit === 'oz'),
  );
  const defaultBottleUnit: 'ml' | 'oz' =
    lastBottleWithUnit?.metadata?.unit === 'oz' ? 'oz' : 'ml';
  const bottlePreference = quickCarePreferences.bottle;
  const quickBottleAmount =
    bottlePreference?.mode === 'specific'
      ? bottlePreference.bottleAmount
      : lastBottleFeed?.metadata?.amount;
  const quickBottleUnit: 'ml' | 'oz' =
    bottlePreference?.mode === 'specific'
      ? bottlePreference.bottleUnit || 'ml'
      : lastBottleFeed?.metadata?.unit === 'oz'
        ? 'oz'
        : defaultBottleUnit;
  const lastSleep = events.find(event => event.type === 'sleep');
  const timeSinceLastSleep = formatTimeSinceLastEvent(
    lastSleep,
    'No sleeps yet',
  );
  const sleepPreference = quickCarePreferences.sleep;
  // A sleep carries a location only when someone chooses one. Neither the last
  // sleep nor a fallback gets to put a baby in a cot they were never in.
  const quickSleepType: SleepType | undefined =
    sleepPreference?.mode === 'specific'
      ? sleepPreference.sleepType
      : undefined;
  const lastSleepDuration = formatEventDuration(lastSleep);
  const sleepHint = activeSleep
    ? formatTimerSeconds(
        (clockNow.getTime() - activeSleep.startTime.getTime()) / 1_000,
      )
    : lastSleep
      ? formatPreviousTime(timeSinceLastSleep)
      : 'No sleeps yet';
  const activePumpingSide =
    activePumping?.metadata?.pumpingSide === 'left'
      ? 'LEFT'
      : activePumping?.metadata?.pumpingSide === 'right'
        ? 'RIGHT'
        : 'BOTH';

  const handleVoiceCommand = async (command: VoiceCommand) => {
    if (command.kind === 'start-feed') {
      await handleStartBreastFeed(lastBreastSide || 'left');
      return;
    }

    if (command.kind === 'log-feed') {
      await logFeed({
        feedType: command.feedType,
        amount: command.amount,
        unit: command.unit,
        durationMinutes: command.durationMinutes,
      });
      setMessage('Feed logged from voice input');
    } else if (command.kind === 'stop-feed') {
      if (!activeFeed) throw new Error('There is no feed timer to stop.');
      await handleStopFeed();
      return;
    } else if (command.kind === 'start-sleep') {
      await startSleep(command.sleepType);
      setMessage('Sleep timer started from voice input');
      return;
    } else if (command.kind === 'log-sleep') {
      await logSleep(command.durationMinutes, undefined, command.sleepType);
      setMessage('Sleep logged from voice input');
    } else if (command.kind === 'stop-sleep') {
      if (!activeSleep) throw new Error('There is no sleep timer to stop.');
      await handleSleep();
      return;
    } else {
      await logDiaper(command.condition);
      setMessage('Nappy logged from voice input');
    }

    setTimeout(() => {
      void maybeShowInterstitial();
    }, 500);
  };

  const handleChangeActiveFeedStart = async (nextStartTime: Date) => {
    const feedToEdit = displayedActiveFeed;
    if (!feedToEdit?.id) return;

    const nowMs = Date.now();
    if (nextStartTime.getTime() > nowMs) {
      setMessage('Choose a start time that is not in the future.');
      return;
    }

    const isNursing = feedToEdit.metadata?.feedType !== 'bottle';
    const metadata = isNursing
      ? adjustBreastTimingForStartChange(
          feedToEdit.metadata,
          feedToEdit.startTime.getTime(),
          nextStartTime.getTime(),
          nowMs,
        )
      : feedToEdit.metadata;

    setFeedSwitchFallback(null);
    setFeedStartTimeFallback({
      ...feedToEdit,
      startTime: nextStartTime,
      metadata,
    });
    setFeedStartTimeBusy(true);
    try {
      await editEvent(feedToEdit.id, {
        startTime: nextStartTime,
        metadata,
      });
      setMessage('Feed start time updated');
    } catch (error) {
      setFeedStartTimeFallback(null);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the feed start time.',
      );
    } finally {
      setFeedStartTimeBusy(false);
    }
  };

  const handleStopFeed = async () => {
    const feedToStop = displayedActiveFeed;
    if (!feedToStop || feedBusy) return;
    const endTime = new Date();
    const isNursing = feedToStop.metadata?.feedType === 'breast';
    const completedMetadata = isNursing
      ? finishBreastTiming(feedToStop.metadata, endTime.getTime())
      : feedToStop.metadata;
    const trackedSeconds =
      (completedMetadata?.leftBreastDurationSeconds || 0) +
      (completedMetadata?.rightBreastDurationSeconds || 0);

    setFeedBusy(true);
    setFeedSwitchFallback(null);
    setCompletedFeed(
      feedPanelVisible && !isNursing
        ? {
            ...feedToStop,
            endTime,
            durationMinutes: Math.max(
              1,
              Math.round(
                isNursing && trackedSeconds > 0
                  ? trackedSeconds / 60
                  : (endTime.getTime() - feedToStop.startTime.getTime()) / 60_000,
              ),
            ),
            metadata: completedMetadata,
          }
        : null,
    );

    try {
      await stopFeed(feedToStop);
      if (isNursing) closeFocusedQuickCare();
      setMessage(isNursing ? 'Nursing saved' : 'Feed timer stopped');
      setTimeout(() => {
        void maybeShowInterstitial();
      }, 500);
    } catch (error) {
      clearCompletedFeed();
      setMessage(error instanceof Error ? error.message : 'Unable to stop feed.');
    } finally {
      setFeedBusy(false);
    }
  };

  const handleEditFeed = () => {
    const feedToEdit =
      completedFeed ||
      (feedSwitchFallback?.id ? feedSwitchFallback : activeFeed);
    if (!feedToEdit?.id) return;

    if (
      !feedToEdit.endTime &&
      feedToEdit.metadata?.feedType === 'breast' &&
      runningBreastSide(feedToEdit.metadata)
    ) {
      setMessage('Pause nursing before editing this feed.');
      return;
    }

    setFeedSwitchFallback(null);
    setFeedStartTimeFallback(null);
    setFeedStartingType(null);
    closeFocusedQuickCare();
    setEditingEvent(feedToEdit);
  };

  const handleDiscardCompletedFeed = () => {
    const eventId = completedFeed?.id;
    if (!eventId) return;

    Alert.alert(
      'Discard saved feed?',
      'This feed will be removed from the shared timeline.',
      [
        { text: 'Keep feed', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            setFeedCancelBusy(true);
            try {
              await deleteEvent(eventId);
              closeFocusedQuickCare();
              setMessage('Feed discarded');
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to discard the saved feed.',
              );
            } finally {
              setFeedCancelBusy(false);
            }
          },
        },
      ],
    );
  };

  const handlePauseBreastSide = async () => {
    const feedToPause = feedSwitchFallback?.id
      ? feedSwitchFallback
      : activeFeed;
    if (
      !feedToPause?.id ||
      feedToPause.metadata?.feedType !== 'breast' ||
      !runningBreastSide(feedToPause.metadata)
    ) {
      return;
    }

    const pausedSide = runningBreastSide(feedToPause.metadata)!;
    const pausedMetadata = finishBreastTiming(feedToPause.metadata, Date.now());
    setFeedStartingType('pause');
    setFeedSwitchFallback({
      ...feedToPause,
      metadata: pausedMetadata,
    });

    try {
      await editEvent(feedToPause.id, { metadata: pausedMetadata });
      // The pause write is complete, so the paused feed can be finished or
      // edited even if the subscription snapshot has not caught up yet.
      setFeedStartingType(null);
      setMessage(
        `${pausedSide === 'left' ? 'Left' : 'Right'} side paused — choose a side to continue`,
      );
    } catch (error) {
      setFeedSwitchFallback(null);
      setFeedStartingType(null);
      setMessage(
        error instanceof Error ? error.message : 'Unable to pause nursing.',
      );
    }
  };

  const handleContinueFeed = async (requestedSide?: 'left' | 'right') => {
    if (!completedFeed?.id) return;

    const isNursing = completedFeed.metadata?.feedType === 'breast';
    const resumeSide =
      requestedSide ||
      completedFeed.metadata?.lastBreastSide ||
      (completedFeed.metadata?.breastSide === 'right' ? 'right' : 'left');
    const resumedMetadata = isNursing
      ? {
          ...completedFeed.metadata,
          ...switchBreastSide(completedFeed.metadata, resumeSide, Date.now()),
        }
      : completedFeed.metadata;

    setFeedStartingType(isNursing ? resumeSide : 'bottle');
    setFeedSwitchFallback({
      ...completedFeed,
      id: undefined,
      endTime: null,
      durationMinutes: undefined,
      metadata: resumedMetadata,
    });

    try {
      await reopenEvent(completedFeed.id, resumedMetadata);
      clearCompletedFeed();
      setMessage(
        isNursing
          ? `Nursing continued on the ${resumeSide} side`
          : 'Bottle feed continued',
      );
    } catch (error) {
      setFeedSwitchFallback(null);
      setFeedStartingType(null);
      setMessage(
        error instanceof Error ? error.message : 'Unable to continue feed.',
      );
    }
  };

  const handleStopFeedForManual = async () => {
    await stopFeed();
    setMessage('Feed timer stopped — finish the manual entry');
  };

  const handleStopSleepForManual = async () => {
    await stopSleep();
    setMessage('Sleep timer stopped — finish the manual entry');
  };

  const handleCancelFeed = () => {
    Alert.alert(
      'Cancel feed timer?',
      'This running feed will be discarded and will not appear in the timeline.',
      [
        { text: 'Keep timer', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            setFeedCancelBusy(true);
            try {
              await cancelFeed();
              setFeedSwitchFallback(null);
              setMessage('Feed timer cancelled');
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to cancel feed timer.',
              );
            } finally {
              setFeedCancelBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelSleep = () => {
    Alert.alert(
      'Cancel sleep timer?',
      'This running sleep will be discarded and will not appear in the timeline.',
      [
        { text: 'Keep timer', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            setSleepCancelBusy(true);
            try {
              await cancelSleep();
              setMessage('Sleep timer cancelled');
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : 'Unable to cancel sleep timer.',
              );
            } finally {
              setSleepCancelBusy(false);
            }
          },
        },
      ],
    );
  };

  // `undefined` clears the place: a sleep without one is a valid sleep, so
  // tapping the selected card again has to be able to unset it.
  const handleUpdateSleepType = async (sleepType: SleepType | undefined) => {
    if (!activeSleep?.id || activeSleep.metadata?.sleepType === sleepType) return;

    setSleepTypeBusy(true);
    try {
      await editEvent(activeSleep.id, {
        metadata: {
          ...activeSleep.metadata,
          sleepType,
        },
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to update sleep type.',
      );
    } finally {
      setSleepTypeBusy(false);
    }
  };

  const handleNursingQuickSide = (side: 'left' | 'right') => {
    if (feedStartPending) return;

    if (!displayedActiveFeed) {
      void handleStartBreastFeed(side).catch(() => {});
      return;
    }

    if (
      displayedActiveFeed.metadata?.feedType === 'breast' &&
      runningBreastSide(displayedActiveFeed.metadata) === side
    ) {
      void handlePauseBreastSide();
      return;
    }

    void handleSwitchActiveFeed(side);
  };

  const handleQuickNappy = async (
    condition: 'wet' | 'dirty' | 'both',
  ) => {
    setNappyBusy(true);
    try {
      await logDiaper(condition);
      setMessage(
        condition === 'both'
          ? 'Wet + dirty nappy logged'
          : `${condition === 'wet' ? 'Wet' : 'Dirty'} nappy logged`,
      );
      setTimeout(() => { void maybeShowInterstitial(); }, 500);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to log nappy.',
      );
    } finally {
      setNappyBusy(false);
    }
  };

  const handleQuickBottle = () => {
    if (activeBottle) {
      void handleStopFeed();
      return;
    }
    if (activeNursing) {
      void handleSwitchActiveFeed('bottle');
      return;
    }

    if (quickBottleAmount && quickBottleAmount > 0) {
      void handleLogBottleFeed(quickBottleAmount, quickBottleUnit).catch(() => {});
      return;
    }

    openFeedPanel('bottle');
  };

  const renderHomeAction = (key: QuickCareKey) => {
    if (key === 'nursing') {
      const nursingRunningSide = activeNursing
        ? runningBreastSide(activeNursing.metadata)
        : null;
      const nursingPaused = Boolean(activeNursing && !nursingRunningSide);
      // While a feed runs, each side action carries its own live time.
      // The side the previous feed finished on, marked with the same star the
      // nursing screen's side cards use. Only while nothing is running: mid-feed
      // the pills carry live times and "last" would just be noise.
      const nursingLastSide = previousNursingSide || lastBreastSide;
      const sideActions = nursingQuickSides.map(side => {
        const isCurrentSide = nursingRunningSide === side;
        const showsLastMark = !displayedActiveFeed && nursingLastSide === side;
        const liveSideSeconds =
          side === 'left'
            ? activeFeedDurations.leftBreastDurationSeconds
            : activeFeedDurations.rightBreastDurationSeconds;
        return {
          label: isCurrentSide ? 'Pause' : nursingPaused ? (liveSideSeconds > 0 ? 'Resume' : 'Start') : displayedActiveFeed ? 'Switch' : 'Start',
          detail: side === 'left' ? 'Left' : 'Right',
          icon: isCurrentSide
            ? 'pause'
            : nursingPaused
              ? 'play'
              : displayedActiveFeed
                ? 'swap-horizontal'
                : 'play',
          onPress: () => handleNursingQuickSide(side),
          accessibilityLabel: isCurrentSide
            ? `Pause nursing on the ${side} side`
            : nursingPaused
              ? `Continue nursing on the ${side} side`
              : activeNursing
                ? `Switch nursing to the ${side} side`
                : `Start nursing on the ${side} side${
                    showsLastMark ? ', the side used last' : ''
                  }`,
          disabled: feedControlsDisabled,
          selected: isCurrentSide,
          lastUsed: showsLastMark,
        };
      });

      return (
        <HomeCareCard
          key={key}
          selected={selectedQuickCareKey === key}
          title="Nursing"
          icon="mother-nurse"
          color={eventColors.feed}
          onPress={() => openFeedPanel('breast')}
          onLongPress={() => openPreviousEntry(lastNursingFeed, 'nursing feed')}
          status={activeNursing ? (nursingPaused ? 'Paused' : 'Nursing now') : undefined}
          summaryLine={activeNursing ? activeFeedTimer : nursingHint}
          emphasizeSummary={Boolean(activeNursing)}
          summaryLabel={lastNursingFeed ? '' : 'Nursing'}
          stats={
            activeNursing || lastNursingFeed
              ? [
                  {
                    label: 'Left',
                    value: formatNursingDuration(activeNursing ? activeFeedDurations.leftBreastDurationSeconds : lastNursingLeftSeconds),
                  },
                  {
                    label: 'Right',
                    value: formatNursingDuration(activeNursing ? activeFeedDurations.rightBreastDurationSeconds : lastNursingRightSeconds),
                  },
                ]
              : undefined
          }
          disabled={feedControlsDisabled}
          quickActions={sideActions}
          compactActions
          roundAction={{
            icon: 'check',
            onPress: () => {
              void handleStopFeed();
            },
            accessibilityLabel: activeNursing
              ? `Finish and save this feed, ${activeFeedTimer} so far`
              : 'No nursing feed is running',
            disabled:
              feedControlsDisabled ||
              feedStartPending ||
              feedSideChangePending ||
              !activeNursing,
          }}
          accessibilityHint={
            activeNursing
              ? nursingRunningSide
                ? `Nursing on ${activeFeedDescription}, ${activeFeedTimer}. Last feed started ${previousNursingTime}. Opens the nursing controls.`
                : `Nursing is paused at ${activeFeedTimer}. Last feed started ${previousNursingTime}. Opens the nursing controls.`
              : lastNursingFeed
                ? `Last feed started ${previousNursingTime}, ${lastNursingSummary}, ${previousNursingSides}. Opens the nursing controls. Hold to edit that feed.`
                : 'Opens the nursing controls.'
          }
        />
      );
    }

    if (key === 'bottle') {
      return (
        <HomeCareCard
          key={key}
          selected={selectedQuickCareKey === key}
          title="Bottle"
          icon="baby-bottle-outline"
          color={eventColors.feed}
          onPress={() => openFeedPanel('bottle')}
          onLongPress={() => openPreviousEntry(lastBottleFeed, 'bottle feed')}
          hint={bottleHint}
          summaryLabel={lastBottleFeed ? '' : 'Bottle'}
          stats={
            lastBottleFeed ? [{ value: lastBottleSummary }] : undefined
          }
          disabled={feedControlsDisabled}
          quickActions={[
            {
              label: activeBottle
                ? 'Bottle'
                : activeNursing
                  ? 'Bottle'
                  : quickBottleAmount
                    ? 'Same'
                    : 'Bottle',
              detail: activeBottle
                ? `Stop · ${activeFeedTimer}`
                : activeNursing
                  ? 'Switch'
                  : quickBottleAmount
                    ? `${quickBottleAmount} ${quickBottleUnit}`
                    : 'Enter amount',
              icon: activeBottle
                ? 'stop'
                : activeNursing
                  ? 'swap-horizontal'
                  : quickBottleAmount
                    ? 'repeat'
                    : 'plus',
              onPress: handleQuickBottle,
              accessibilityLabel: activeBottle
                ? 'Stop the bottle feed'
                : activeNursing
                  ? 'Switch nursing to a bottle feed'
                  : quickBottleAmount
                    ? `Log another ${quickBottleAmount} ${quickBottleUnit} bottle`
                    : 'Enter a bottle amount',
              disabled: feedControlsDisabled,
              selected: Boolean(activeBottle),
            },
          ]}
          accessibilityHint={
            activeBottle
              ? `Bottle feed ${activeFeedTimer}. Last bottle started ${previousBottleTime}. Opens the bottle feed controls.`
              : lastBottleFeed
                ? `Last bottle started ${previousBottleTime}, ${lastBottleSummary}. Opens the bottle form. Hold to edit that bottle.`
                : 'Opens the bottle form.'
          }
        />
      );
    }

    const type = key;
    if (type === 'sleep') {
      return (
        <HomeCareCard
          key={type}
          selected={selectedQuickCareKey === type}
          title="Sleep"
          icon="sleep"
          color={eventColors.sleep}
          onPress={openSleepPanel}
          onLongPress={() => openPreviousEntry(lastSleep, 'sleep')}
          hint={activeSleep ? sleepHint : lastSleep?.endTime ? `Last sleep ended ${formatPreviousTime(formatTimeSinceLastEvent(lastSleep, ''))}` : sleepHint}
          summaryLabel={activeSleep ? 'Sleeping now' : ''}
          disabled={sleepBusy || sleepCancelBusy}
          quickActions={[
            {
              label: activeSleep ? 'Stop sleep' : 'Start sleep',
              icon: activeSleep ? 'stop' : 'play',
              onPress: () => {
                if (activeSleep) void handleSleep();
                else void handleQuickStartSleep(quickSleepType);
              },
              accessibilityLabel: activeSleep
                ? 'Stop the sleep timer'
                : 'Start sleep timer',
              disabled: sleepBusy || sleepCancelBusy,
              selected: Boolean(activeSleep),
            },
          ]}
          accessibilityHint="Opens the sleep controls. Hold to edit the last sleep."
        />
      );
    }
    if (type === 'diaper') {
      return (
        <HomeCareCard
          key={type}
          selected={selectedQuickCareKey === type}
          title="Nappy"
          icon="human-baby-changing-table"
          color={eventColors.diaper}
          onPress={() => openLog('diaper')}
          onLongPress={() => openPreviousEntry(lastNappy, 'nappy')}
          onEditLast={lastNappy ? () => openPreviousEntry(lastNappy, 'nappy') : undefined}
          hint={lastNappy ? `${lastNappyType === 'Wet + dirty' ? 'Mixed' : lastNappyType === 'Dirty' ? 'Poo' : lastNappyType} · ${nappyHint}` : nappyHint}
          stats={lastNappyAmount ? [{ value: lastNappyAmount }] : undefined}
          disabled={nappyBusy}
          quickActions={[
            {
              label: 'Wet',
              icon: 'water-outline',
              onPress: () => { void handleQuickNappy('wet'); },
              accessibilityLabel: 'Log a wet nappy now',
              disabled: nappyBusy,
            },
            {
              label: 'Mixed',
              icon: 'checkbox-multiple-marked-circle-outline',
              onPress: () => { void handleQuickNappy('both'); },
              accessibilityLabel: 'Log a wet and poo nappy now',
              disabled: nappyBusy,
            },
            {
              label: 'Poo',
              icon: 'emoticon-poop-outline',
              onPress: () => { void handleQuickNappy('dirty'); },
              accessibilityLabel: 'Log a poo nappy now',
              disabled: nappyBusy,
            },
          ]}
          accessibilityHint={
            lastNappy
              ? `Last nappy: ${timeSinceLastNappy}, ${[lastNappyType || 'type not recorded', lastNappyAmount].filter(Boolean).join(', ')}. Opens the nappy logging form. Hold to edit that nappy.`
              : 'No nappies yet. Opens the nappy logging form.'
          }
        />
      );
    }
    if (type === 'pumping') {
      return (
        <HomeCareCard
          key={type}
          selected={selectedQuickCareKey === type}
          title="Pumping"
          icon={careActionByType.pumping.icon}
          color={careActionByType.pumping.color}
          onPress={activePumping ? openPumpingPanel : () => openCareLog('pumping')}
          onLongPress={() => openPreviousEntry(lastPumping, 'pumping session')}
          hint={
            activePumping
              ? formatTimerSeconds((clockNow.getTime() - activePumping.startTime.getTime()) / 1_000)
              : lastPumping
                ? formatPreviousTime(formatTimeSinceLastEvent(lastPumping, ''))
                : 'Not logged yet'
          }
          summaryLabel={activePumping ? 'Pumping now' : ''}
          disabled={pumpingBusy}
          quickActions={[
            {
              label: 'Pumping',
              detail: activePumping ? 'Stop' : `Start ${defaultPumpingSide}`,
              icon: activePumping ? 'stop' : 'play',
              onPress: () => { void handleQuickPumping(); },
              accessibilityLabel: activePumping
                ? 'Stop the pumping timer'
                : `Start pumping on ${defaultPumpingSide}`,
              disabled: pumpingBusy,
              selected: Boolean(activePumping),
            },
          ]}
          accessibilityHint="Opens pumping details. The action button starts or stops the timer. Hold to edit the last pumping session."
        />
      );
    }
    const definition = careActionByType[type];
    const lastEvent = events.find(event => event.type === type);
    const growthAge =
      type === 'growth' && lastEvent && selectedBaby?.dateOfBirth
        ? formatBabyAgeAtDate(selectedBaby.dateOfBirth, lastEvent.startTime)
        : null;
    const hint =
      type === 'growth'
        ? lastEvent
          ? growthAge
            ? `Recorded at ${growthAge}`
            : 'Age not available'
          : 'Not logged yet'
        : lastEvent
          ? formatPreviousTime(formatTimeSinceLastEvent(lastEvent, ''))
          : 'Not logged yet';
    return (
      <HomeCareCard
        key={type}
        selected={selectedQuickCareKey === type}
        title={definition.label}
        icon={definition.icon}
        color={definition.color}
        onPress={() => openCareLog(type)}
        onLongPress={() =>
          openPreviousEntry(lastEvent, definition.label.toLowerCase())
        }
        hint={hint}
        summaryLine={type === 'growth' ? formatCareEventDetail(lastEvent) : undefined}
        emphasizeSummary={type === 'growth'}
        summaryLabel=""
        stats={type !== 'growth' && formatCareEventDetail(lastEvent)
          ? [{ value: formatCareEventDetail(lastEvent) }]
          : undefined}
        quickActions={[
          {
            label: 'Add',
            detail: type === 'growth' ? undefined : definition.label,
            icon: 'plus',
            onPress: () => openCareLog(type),
            accessibilityLabel: `Add ${definition.label.toLowerCase()} details`,
          },
        ]}
        accessibilityHint={
          type === 'growth' && lastEvent
            ? `Last growth measurement: ${hint}. Opens the growth form.`
            : `Last ${definition.label.toLowerCase()}: ${formatTimeSinceLastEvent(lastEvent, 'not logged yet')}. Opens the ${definition.label.toLowerCase()} form.`
        }
      />
    );
  };

  const renderExpandedCarePanel = () => {
    if (feedPanelVisible) {
      return feedPanel ? (
        <ActiveFeedTimer
          startTime={feedPanel.startTime}
          endTime={feedPanel.endTime || undefined}
          feedType={feedPanel.metadata?.feedType || 'breast'}
          breastSide={feedPanel.metadata?.breastSide}
          lastBreastSide={feedPanel.metadata?.lastBreastSide || lastBreastSide}
          previousFeedSide={previousNursingSide}
          leftBreastDurationSeconds={feedPanel.metadata?.leftBreastDurationSeconds}
          rightBreastDurationSeconds={feedPanel.metadata?.rightBreastDurationSeconds}
          breastSideStartedAtMs={feedPanel.metadata?.breastSideStartedAtMs}
          completed={Boolean(completedFeed)}
          showCloseButton={false}
          onStop={handleStopFeed}
          onPause={() => {
            void handlePauseBreastSide();
          }}
          onContinue={side => {
            void handleContinueFeed(side);
          }}
          onClose={closeFocusedQuickCare}
          onEdit={handleEditFeed}
          onDiscard={handleDiscardCompletedFeed}
          onCancel={handleCancelFeed}
          onSwitchToManual={() => openLog('feed', feedPanel.startTime)}
          stopping={feedBusy}
          cancelling={feedCancelBusy}
          switching={feedTransitionBlocksControls}
          savingSideChange={feedSideChangePending}
          onChangeBreastSide={side => {
            void handleSwitchActiveFeed(side);
          }}
          onChangeStartTime={nextStartTime => {
            void handleChangeActiveFeedStart(nextStartTime);
          }}
          changingStartTime={feedStartTimeBusy}
          sleepSessionActive={Boolean(activeSleep)}
        />
      ) : (
        <FeedPanel
          key={feedPanelDefaultType}
          feedType={feedPanelDefaultType}
          defaultBreastSide={previousNursingSide || lastBreastSide}
          defaultUnit={defaultBottleUnit}
          showCloseButton={false}
          onClose={closeFocusedQuickCare}
          onManualEntry={startTime => openLog('feed', startTime)}
          onStartBreastFeed={handleStartBreastFeed}
          onLogBottleFeed={handleLogBottleFeed}
        />
      );
    }

    if (sleepPanelVisible) {
      return activeSleep ? (
        <SleepTimerScreen
          startTime={activeSleep.startTime}
          sleepType={optionalSleepLocation(
            activeSleep.metadata?.sleepType,
            customSleepLocations,
          )}
          customSleepLocations={customSleepLocations}
          onAddSleepLocation={addSleepLocation}
          onChangeSleepType={sleepType => {
            void handleUpdateSleepType(sleepType);
          }}
          onStop={() => void handleSleep()}
          onDiscard={handleCancelSleep}
          onManual={() => openLog('sleep')}
          onBack={closeFocusedQuickCare}
          busy={sleepBusy || sleepCancelBusy || sleepTypeBusy}
        />
      ) : (
        <SleepStartScreen
          defaultSleepType={quickSleepType}
          customSleepLocations={customSleepLocations}
          onAddSleepLocation={addSleepLocation}
          onClose={closeFocusedQuickCare}
          onStart={handleQuickStartSleep}
          onManualEntry={startTime => openLog('sleep', startTime)}
        />
      );
    }

    if (pumpingPanelVisible && activePumping) {
      return (
        <>
          <ActivePumpingTimer
            startTime={activePumping.startTime}
            side={activePumping.metadata?.pumpingSide || 'both'}
            busy={pumpingBusy}
            onStop={handlePumping}
            onCancel={handleCancelPumping}
            onManual={handlePumping}
            onChangeSide={side => {
              if (!activePumping.id) return;
              void editEvent(activePumping.id, {
                metadata: { ...activePumping.metadata, pumpingSide: side },
              });
            }}
          />
          <View style={styles.focusedActivityFooter}>
            <Button
              mode="text"
              icon="arrow-up"
              onPress={closeFocusedQuickCare}
            >
              Close pumping card
            </Button>
          </View>
        </>
      );
    }

    if (logModalVisible) {
      return (
        <LogModal
          visible
          type={selectedAction}
          onClose={closeFocusedQuickCare}
          onSave={handleSaveLog}
          activeFeed={activeFeed}
          activeSleep={activeSleep}
          onStopActiveFeed={handleStopFeedForManual}
          onStopActiveSleep={handleStopSleepForManual}
          defaultFeedType={feedPanelDefaultType}
          defaultBottleUnit={defaultBottleUnit}
          showCloseButton={false}
          previousDiaper={lastNappy}
          initialStartTime={manualEntryStartTime}
          customSleepLocations={customSleepLocations}
          onAddSleepLocation={addSleepLocation}
        />
      );
    }

    if (careLogType || editingCareEvent) {
      return (
        <CareLogModal
          visible
          embedded
          type={
            editingCareEvent
              ? (editingCareEvent.type as AdditionalCareType)
              : careLogType
          }
          event={editingCareEvent}
          onClose={closeFocusedQuickCare}
          onSave={handleSaveCareLog}
          onDelete={deleteEvent}
        />
      );
    }

    return null;
  };

  const isActiveEvent = (event: BabyEvent) =>
    isActiveBabyEvent(event, {
      feed: activeFeed?.id,
      sleep: activeSleep?.id,
      pumping: activePumping?.id,
    });

  const openRecentEventEditor = (event: BabyEvent) => {
    if (isActiveEvent(event)) return;

    if (usesEventEditModal(event.type)) {
      setEditingEvent(event);
      return;
    }

    openCareEventEditor(event);
  };

  /**
   * Holding a Quick Care card opens the entry that card logged last.
   *
   * A tap logs in one move and says nothing else; the detail a caregiver only
   * remembers afterwards — that the nappy was heavy — is added by holding the
   * same card, rather than hunting the entry down in the timeline.
   */
  const openPreviousEntry = (event: BabyEvent | undefined, label: string) => {
    if (!event) {
      setMessage(`No ${label} logged yet`);
      return;
    }
    if (isActiveEvent(event)) {
      setMessage(`That ${label} is still running`);
      return;
    }
    openRecentEventEditor(event);
  };

  const recentEvents = events.slice(0, 4);
  const appointments = events.filter(event => event.type === 'appointment');
  const selectedRecentEvents = events.filter(
    event => event.id && recentSelectedIds.includes(event.id),
  );
  const selectingRecent = recentSelectedIds.length > 0;
  const recentMergeProblem = selectingRecent
    ? mergeBlocker(selectedRecentEvents)
    : null;

  const toggleRecentSelected = (event: BabyEvent) => {
    if (!event.id || isActiveEvent(event)) return;
    const eventId = event.id;
    setRecentSelectedIds(current =>
      current.includes(eventId)
        ? current.filter(id => id !== eventId)
        : [...current, eventId],
    );
  };

  const runRecentBulkAction = async (
    action: () => Promise<void>,
    fallback: string,
  ) => {
    setRecentBulkBusy(true);
    try {
      await action();
      setRecentSelectedIds([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : fallback);
    } finally {
      setRecentBulkBusy(false);
    }
  };

  const confirmDeleteRecent = () => {
    const count = recentSelectedIds.length;
    Alert.alert(
      count === 1 ? 'Delete this activity?' : `Delete ${count} activities?`,
      'They will be removed from the shared timeline.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void runRecentBulkAction(async () => {
              await deleteEvents(recentSelectedIds);
              setMessage(
                count === 1 ? 'Activity deleted' : `${count} activities deleted`,
              );
            }, 'Unable to delete these activities.'),
        },
      ],
    );
  };

  const confirmMergeRecent = () => {
    if (recentMergeProblem) {
      setMessage(recentMergeProblem);
      return;
    }

    Alert.alert(
      'Merge these activities?',
      describeMergeResult(selectedRecentEvents),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: () =>
            void runRecentBulkAction(async () => {
              await mergeEvents(recentSelectedIds);
              setMessage('Activities merged');
            }, 'Unable to merge these activities.'),
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, (width < 380 || fontScale > 1.2) && styles.headerWrapped]}>
          <View style={styles.headerLeft}>
            <Text variant="bodyMedium" style={styles.eyebrow}>
              Caring for
            </Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <BabySelector
                  currentBabyName={selectedBaby.name}
                  currentBabyAge={selectedBabyAge}
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
          <View style={styles.headerRight}>
            <Surface
              style={[
                styles.datePill,
                { backgroundColor: theme.colors.elevation.level2 },
              ]}
              elevation={0}
            >
              <Text variant="labelLarge" style={styles.dateText}>
                {clockNow.toLocaleDateString([], {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </Text>
            </Surface>
            <AppearanceModeToggle compact />
          </View>
        </View>

        <DailySummary
          compact
          events={homeSummaryEvents}
          period={summaryPeriod}
          onPeriodChange={setSummaryPeriod}
          onPress={() => router.push('/(app)/(tabs)/stats')}
        />

        <View
          style={styles.actionsHeader}
        >
          <Text variant="titleMedium" style={styles.actionsTitle}>
            Quick care
          </Text>
          <Button
            mode="text"
            icon="tune-variant"
            compact
            style={styles.customiseButton}
            contentStyle={styles.customiseButtonContent}
            labelStyle={styles.customiseButtonLabel}
            onPress={() => {
              setDraftHomeActions(homeActions);
              setCustomizing(true);
            }}
          >
            Customise
          </Button>
          <VoiceInputCard
            placement="quickCareHeader"
            onCommand={handleVoiceCommand}
          />
        </View>
        <View style={styles.quickCareList}>
          {quickCareKeys.map(key => renderHomeAction(key))}
        </View>

        <AppointmentsList
          appointments={appointments}
          onPress={openRecentEventEditor}
        />

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Recent activity
          </Text>
          {eventsLoading ? <ActivityIndicator size="small" /> : null}
        </View>
        {selectingRecent ? (
          <Surface
            style={[
              styles.recentSelectionBar,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            elevation={1}
          >
            <View style={styles.recentSelectionHeader}>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setRecentSelectedIds([])}
                disabled={recentBulkBusy}
                accessibilityLabel="Clear recent activity selection"
                style={styles.recentSelectionClose}
              />
              <Text variant="titleMedium" style={styles.recentSelectionCount}>
                {recentSelectedIds.length} selected
              </Text>
              <Button
                mode="text"
                icon="call-merge"
                onPress={confirmMergeRecent}
                disabled={recentBulkBusy || Boolean(recentMergeProblem)}
              >
                Merge
              </Button>
              <Button
                mode="text"
                icon="delete-outline"
                textColor={theme.colors.error}
                onPress={confirmDeleteRecent}
                loading={recentBulkBusy}
                disabled={recentBulkBusy}
              >
                Delete
              </Button>
            </View>
            <Text
              variant="bodySmall"
              style={[
                styles.recentSelectionHint,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {recentMergeProblem ||
                'Tap more recent activities to add them to the selection.'}
            </Text>
          </Surface>
        ) : null}
        {recentEvents.map(event => {
          const active = isActiveEvent(event);
          return (
            <EventCard
              key={event.id}
              event={event}
              selectable={selectingRecent && !active}
              selected={Boolean(
                event.id && recentSelectedIds.includes(event.id),
              )}
              onLongPress={
                active ? undefined : () => toggleRecentSelected(event)
              }
              onPress={
                active
                  ? undefined
                  : selectingRecent
                    ? () => toggleRecentSelected(event)
                    : () => openRecentEventEditor(event)
              }
            />
          );
        })}
        {!eventsLoading && events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">Nothing logged yet</Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Use the buttons above to add the first care record.
            </Text>
          </View>
        ) : null}
        {eventsError ? (
          <View style={styles.errorState}>
            <Text style={{ color: theme.colors.error }}>{eventsError}</Text>
          </View>
        ) : null}
      </ScrollView>

      {focusedQuickCareDefinition ? (
        <ExpandedQuickCareView
          visible={Boolean(focusedQuickCareKey)}
          title={focusedQuickCareDefinition.title}
          icon={focusedQuickCareDefinition.icon}
          color={focusedQuickCareDefinition.color}
          onClose={closeFocusedQuickCare}
          hideHero={nursingTimerOwnsScreen || sleepPanelVisible || (logModalVisible && selectedAction === 'sleep')}
        >
          {renderExpandedCarePanel()}
        </ExpandedQuickCareView>
      ) : null}

      <EventEditModal
        visible={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={handleSaveEventEdit}
        onDelete={deleteEvent}
        allowDelete={editingEvent ? !isActiveEvent(editingEvent) : true}
      />
      <CareLogModal
        visible={Boolean(editingCareEvent && !focusedQuickCareKey)}
        type={
          editingCareEvent
            ? (editingCareEvent.type as AdditionalCareType)
            : null
        }
        event={editingCareEvent}
        onClose={() => {
          setCareLogType(null);
          setEditingCareEvent(null);
        }}
        onSave={handleSaveCareLog}
        onDelete={deleteEvent}
      />
      <HomeActionsModal
        visible={customizing}
        actions={draftHomeActions}
        saving={savingLayout}
        onChange={setDraftHomeActions}
        onClose={() => setCustomizing(false)}
        onSave={handleSaveLayout}
      />
      <QuickCareConfigModal
        visible={Boolean(configuringQuickCare)}
        careKey={configuringQuickCare}
        preference={
          configuringQuickCare
            ? quickCarePreferences[configuringQuickCare]
            : undefined
        }
        onClose={() => setConfiguringQuickCare(null)}
        onSave={handleSaveQuickCarePreference}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  eyebrow: {
    opacity: 0.7,
    marginBottom: 5,
    marginLeft: 2,
  },
  headerWrapped: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  // The baby pill gives way first: it can truncate its name, while the date
  // and the brightness control are fixed-width and would otherwise be pushed
  // off the right edge on a narrow phone.
  headerLeft: {
    flexShrink: 1,
    minWidth: 0,
  },
  // The date and the brightness control share the header's right column, so
  // neither competes with the Quick care row's title, Customise and mic.
  headerRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  datePill: {
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
  },
  dateIcon: {
    width: 34,
    height: 34,
    margin: 2,
  },
  dateText: {
    marginTop: -1,
    fontWeight: '700',
  },
  focusedActivityFooter: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  quickCareList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  actionsHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
  },
  actionsTitle: {
    flex: 1,
    fontWeight: '700',
  },
  customiseButton: {
    borderRadius: 20,
  },
  customiseButtonContent: {
    minHeight: 48,
  },
  customiseButtonLabel: {
    marginHorizontal: 12,
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
  recentSelectionBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingBottom: 10,
    borderRadius: 16,
  },
  recentSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  recentSelectionClose: {
    margin: 2,
  },
  recentSelectionCount: {
    flex: 1,
    fontWeight: '700',
  },
  recentSelectionHint: {
    paddingHorizontal: 14,
    marginTop: -4,
    lineHeight: 17,
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
