import { ActivityStyle, ActivityButton as Button, useCareScreenStyle } from '../../src/components/ActivityStyle';
import { NursingHeader } from '../../src/components/nursing/NursingChrome';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Icon,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBabies } from '../../src/providers/BabyProvider';
import { useEvents } from '../../src/providers/EventProvider';
import { eventColors } from '../../src/theme/eventColors';
import { careCardColors } from '../../src/theme/careColors';
import { useAppearance } from '../../src/providers/AppearanceProvider';
import VoiceInputCard from '../../src/components/VoiceInputCard';
import NursingQuickCareScreen from '../../src/components/nursing/NursingQuickCareScreen';
import CareLogModal, {
  type AdditionalCareType,
  type CareLogInput,
} from '../../src/components/CareLogModal';
import type { VoiceCommand } from '../../src/utils/voiceCommand';
import {
  homeCareActions,
  type HomeActionKey,
} from '../../src/constants/careActions';
import {
  ConfigurableQuickCareKey,
  sanitizeQuickCarePreferences,
} from '../../src/constants/quickCarePreferences';
import {
  breastDurationsForEvent,
  finishBreastTiming,
  formatNursingDuration,
  runningBreastSide,
} from '../../src/utils/breastFeed';
import {
  formatTimeSinceEvent,
} from '../../src/utils/feedTiming';

type QuickAction = HomeActionKey | 'voice';
type WidgetRouteAction = QuickAction | 'feed';

const isQuickAction = (value: unknown): value is WidgetRouteAction =>
  value === 'voice' ||
  value === 'feed' ||
  homeCareActions.some(action => action.type === value);

type PrimaryQuickAction = ConfigurableQuickCareKey;

const isPrimaryQuickAction = (
  action: QuickAction,
): action is PrimaryQuickAction =>
  action === 'nursing' ||
  action === 'bottle' ||
  action === 'sleep' ||
  action === 'diaper' ||
  action === 'pumping';

function QuickCareScreenContent() {
  const theme = useTheme();
  const chrome = useCareScreenStyle();
  const { mode } = useAppearance();
  const params = useLocalSearchParams<{
    action?: string | string[];
    choice?: string | string[];
  }>();
  const requestedAction = Array.isArray(params.action)
    ? params.action[0]
    : params.action;
  const action: QuickAction = isQuickAction(requestedAction)
    ? requestedAction === 'feed'
      ? 'nursing'
      : requestedAction
    : 'diaper';
  const requestedChoice = Array.isArray(params.choice)
    ? params.choice[0]
    : params.choice;
  const requestedNursingSide: 'left' | 'right' | undefined =
    requestedChoice === 'left' || requestedChoice === 'right'
      ? requestedChoice
      : undefined;
  const requestedNappyCondition: 'wet' | 'dirty' | 'both' | undefined =
    requestedChoice === 'wet' ||
    requestedChoice === 'dirty' ||
    requestedChoice === 'both'
      ? requestedChoice
      : undefined;
  const { selectedBaby, profile, loading: babiesLoading } = useBabies();
  const {
    events,
    activeFeed,
    activeSleep,
    activePumping,
    loading: eventsLoading,
    startFeed,
    stopFeed,
    switchFeed,
    startSleep,
    stopSleep,
    startPumping,
    stopPumping,
    editEvent,
    logFeed,
    logSleep,
    logDiaper,
    logCareEvent,
    deleteEvent,
    reopenEvent,
  } = useEvents();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [undoFeedOnly, setUndoFeedOnly] = useState(false);
  const [undo, setUndo] = useState<null | (() => Promise<void>)>(null);
  const preferences = sanitizeQuickCarePreferences(
    profile?.quickCarePreferences,
  );

  const lastNursing = useMemo(
    () =>
      events.find(
        event =>
          event.type === 'feed' && event.metadata?.feedType !== 'bottle',
      ),
    [events],
  );
  const lastBottle = useMemo(
    () =>
      events.find(
        event =>
          event.type === 'feed' && event.metadata?.feedType === 'bottle',
      ),
    [events],
  );
  const lastNappy = useMemo(
    () => events.find(event => event.type === 'diaper'),
    [events],
  );
  const lastPumping = useMemo(
    () => events.find(event => event.type === 'pumping'),
    [events],
  );
  const lastCompletedNursing = useMemo(
    () =>
      events.find(
        event =>
          event.type === 'feed' &&
          event.metadata?.feedType !== 'bottle' &&
          Boolean(event.endTime),
      ),
    [events],
  );

  const nursingPreference = preferences.nursing;
  const defaultNursingSide: 'left' | 'right' =
    requestedNursingSide || (nursingPreference?.mode === 'specific'
      ? nursingPreference.breastSide || 'left'
      : lastNursing?.metadata?.lastBreastSide === 'right' ||
          lastNursing?.metadata?.breastSide === 'right'
        ? 'right'
        : 'left');
  const bottlePreference = preferences.bottle;
  const defaultBottleAmount =
    bottlePreference?.mode === 'specific'
      ? bottlePreference.bottleAmount
      : lastBottle?.metadata?.amount;
  const defaultBottleUnit: 'ml' | 'oz' =
    bottlePreference?.mode === 'specific'
      ? bottlePreference.bottleUnit || 'ml'
      : lastBottle?.metadata?.unit === 'oz'
        ? 'oz'
        : 'ml';
  const sleepPreference = preferences.sleep;
  // Started from a widget or a shortcut, a sleep still records no location
  // unless one was pinned in Quick Care.
  const defaultSleepType =
    sleepPreference?.mode === 'specific'
      ? sleepPreference.sleepType
      : undefined;
  const diaperPreference = preferences.diaper;
  const defaultNappyCondition: 'wet' | 'dirty' | 'both' =
    requestedNappyCondition || (diaperPreference?.mode === 'specific'
      ? diaperPreference.diaperCondition || 'wet'
      : lastNappy?.metadata?.diaperCondition || 'wet');
  const pumpingPreference = preferences.pumping;
  const defaultPumpingSide: 'left' | 'right' | 'both' =
    pumpingPreference?.mode === 'specific'
      ? pumpingPreference.pumpingSide || 'both'
      : lastPumping?.metadata?.pumpingSide || 'both';

  const complete = (
    nextMessage: string,
    undoAction?: () => Promise<void>,
  ) => {
    const sleepStopped = nextMessage.startsWith('Sleep saved.');
    setUndoFeedOnly(sleepStopped);
    if (sleepStopped) {
      Alert.alert('Sleep saved automatically', nextMessage + '. The sleep timer has stopped.');
    }
    setUndo(undoAction ? () => undoAction : null);
    setMessage(nextMessage);
  };

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to update care.',
      );
      setUndo(null);
    } finally {
      setBusy(false);
    }
  };

  const handleNursing = () =>
    run(async () => {
      if (activeFeed?.id) {
        if (activeFeed.metadata?.feedType === 'bottle') {
          await switchFeed({
            feedType: 'breast',
            breastSide: defaultNursingSide,
          });
          complete(`Switched to ${defaultNursingSide} nursing`);
          return;
        }
        const eventId = activeFeed.id;
        await stopFeed();
        complete('Nursing stopped', () => reopenEvent(eventId));
        return;
      }
      const eventId = await startFeed({
        feedType: 'breast',
        breastSide: defaultNursingSide,
      });
      complete(`${activeSleep ? 'Sleep saved. ' : ''}Nursing started on the ${defaultNursingSide}`, () =>
        deleteEvent(eventId),
      );
    });

  const handleNursingSide = (side: 'left' | 'right') =>
    run(async () => {
      if (activeFeed?.id) {
        if (activeFeed.metadata?.feedType === 'bottle') {
          await switchFeed({ feedType: 'breast', breastSide: side });
          complete(`Switched to ${side} nursing`);
          return;
        }

        const currentSide = runningBreastSide(activeFeed.metadata);
        if (currentSide === side) {
          await editEvent(activeFeed.id, {
            metadata: finishBreastTiming(activeFeed.metadata, Date.now()),
          });
          complete(`${side === 'left' ? 'Left' : 'Right'} side paused`);
          return;
        }

        await switchFeed({ feedType: 'breast', breastSide: side });
        complete(`${currentSide ? 'Switched' : 'Resumed'} on the ${side}`);
        return;
      }
      const eventId = await startFeed({ feedType: 'breast', breastSide: side });
      complete(`${activeSleep ? 'Sleep saved. ' : ''}Nursing started on the ${side}`, () => deleteEvent(eventId));
    });

  const handleBottle = () =>
    run(async () => {
      if (activeFeed?.id) {
        if (activeFeed.metadata?.feedType !== 'bottle') {
          await switchFeed({ feedType: 'bottle' });
          complete('Switched to a bottle feed');
          return;
        }
        const eventId = activeFeed.id;
        await stopFeed();
        complete('Bottle feed stopped', () => reopenEvent(eventId));
        return;
      }
      if (defaultBottleAmount && defaultBottleAmount > 0) {
        const eventId = await logFeed({
          feedType: 'bottle',
          amount: defaultBottleAmount,
          unit: defaultBottleUnit,
        });
        complete(
          `${activeSleep ? 'Sleep saved. ' : ''}${defaultBottleAmount} ${defaultBottleUnit} bottle logged`,
          () => deleteEvent(eventId),
        );
        return;
      }
      const eventId = await startFeed({ feedType: 'bottle' });
      complete(`${activeSleep ? 'Sleep saved. ' : ''}Bottle timer started`, () => deleteEvent(eventId));
    });

  const handleSleep = () =>
    run(async () => {
      if (activeSleep?.id) {
        const eventId = activeSleep.id;
        await stopSleep();
        complete('Sleep stopped', () => reopenEvent(eventId));
        return;
      }
      if (activeFeed) {
        throw new Error('Stop the feed timer before starting sleep.');
      }
      const eventId = await startSleep(defaultSleepType);
      complete('Sleep timer started', () => deleteEvent(eventId));
    });

  const handleNappy = (condition: 'wet' | 'dirty' | 'both') =>
    run(async () => {
      const eventId = await logDiaper(condition);
      const label =
        condition === 'both'
          ? 'Wet and dirty'
          : condition === 'wet'
            ? 'Wet'
            : 'Dirty';
      complete(`${label} nappy logged`, () => deleteEvent(eventId));
    });

  const handlePumping = () =>
    run(async () => {
      if (activePumping?.id) {
        const eventId = activePumping.id;
        await stopPumping();
        complete('Pumping stopped', () => reopenEvent(eventId));
        return;
      }
      const eventId = await startPumping(defaultPumpingSide);
      complete(`Pumping started on ${defaultPumpingSide}`, () =>
        deleteEvent(eventId),
      );
    });

  const handleAdditionalCare = async (input: CareLogInput) => {
    await logCareEvent(input);
  };

  const handleVoiceCommand = async (command: VoiceCommand) => {
    if (command.kind === 'start-feed') {
      const eventId = await startFeed({ feedType: command.feedType });
      complete('Feed timer started', () => deleteEvent(eventId));
      return;
    }
    if (command.kind === 'log-feed') {
      const eventId = await logFeed({
        feedType: command.feedType,
        amount: command.amount,
        unit: command.unit,
        durationMinutes: command.durationMinutes,
      });
      complete('Feed logged', () => deleteEvent(eventId));
      return;
    }
    if (command.kind === 'stop-feed') {
      if (!activeFeed?.id) throw new Error('There is no feed timer to stop.');
      const eventId = activeFeed.id;
      await stopFeed();
      complete('Feed stopped', () => reopenEvent(eventId));
      return;
    }
    if (command.kind === 'start-sleep') {
      const eventId = await startSleep(command.sleepType);
      complete('Sleep timer started', () => deleteEvent(eventId));
      return;
    }
    if (command.kind === 'log-sleep') {
      const eventId = await logSleep(
        command.durationMinutes,
        undefined,
        command.sleepType,
      );
      complete('Sleep logged', () => deleteEvent(eventId));
      return;
    }
    if (command.kind === 'stop-sleep') {
      if (!activeSleep?.id) throw new Error('There is no sleep timer to stop.');
      const eventId = activeSleep.id;
      await stopSleep();
      complete('Sleep stopped', () => reopenEvent(eventId));
      return;
    }
    const eventId = await logDiaper(command.condition);
    complete('Nappy logged', () => deleteEvent(eventId));
  };

  const handleUndo = () => {
    if (!undo) return;
    void run(async () => {
      await undo();
      setUndo(null);
      setMessage(undoFeedOnly ? 'Feed undone. The saved sleep is unchanged.' : 'Action undone');
    });
  };

  if (babiesLoading || eventsLoading) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium">Getting the latest care details...</Text>
      </SafeAreaView>
    );
  }

  if (!selectedBaby) {
    return <Redirect href="/(app)/onboarding" />;
  }

  if (action !== 'voice' && !isPrimaryQuickAction(action)) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.topBar}>
          <Button icon="close" onPress={() => router.replace('/(app)/(tabs)')}>
            Home
          </Button>
          <Text variant="labelLarge">Quick care</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <CareLogModal
          visible
          type={action as AdditionalCareType}
          onClose={() => router.replace('/(app)/(tabs)')}
          onSave={handleAdditionalCare}
        />
      </SafeAreaView>
    );
  }

  if (action === 'voice') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.topBar}>
          <Button icon="close" onPress={() => router.replace('/(app)/(tabs)')}>
            Home
          </Button>
          <Text variant="labelLarge">Voice care</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.voiceContent}>
          <Text variant="headlineSmall" style={styles.voiceTitle}>
            Tell me what happened
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.voiceHelp,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Try "wet nappy", "start a feed", "120 ml bottle", or "slept for
            45 minutes".
          </Text>
          <VoiceInputCard onCommand={handleVoiceCommand} autoStart />
        </View>
        <Snackbar
          visible={Boolean(message)}
          onDismiss={() => {
            setMessage('');
            setUndo(null);
          }}
          duration={5000}
          action={undo ? { label: undoFeedOnly ? 'Undo feed' : 'Undo', onPress: handleUndo } : undefined}
        >
          {message}
        </Snackbar>
      </SafeAreaView>
    );
  }

  const activeNursing = Boolean(
    activeFeed && activeFeed.metadata?.feedType !== 'bottle',
  );
  const activeBottle = activeFeed?.metadata?.feedType === 'bottle';
  const nursingPaused = activeNursing && !runningBreastSide(activeFeed?.metadata);
  const activeNursingSide = activeNursing
    ? runningBreastSide(activeFeed?.metadata)
    : null;
  const nursingSideLabel = (side: 'left' | 'right') => {
    if (activeBottle) return `Switch to ${side}`;
    if (!activeNursing) return `Start ${side}`;
    if (activeNursingSide === side) return `Pause ${side}`;
    return `${nursingPaused ? 'Resume' : 'Switch to'} ${side}`;
  };
  const previousNursingSide: 'left' | 'right' | undefined =
    lastCompletedNursing?.metadata?.lastBreastSide ||
    (lastCompletedNursing?.metadata?.breastSide === 'left' ||
    lastCompletedNursing?.metadata?.breastSide === 'right'
      ? lastCompletedNursing.metadata.breastSide
      : undefined);
  const previousNursingSummary = (() => {
    if (!lastCompletedNursing) return '';
    // Feeds are spaced start-to-start, so the gap runs from the feed's start.
    const since = formatTimeSinceEvent(lastCompletedNursing, new Date(), {
      fromStart: true,
    });
    const durations = breastDurationsForEvent(lastCompletedNursing);
    return `Last feed started ${
      since === 'Just now' ? 'just now' : `${since} ago`
    } · L ${formatNursingDuration(
      durations.leftBreastDurationSeconds,
    )} · R ${formatNursingDuration(durations.rightBreastDurationSeconds)}`;
  })();
  const pumpingLabel =
    defaultPumpingSide === 'both' ? 'both sides' : `the ${defaultPumpingSide}`;
  const config = {
    nursing: {
      title: requestedNursingSide
        ? activeBottle
          ? `Switch to ${requestedNursingSide}?`
          : activeNursingSide === requestedNursingSide
            ? `Pause ${requestedNursingSide}?`
            : activeNursing
              ? `${nursingPaused ? 'Resume' : 'Switch'} on ${requestedNursingSide}?`
              : `Start ${requestedNursingSide}?`
        : activeNursing
        ? nursingPaused
          ? 'Resume nursing?'
          : 'Nursing controls'
        : activeBottle
          ? 'Switch to nursing?'
          : 'Start nursing?',
      detail: requestedNursingSide
        ? `Use the ${requestedNursingSide} side for ${selectedBaby.name}.`
        : activeNursing
        ? nursingPaused
          ? `Choose left or right to resume nursing for ${selectedBaby.name}.`
          : `Nursing is running on the ${activeNursingSide} for ${selectedBaby.name}.`
        : activeBottle
          ? 'Choose which side to continue this feed as nursing.'
          : `Choose left or right for ${selectedBaby.name}.`,
      icon:
        requestedNursingSide && activeNursingSide === requestedNursingSide
          ? 'pause-circle-outline'
          : 'mother-nurse',
      color: eventColors.feed,
      button: requestedNursingSide
        ? activeNursingSide === requestedNursingSide
          ? `Pause ${requestedNursingSide}`
          : `${activeNursing ? nursingPaused ? 'Resume' : 'Switch' : 'Start'} ${requestedNursingSide}`
        : activeNursing
        ? 'Stop nursing'
        : activeBottle
          ? 'Switch to nursing'
          : `Start ${defaultNursingSide}`,
      onPress: requestedNursingSide
        ? () => handleNursingSide(requestedNursingSide)
        : handleNursing,
    },
    bottle: {
      title: activeBottle
        ? 'Stop bottle?'
        : activeNursing
          ? 'Switch to bottle?'
          : defaultBottleAmount
            ? 'Log another bottle?'
            : 'Start bottle?',
      detail: activeBottle
        ? `A bottle timer is running for ${selectedBaby.name}.`
        : activeNursing
          ? 'Finish nursing and continue this feed as a bottle.'
          : defaultBottleAmount
            ? `Log ${defaultBottleAmount} ${defaultBottleUnit} for ${selectedBaby.name}.`
            : `Start a bottle timer for ${selectedBaby.name}.`,
      icon: activeBottle ? 'stop-circle-outline' : 'baby-bottle-outline',
      color: eventColors.feed,
      button: activeBottle
        ? 'Stop bottle'
        : activeNursing
          ? 'Switch to bottle'
          : defaultBottleAmount
            ? `Log ${defaultBottleAmount} ${defaultBottleUnit}`
            : 'Start bottle',
      onPress: handleBottle,
    },
    sleep: {
      title: activeSleep ? 'Stop sleep?' : 'Start sleep?',
      detail: activeSleep
        ? `A sleep timer is running for ${selectedBaby.name}.`
        : `Start a sleep timer for ${selectedBaby.name}.`,
      icon: activeSleep ? 'stop-circle-outline' : 'sleep',
      color: eventColors.sleep,
      button: activeSleep ? 'Stop sleep' : 'Play',
      onPress: handleSleep,
    },
    diaper: {
      title: 'Log a nappy',
      detail: `What kind of nappy did ${selectedBaby.name} have?`,
      icon: 'human-baby-changing-table',
      color: eventColors.diaper,
      button: '',
      onPress: () => undefined,
    },
    pumping: {
      title: activePumping ? 'Stop pumping?' : 'Start pumping?',
      detail: activePumping
        ? 'A pumping timer is running.'
        : `Start pumping on ${pumpingLabel}.`,
      icon: activePumping ? 'stop-circle-outline' : 'water-outline',
      color: eventColors.pumping,
      button: activePumping ? 'Stop pumping' : 'Start pumping',
      onPress: handlePumping,
    },
  }[action];

  const nappyActionOptions: Array<{
    condition: 'wet' | 'dirty' | 'both';
    label: string;
  }> = [
    { condition: 'wet', label: 'Wet' },
    { condition: 'both', label: 'Both' },
    { condition: 'dirty', label: 'Dirty' },
  ];
  const nappyActions = nappyActionOptions.sort((left, right) =>
    left.condition === defaultNappyCondition
      ? -1
      : right.condition === defaultNappyCondition
        ? 1
        : 0,
  );

  // The card recolours with the appearance mode exactly as the Quick Care
  // card on Home does, so the tap that opened this screen lands on the same
  // pastel in daylight and the same dimmed surface at 3am.
  const cardColors = careCardColors(config.color, mode);

  const goHome = () => router.replace('/(app)/(tabs)');

  if (action === 'nursing') {
    return (
      <>
        <NursingQuickCareScreen
          title={config.title}
          detail={config.detail}
          previousSummary={previousNursingSummary || undefined}
          sides={
            requestedNursingSide
              ? undefined
              : {
                  activeSide: activeNursingSide,
                  lastSide: previousNursingSide,
                  label: nursingSideLabel,
                  onPress: handleNursingSide,
                }
          }
          primaryLabel={config.button}
          onPrimary={config.onPress}
          onFinish={
            activeNursing && !requestedNursingSide ? handleNursing : undefined
          }
          onCancel={goHome}
          busy={busy}
        />
        <Snackbar
          visible={Boolean(message)}
          onDismiss={() => {
            setMessage('');
            setUndo(null);
          }}
          duration={5000}
          action={undo ? { label: undoFeedOnly ? 'Undo feed' : 'Undo', onPress: handleUndo } : undefined}
        >
          {message}
        </Snackbar>
      </>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {chrome ? <NursingHeader chrome={chrome} title={config.title} icon={config.icon}
        onBack={goHome} backLabel="Home" eyebrow="QUICK CARE" bleedPagePadding={false} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Surface
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level2 },
          ]}
          elevation={2}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: cardColors.background }]}
          >
            <Icon source={config.icon} size={46} color={cardColors.foreground} />
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            {config.title}
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.detail, { color: theme.colors.onSurfaceVariant }]}
          >
            {config.detail}
          </Text>

          {action === 'diaper' ? (
            <View style={styles.nappyActions}>
              {nappyActions.map(item => (
                <Button
                  key={item.condition}
                  mode={
                    item.condition === defaultNappyCondition
                      ? 'contained'
                      : 'outlined'
                  }
                  onPress={() => handleNappy(item.condition)}
                  disabled={busy}
                >
                  {item.label}
                </Button>
              ))}
            </View>
          ) : (
            <Button
              mode="contained"
              icon={config.icon}
              style={styles.cardButton}
              contentStyle={styles.primaryButton}
              onPress={config.onPress}
              loading={busy}
              disabled={busy}
            >
              {config.button}
            </Button>
          )}
        </Surface>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="text"
          contentStyle={styles.footerButton}
          onPress={goHome}
          disabled={busy}
        >
          Cancel
        </Button>
      </View>

      <Snackbar
        visible={Boolean(message)}
        onDismiss={() => {
          setMessage('');
          setUndo(null);
        }}
        duration={5000}
        action={undo ? { label: undoFeedOnly ? 'Undo feed' : 'Undo', onPress: handleUndo } : undefined}
      >
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

export default function QuickCareScreen() {
  const params = useLocalSearchParams<{ action?: string | string[] }>();
  const action = Array.isArray(params.action) ? params.action[0] : params.action;
  const key = action === 'nursing' || action === 'bottle' ? 'feed' : action;
  const color = key && key in eventColors ? eventColors[key as keyof typeof eventColors] : eventColors.diaper;
  return <ActivityStyle color={color}><QuickCareScreenContent /></ActivityStyle>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSpacer: { width: 72 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 20,
    width: '100%',
  },
  footer: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  footerButton: { minHeight: 48 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', textAlign: 'center' },
  detail: { textAlign: 'center', lineHeight: 25 },
  cardButton: { width: '100%' },
  primaryButton: { minHeight: 52, minWidth: 190 },
  nappyActions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  voiceContent: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  voiceTitle: {
    paddingHorizontal: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  voiceHelp: {
    paddingHorizontal: 28,
    marginTop: 8,
    marginBottom: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
