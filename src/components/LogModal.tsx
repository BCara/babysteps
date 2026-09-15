import { ActivityActions } from './ActivityStyle';
import { ActivityTextInput as TextInput, ActivitySegments as SegmentedButtons, ActivityButton as Button } from './ActivityStyle';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Text,
  Surface,
  Icon,
  IconButton,
  useTheme,
} from 'react-native-paper';
import { useCarePalette } from '../hooks/useCarePalette';
import { BabyEvent, type DiaperAmount } from '../services/firebase/events';
import {
  NursingDurationField,
  nursingDurationInputsFromSeconds,
  parseManualNursing,
  updateNursingDurationInputs,
} from '../utils/manualNursing';
import {
  adjustBreastTimingForStartChange,
  breastDurationsAt,
} from '../utils/breastFeed';
import EventTimeEditor from './EventTimeEditor';
import ContextualVoiceButton from './ContextualVoiceButton';
import type { VoiceEntryValues } from '../utils/voiceCommand';
import {
  optionalSleepLocation,
  sleepLocationFor,
  type CustomSleepLocation,
  type SleepType,
} from '../utils/sleepLocation';
import { resolveManualEntryStartTime } from '../utils/eventEditing';
import {
  checkSleepEntry,
  sleepMinutesBetween,
  updateSleepEntry,
  type SleepTimeField,
} from '../utils/sleepEntry';
import DiaperAmountFields from './DiaperAmountFields';
import NursingLogScreen from './nursing/NursingLogScreen';
import SleepLogScreen from './sleep/SleepLogScreen';
import {
  diaperAmountMetadata,
  diaperAmountValues,
  formatDiaperAmountDetail,
} from '../utils/diaperAmounts';

export type QuickLogInput =
  | {
      type: 'feed';
      feedType: 'breast' | 'bottle';
      breastSide?: 'left' | 'right' | 'both';
      breastSidesUsed?: Array<'left' | 'right'>;
      lastBreastSide?: 'left' | 'right';
      leftBreastDurationSeconds?: number;
      rightBreastDurationSeconds?: number;
      amount?: number;
      unit?: 'ml' | 'oz';
      durationMinutes?: number;
      startTime?: Date;
      notes?: string;
      eventId?: string;
    }
  | {
      type: 'diaper';
      condition: 'wet' | 'dirty' | 'both';
      diaperAmount?: DiaperAmount;
      wetDiaperAmount?: DiaperAmount;
      dirtyDiaperAmount?: DiaperAmount;
      startTime?: Date;
      notes?: string;
      eventId?: string;
    }
  | {
      type: 'sleep';
      sleepType?: SleepType;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      notes?: string;
      eventId?: string;
    };

interface LogModalProps {
  visible: boolean;
  type: 'feed' | 'sleep' | 'diaper' | null;
  onClose: () => void;
  onSave: (data: QuickLogInput) => Promise<void>;
  activeFeed?: BabyEvent | null;
  activeSleep?: BabyEvent | null;
  onStopActiveFeed: () => Promise<void>;
  onStopActiveSleep: () => Promise<void>;
  defaultFeedType?: 'breast' | 'bottle';
  defaultBottleUnit?: 'ml' | 'oz';
  showCloseButton?: boolean;
  previousDiaper?: BabyEvent | null;
  initialStartTime?: Date;
  customSleepLocations?: CustomSleepLocation[];
  onAddSleepLocation?: (label: string) => Promise<void>;
}

export default function LogModal({
  visible,
  type,
  onClose,
  onSave,
  activeFeed,
  activeSleep,
  onStopActiveFeed,
  onStopActiveSleep,
  defaultFeedType = 'breast',
  defaultBottleUnit = 'ml',
  showCloseButton = true,
  previousDiaper,
  initialStartTime,
  customSleepLocations = [],
  onAddSleepLocation = async () => undefined,
}: LogModalProps) {
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState(() => new Date());
  const sleepEditOrder = useRef<SleepTimeField[]>([]);
  const [sleepEndTime, setSleepEndTime] = useState(() => new Date());
  const [leftNursingMinutes, setLeftNursingMinutes] = useState('');
  const [rightNursingMinutes, setRightNursingMinutes] = useState('');
  const [amount, setAmount] = useState('');
  const [lastBreastSide, setLastBreastSide] = useState<'left' | 'right'>('left');
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  const [condition, setCondition] = useState<'wet' | 'dirty' | 'both'>('wet');
  const [diaperAmount, setDiaperAmount] = useState<DiaperAmount>();
  const [wetDiaperAmount, setWetDiaperAmount] =
    useState<DiaperAmount>();
  const [dirtyDiaperAmount, setDirtyDiaperAmount] =
    useState<DiaperAmount>();
  const [sleepType, setSleepType] = useState<SleepType | undefined>();
  const [saving, setSaving] = useState(false);
  const [nursingDurationsEdited, setNursingDurationsEdited] = useState(false);
  const [existingEventId, setExistingEventId] = useState<string>();
  const [error, setError] = useState('');
  const [previousNotes, setPreviousNotes] = useState('');
  const [previousAmount, setPreviousAmount] =
    useState<DiaperAmount>();
  const [previousWetAmount, setPreviousWetAmount] =
    useState<DiaperAmount>();
  const [previousDirtyAmount, setPreviousDirtyAmount] =
    useState<DiaperAmount>();
  const [previousSaving, setPreviousSaving] = useState(false);
  const [previousStatus, setPreviousStatus] = useState('');
  const [previousExpanded, setPreviousExpanded] = useState(false);
  const nursingEditOrderRef = useRef<NursingDurationField[]>([]);
  const initializedFormRef = useRef<string | null>(null);
  const theme = useTheme();
  const { colors: eventColors, careInk } = useCarePalette();
  const feedType = defaultFeedType;

  useEffect(() => {
    if (!visible) {
      initializedFormRef.current = null;
      return;
    }

    const formKey = `${type || 'none'}:${feedType}:${initialStartTime?.getTime() ?? 'now'}`;
    if (initializedFormRef.current === formKey) return;
    initializedFormRef.current = formKey;

    if (visible) {
      const activeFeedType = activeFeed?.metadata?.feedType || 'breast';
      const matchingActiveFeed =
        type === 'feed' && activeFeed && activeFeedType === feedType
          ? activeFeed
          : null;
      const sleepAnchor = type === 'sleep' ? activeSleep?.startTime : undefined;
      setNotes('');
      setDuration('');
      setStartTime(
        resolveManualEntryStartTime(
          initialStartTime,
          matchingActiveFeed?.startTime || sleepAnchor,
        ),
      );
      // A manual sleep is nearly always one that has just ended, so the end
      // time starts at "now" and the start time is what gets adjusted.
      sleepEditOrder.current = initialStartTime ? ['start'] : [];
      setSleepEndTime(new Date());
      setLeftNursingMinutes('');
      setRightNursingMinutes('');
      nursingEditOrderRef.current = [];
      setAmount('');
      setUnit(defaultBottleUnit);
      setCondition('wet');
      setDiaperAmount(undefined);
      setWetDiaperAmount(undefined);
      setDirtyDiaperAmount(undefined);
      setNursingDurationsEdited(false);
      setExistingEventId(undefined);
      setError('');
      if (matchingActiveFeed) {
        setLastBreastSide(
          matchingActiveFeed.metadata?.lastBreastSide ||
            (matchingActiveFeed.metadata?.breastSide === 'right'
              ? 'right'
              : 'left'),
        );
        setAmount(matchingActiveFeed.metadata?.amount?.toString() || '');
        setUnit(matchingActiveFeed.metadata?.unit || 'ml');
        const tracked = breastDurationsAt(
          matchingActiveFeed.metadata,
          Date.now(),
        );
        const leftSeconds = tracked.leftBreastDurationSeconds;
        const rightSeconds = tracked.rightBreastDurationSeconds;
        const trackedInputs = nursingDurationInputsFromSeconds(
          leftSeconds,
          rightSeconds,
        );
        setLeftNursingMinutes(trackedInputs.left);
        setRightNursingMinutes(trackedInputs.right);
        setDuration(trackedInputs.total);
        if (leftSeconds > 0 && rightSeconds > 0) {
          nursingEditOrderRef.current =
            matchingActiveFeed.metadata?.lastBreastSide === 'left'
              ? ['right', 'left']
              : ['left', 'right'];
        } else if (leftSeconds > 0) {
          nursingEditOrderRef.current = ['left'];
        } else if (rightSeconds > 0) {
          nursingEditOrderRef.current = ['right'];
        }
      } else if (type === 'feed') {
        setLastBreastSide('left');
      }
      if (type === 'sleep' && activeSleep) {
        setSleepType(optionalSleepLocation(activeSleep.metadata?.sleepType));
        const trackedMinutes = sleepMinutesBetween(
          initialStartTime || activeSleep.startTime,
          new Date(),
        );
        if (trackedMinutes > 0) setDuration(String(trackedMinutes));
      }
    }
  }, [
    activeFeed,
    activeSleep,
    defaultBottleUnit,
    defaultFeedType,
    feedType,
    initialStartTime,
    type,
    visible,
  ]);

  useEffect(() => {
    if (!visible || type !== 'diaper' || previousDiaper?.type !== 'diaper') {
      return;
    }

    const amounts = diaperAmountValues(previousDiaper.metadata);
    setPreviousNotes(previousDiaper.notes || '');
    setPreviousAmount(amounts.amount);
    setPreviousWetAmount(amounts.wetAmount);
    setPreviousDirtyAmount(amounts.dirtyAmount);
    setPreviousStatus('');
    setPreviousExpanded(false);
  }, [
    previousDiaper?.id,
    previousDiaper?.metadata?.diaperAmount,
    previousDiaper?.metadata?.dirtyDiaperAmount,
    previousDiaper?.metadata?.wetDiaperAmount,
    previousDiaper?.notes,
    previousDiaper?.type,
    type,
    visible,
  ]);

  if (!type) return null;
  const color = eventColors[type as keyof typeof eventColors] || theme.colors.primary;
  const manualNursingPreview = parseManualNursing({
    leftMinutes: leftNursingMinutes,
    rightMinutes: rightNursingMinutes,
    lastBreastSide,
  });
  const updateNursingMinutes = (
    field: NursingDurationField,
    value: string,
  ) => {
    const result = updateNursingDurationInputs(
      {
        total: duration,
        left: leftNursingMinutes,
        right: rightNursingMinutes,
      },
      field,
      value,
      nursingEditOrderRef.current,
    );
    nursingEditOrderRef.current = result.editOrder;
    setNursingDurationsEdited(true);
    setDuration(result.values.total);
    setLeftNursingMinutes(result.values.left);
    setRightNursingMinutes(result.values.right);
    if (field !== 'total' && Number(value) > 0) setLastBreastSide(field);
    setError('');
  };

  const formatVoiceNumber = (value: number) =>
    Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

  const changeDiaperCondition = (next: 'wet' | 'dirty' | 'both') => {
    if (next === 'both' && condition !== 'both') {
      setWetDiaperAmount(diaperAmount);
      setDirtyDiaperAmount(diaperAmount);
    } else if (condition === 'both' && next !== 'both') {
      setDiaperAmount(next === 'wet' ? wetDiaperAmount : dirtyDiaperAmount);
    }
    setCondition(next);
  };

  // The three sleep fields stay in step: editing one recalculates whichever of
  // the others it implies, so what is saved always matches what is on screen.
  const changeSleepTime = (field: SleepTimeField, value: Date | string) => {
    const next = updateSleepEntry(
      { startTime, endTime: sleepEndTime, duration },
      sleepEditOrder.current,
      field,
      value,
    );
    sleepEditOrder.current = next.order;
    setStartTime(next.startTime);
    setSleepEndTime(next.endTime);
    setDuration(next.duration);
    setError('');
  };
  const handleSleepStartChange = (value: Date) => changeSleepTime('start', value);
  const handleSleepEndChange = (value: Date) => changeSleepTime('end', value);
  const handleSleepDurationChange = (value: string) => changeSleepTime('duration', value);

  const handleVoiceFill = (values: VoiceEntryValues) => {
    if (type === 'feed' && feedType === 'breast') {
      if (values.leftMinutes !== undefined || values.rightMinutes !== undefined) {
        const left = values.leftMinutes || 0;
        const right = values.rightMinutes || 0;
        setLeftNursingMinutes(left > 0 ? formatVoiceNumber(left) : '');
        setRightNursingMinutes(right > 0 ? formatVoiceNumber(right) : '');
        setDuration(formatVoiceNumber(left + right));
        nursingEditOrderRef.current = [
          ...(left > 0 ? (['left'] as const) : []),
          ...(right > 0 ? (['right'] as const) : []),
        ];
        setLastBreastSide(right > 0 ? 'right' : 'left');
        setNursingDurationsEdited(true);
      } else if (values.durationMinutes !== undefined) {
        updateNursingMinutes('total', formatVoiceNumber(values.durationMinutes));
      }
    } else {
      if (values.durationMinutes !== undefined) {
        const spokenDuration = formatVoiceNumber(values.durationMinutes);
        // Sleep keeps its start time tied to the duration it was given.
        if (type === 'sleep') handleSleepDurationChange(spokenDuration);
        else setDuration(spokenDuration);
      }
      if (values.amount !== undefined) setAmount(formatVoiceNumber(values.amount));
      if (values.unit) setUnit(values.unit);
      const nextCondition = values.condition || condition;
      if (values.condition) changeDiaperCondition(values.condition);
      if (values.diaperAmount) {
        if (nextCondition === 'both') {
          setWetDiaperAmount(values.diaperAmount);
          setDirtyDiaperAmount(values.diaperAmount);
        } else {
          setDiaperAmount(values.diaperAmount);
        }
      }
      if (values.wetDiaperAmount) {
        setWetDiaperAmount(values.wetDiaperAmount);
      }
      if (values.dirtyDiaperAmount) {
        setDirtyDiaperAmount(values.dirtyDiaperAmount);
      }
      if (values.sleepType) setSleepType(sleepLocationFor(values.sleepType));
    }
    setError('');
  };

  const parsePositive = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const activeTimer =
    type === 'feed'
      ? (activeFeed?.metadata?.feedType || 'breast') === feedType
        ? activeFeed
        : null
      : type === 'sleep'
        ? activeSleep
        : null;
  const timerNeedsStopping =
    Boolean(activeTimer?.id) && existingEventId !== activeTimer?.id;

  const handleNursingStartTimeChange = (nextStartTime: Date) => {
    const nowMs = Date.now();
    if (nextStartTime.getTime() > nowMs) {
      setError('Choose a start time that is not in the future.');
      return;
    }

    setStartTime(nextStartTime);
    setError('');
    if (type !== 'feed' || feedType !== 'breast' || !activeTimer) return;

    const adjustedTiming = adjustBreastTimingForStartChange(
      activeTimer.metadata,
      activeTimer.startTime.getTime(),
      nextStartTime.getTime(),
      nowMs,
    );
    const adjustedDurations = breastDurationsAt(adjustedTiming, nowMs);
    const adjustedInputs = nursingDurationInputsFromSeconds(
      adjustedDurations.leftBreastDurationSeconds,
      adjustedDurations.rightBreastDurationSeconds,
    );

    setDuration(adjustedInputs.total);
    setLeftNursingMinutes(adjustedInputs.left);
    setRightNursingMinutes(adjustedInputs.right);
    setNursingDurationsEdited(false);
    if (adjustedInputs.left && adjustedInputs.right) {
      nursingEditOrderRef.current =
        activeTimer.metadata?.lastBreastSide === 'left'
          ? ['right', 'left']
          : ['left', 'right'];
    } else if (adjustedInputs.left) {
      nursingEditOrderRef.current = ['left'];
    } else if (adjustedInputs.right) {
      nursingEditOrderRef.current = ['right'];
    } else {
      nursingEditOrderRef.current = [];
    }
  };

  const handleSave = async () => {
    const parsedDuration = parsePositive(duration);
    const parsedAmount = parsePositive(amount);
    let nursingDetails =
      type === 'feed' && feedType === 'breast'
        ? manualNursingPreview
        : null;

    if (
      type === 'feed' &&
      feedType === 'breast' &&
      activeTimer &&
      !nursingDurationsEdited
    ) {
      const nowMs = Date.now();
      const timing = adjustBreastTimingForStartChange(
        activeTimer.metadata,
        activeTimer.startTime.getTime(),
        startTime.getTime(),
        nowMs,
      );
      const liveDurations = breastDurationsAt(timing, nowMs);
      nursingDetails = parseManualNursing({
        leftMinutes:
          liveDurations.leftBreastDurationSeconds > 0
            ? String(liveDurations.leftBreastDurationSeconds / 60)
            : '',
        rightMinutes:
          liveDurations.rightBreastDurationSeconds > 0
            ? String(liveDurations.rightBreastDurationSeconds / 60)
            : '',
        lastBreastSide:
          activeTimer.metadata?.lastBreastSide || lastBreastSide,
      });
    }
    // Sleep validates its start time, end time and duration together below.
    const sleepEntry =
      type === 'sleep'
        ? checkSleepEntry({ startTime, endTime: sleepEndTime, durationInput: duration })
        : null;

    if (
      parsedAmount === null ||
      (parsedDuration === null &&
        type !== 'sleep' &&
        !(type === 'feed' && feedType === 'breast'))
    ) {
      setError('Enter a valid positive number.');
      return;
    }
    if (type === 'feed' && startTime.getTime() > Date.now()) {
      setError('Choose a start time that is not in the future.');
      return;
    }
    if (type === 'diaper' && startTime.getTime() > Date.now()) {
      setError('Choose a nappy time that is not in the future.');
      return;
    }
    if (sleepEntry?.error) {
      setError(sleepEntry.error);
      return;
    }
    if (
      type === 'feed' &&
      feedType === 'breast' &&
      parsedDuration === undefined
    ) {
      setError('Enter the total nursing duration.');
      return;
    }
    if (
      type === 'feed' &&
      feedType === 'breast' &&
      !nursingDetails
    ) {
      setError('Add minutes for the left side, right side, or both.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let eventIdToSave = existingEventId;
      if (timerNeedsStopping && activeTimer?.id) {
        if (type === 'feed') {
          await onStopActiveFeed();
        } else if (type === 'sleep') {
          await onStopActiveSleep();
        }
        setExistingEventId(activeTimer.id);
        eventIdToSave = activeTimer.id;
      }

      if (type === 'feed') {
        await onSave({
          type,
          feedType,
          breastSide:
            feedType === 'breast' ? nursingDetails?.breastSide : undefined,
          breastSidesUsed:
            feedType === 'breast' ? nursingDetails?.breastSidesUsed : undefined,
          lastBreastSide:
            feedType === 'breast' ? nursingDetails?.lastBreastSide : undefined,
          leftBreastDurationSeconds:
            feedType === 'breast'
              ? nursingDetails?.leftBreastDurationSeconds
              : undefined,
          rightBreastDurationSeconds:
            feedType === 'breast'
              ? nursingDetails?.rightBreastDurationSeconds
              : undefined,
          amount: feedType === 'bottle' ? parsedAmount : undefined,
          unit: feedType === 'bottle' ? unit : undefined,
          durationMinutes:
            feedType === 'breast'
              ? nursingDetails?.durationMinutes
              : parsedDuration ?? undefined,
          startTime: feedType === 'breast' ? startTime : undefined,
          notes,
          eventId: eventIdToSave,
        });
      } else if (type === 'diaper') {
        const amounts = diaperAmountMetadata(
          condition,
          diaperAmount,
          wetDiaperAmount,
          dirtyDiaperAmount,
        );
        await onSave({
          type,
          condition,
          ...amounts,
          startTime,
          notes,
          eventId: existingEventId,
        });
      } else {
        await onSave({
          type,
          sleepType,
          startTime: sleepEntry!.times!.startTime,
          endTime: sleepEntry!.times!.endTime,
          durationMinutes: sleepEntry!.times!.durationMinutes,
          notes,
          eventId: eventIdToSave,
        });
      }
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save this log.');
    } finally {
      setSaving(false);
    }
  };

  const editPreviousDiaper = () => {
    if (!previousDiaper?.id || previousDiaper.type !== 'diaper') return;
    setExistingEventId(previousDiaper.id);
    setStartTime(previousDiaper.startTime);
    setCondition(previousDiaper.metadata?.diaperCondition || 'wet');
    const amounts = diaperAmountValues(previousDiaper.metadata);
    setDiaperAmount(amounts.amount);
    setWetDiaperAmount(amounts.wetAmount);
    setDirtyDiaperAmount(amounts.dirtyAmount);
    setNotes(previousDiaper.notes || '');
    setError('');
  };

  const savePreviousDiaperDetails = async () => {
    if (!previousDiaper?.id || previousDiaper.type !== 'diaper') return;

    const previousCondition =
      previousDiaper.metadata?.diaperCondition || 'wet';
    const amounts = diaperAmountMetadata(
      previousCondition,
      previousAmount,
      previousWetAmount,
      previousDirtyAmount,
    );

    setPreviousSaving(true);
    setPreviousStatus('');
    try {
      await onSave({
        type: 'diaper',
        condition: previousCondition,
        ...amounts,
        startTime: previousDiaper.startTime,
        notes: previousNotes,
        eventId: previousDiaper.id,
      });
      setPreviousStatus('Extra details saved');
    } catch (nextError) {
      setPreviousStatus(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to save the extra details.',
      );
    } finally {
      setPreviousSaving(false);
    }
  };

  const recentNappyType = previousDiaper?.metadata?.diaperCondition === 'both'
    ? 'Wet + dirty'
    : previousDiaper?.metadata?.diaperCondition === 'dirty'
      ? 'Dirty'
      : 'Wet';
  const recentNappyAmount = formatDiaperAmountDetail(previousDiaper?.metadata);

  // Sleep, like nursing, carries its own design from the start screen through
  // to here: the manual entry and the timer's "Edit times" are one screen.
  if (type === 'sleep') {
    return (
      <SleepLogScreen
        editingTimer={timerNeedsStopping}
        startTime={startTime}
        onStartTimeChange={handleSleepStartChange}
        endTime={sleepEndTime}
        onEndTimeChange={handleSleepEndChange}
        durationMinutes={duration}
        onDurationChange={handleSleepDurationChange}
        sleepType={sleepType}
        onSleepTypeChange={setSleepType}
        customSleepLocations={customSleepLocations}
        onAddSleepLocation={onAddSleepLocation}
        notes={notes}
        onNotesChange={setNotes}
        onVoiceFill={handleVoiceFill}
        error={error}
        saving={saving}
        onSave={() => void handleSave()}
        onClose={onClose}
      />
    );
  }

  // Nursing carries its own design from the start screen through to here, so
  // the manual entry and the timer's "Edit times" are the same screen.
  if (type === 'feed' && feedType === 'breast') {
    return (
      <NursingLogScreen
        editingTimer={timerNeedsStopping}
        startTime={startTime}
        onStartTimeChange={handleNursingStartTimeChange}
        totalMinutes={duration}
        leftMinutes={leftNursingMinutes}
        rightMinutes={rightNursingMinutes}
        onMinutesChange={updateNursingMinutes}
        notes={notes}
        onNotesChange={setNotes}
        onVoiceFill={handleVoiceFill}
        error={error}
        saving={saving}
        onSave={() => void handleSave()}
        onClose={onClose}
      />
    );
  }

  return (
    <Surface style={[styles.form, { backgroundColor: 'transparent' }]} elevation={0}>
      {showCloseButton ? (
        <View style={[styles.header, { backgroundColor: color }]}>
          <Text variant="titleLarge" style={[styles.title, { color: careInk }]}>
            Log {type === 'diaper'
              ? 'nappy'
              : type === 'feed'
                ? 'bottle'
                : type}
          </Text>
          <IconButton
            icon="close"
            iconColor={careInk}
            onPress={onClose}
            accessibilityLabel="Close"
          />
        </View>
      ) : null}

      <View style={styles.content}>
            {timerNeedsStopping ? (
              <Button
                mode="text"
                icon="arrow-left"
                onPress={onClose}
                disabled={saving}
                style={styles.backToTimerButton}
              >
                Back to timer
              </Button>
            ) : null}

            <ContextualVoiceButton
              context={type === 'feed' ? 'bottle' : type}
              onFill={handleVoiceFill}
              disabled={saving}
            />

            {type === 'diaper' && existingEventId ? (
              <Surface
                elevation={0}
                style={[
                  styles.editingNotice,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}
              >
                <Text variant="labelLarge">Editing most recent nappy</Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSecondaryContainer }}
                >
                  Saving will update this record rather than add another one.
                </Text>
              </Surface>
            ) : null}

            {type === 'feed' ? (
              <>
                <View style={styles.amountRow}>
                  <TextInput
                    label="Amount"
                    mode="outlined"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                    style={styles.amountInput}
                  />
                  <SegmentedButtons
                    value={unit}
                    onValueChange={value => setUnit(value as 'ml' | 'oz')}
                    buttons={[
                      { value: 'ml', label: 'ml' },
                      { value: 'oz', label: 'oz' },
                    ]}
                    style={styles.unitInput}
                  />
                </View>
                <TextInput
                  label="Duration in minutes (optional)"
                  mode="outlined"
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  style={styles.input}
                />
              </>
            ) : (
              <>
                <EventTimeEditor
                  value={startTime}
                  onChange={setStartTime}
                  label="Nappy date and time"
                />
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Nappy type
                </Text>
                <SegmentedButtons
                  value={condition}
                  onValueChange={value =>
                    changeDiaperCondition(value as 'wet' | 'dirty' | 'both')
                  }
                  buttons={[
                    { value: 'wet', label: 'Wet' },
                    { value: 'dirty', label: 'Dirty' },
                    { value: 'both', label: 'Both' },
                  ]}
                  style={styles.fieldGroup}
                />
                <DiaperAmountFields
                  condition={condition}
                  amount={diaperAmount}
                  wetAmount={wetDiaperAmount}
                  dirtyAmount={dirtyDiaperAmount}
                  onAmountChange={setDiaperAmount}
                  onWetAmountChange={setWetDiaperAmount}
                  onDirtyAmountChange={setDirtyDiaperAmount}
                />
              </>
            )}

            <TextInput
              label="Notes (optional)"
              mode="outlined"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
            />

            {error ? (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {error}
              </Text>
            ) : null}

            <ActivityActions onSave={() => void handleSave()} onClose={onClose} saving={saving}
              label={type === 'feed' ? 'Log bottle' : existingEventId ? 'Save changes' : 'Log nappy'} />

        {type === 'diaper' &&
        previousDiaper?.id &&
        existingEventId !== previousDiaper.id ? (
          <Surface
            elevation={0}
            style={[
              styles.recentSection,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View style={styles.recentHeading}>
              <View
                style={[
                  styles.recentIcon,
                  { backgroundColor: theme.colors.secondaryContainer },
                ]}
              >
                <Icon
                  source="human-baby-changing-table"
                  size={23}
                  color={theme.colors.onSecondaryContainer}
                />
              </View>
              <View style={styles.recentHeadingCopy}>
                <Text variant="titleSmall">Previous nappy</Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {previousDiaper.startTime.toLocaleString([], {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Button
                mode="text"
                compact
                icon="pencil-outline"
                onPress={editPreviousDiaper}
                disabled={saving || previousSaving}
                accessibilityLabel="Edit the full previous nappy record"
              >
                Edit
              </Button>
            </View>
            <View
              style={[
                styles.recentSummary,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={styles.recentFact}>
                <Text
                  variant="labelSmall"
                  style={[
                    styles.recentFactLabel,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  TYPE
                </Text>
                <Text variant="bodyMedium" style={styles.recentFactValue}>
                  {recentNappyType}
                </Text>
              </View>
              {recentNappyAmount ? (
                <View
                  style={[
                    styles.recentFact,
                    styles.recentFactDivider,
                    { borderLeftColor: theme.colors.outlineVariant },
                  ]}
                >
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.recentFactLabel,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    AMOUNT
                  </Text>
                  <Text variant="bodyMedium" style={styles.recentFactValue}>
                    {recentNappyAmount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              variant="bodySmall"
              style={[
                styles.recentNotes,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={3}
            >
              {previousDiaper.notes?.trim() || 'No notes added'}
            </Text>

            <Button
              mode="text"
              compact
              icon={previousExpanded ? 'chevron-up' : 'chevron-down'}
              onPress={() => setPreviousExpanded(current => !current)}
              disabled={previousSaving}
              style={styles.quickDetailsToggle}
              contentStyle={styles.quickDetailsToggleContent}
              accessibilityHint={previousExpanded
                ? 'Hides the controls for the previous nappy'
                : 'Shows controls to add amounts and a note to the previous nappy'}
            >
              Add extra info
            </Button>
            {previousExpanded ? <>
            <DiaperAmountFields
              condition={previousDiaper.metadata?.diaperCondition || 'wet'}
              amount={previousAmount}
              wetAmount={previousWetAmount}
              dirtyAmount={previousDirtyAmount}
              onAmountChange={amount => {
                setPreviousAmount(amount);
                setPreviousStatus('');
              }}
              onWetAmountChange={amount => {
                setPreviousWetAmount(amount);
                setPreviousStatus('');
              }}
              onDirtyAmountChange={amount => {
                setPreviousDirtyAmount(amount);
                setPreviousStatus('');
              }}
            />
            <TextInput
              label="Add a note (optional)"
              mode="outlined"
              multiline
              numberOfLines={2}
              value={previousNotes}
              onChangeText={value => {
                setPreviousNotes(value);
                setPreviousStatus('');
              }}
              disabled={previousSaving}
              style={styles.previousNotes}
            />
            <View style={styles.quickDetailsActions}>
              {previousStatus ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                  accessibilityLiveRegion="polite"
                >
                  {previousStatus}
                </Text>
              ) : null}
              <Button
                mode="contained-tonal"
                icon="content-save-outline"
                onPress={() => {
                  void savePreviousDiaperDetails();
                }}
                loading={previousSaving}
                disabled={saving || previousSaving}
              >
                Save extra info
              </Button>
            </View>
            </> : null}
          </Surface>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  form: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  content: {
    padding: 24,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  backToTimerButton: {
    alignSelf: 'flex-start',
    marginLeft: -8,
    marginBottom: 8,
  },
  input: {
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    marginBottom: 16,
  },
  unitInput: {
    width: 138,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  manualLogLabel: {
    marginBottom: 12,
  },
  helperText: {
    marginTop: -8,
    marginBottom: 12,
    opacity: 0.68,
  },
  editingNotice: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 3,
  },
  recentSection: {
    marginTop: 24,
    borderRadius: 16,
    padding: 16,
  },
  recentHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentHeadingCopy: { flex: 1, gap: 2 },
  recentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSummary: {
    flexDirection: 'row',
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  recentFact: { flex: 1, gap: 2 },
  recentFactDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
  },
  recentFactLabel: { fontWeight: '800', letterSpacing: 0.6 },
  recentFactValue: { fontWeight: '700' },
  recentNotes: { marginTop: 10 },
  quickDetailsToggle: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginLeft: -8,
    marginBottom: 4,
  },
  quickDetailsToggleContent: { flexDirection: 'row-reverse' },
  previousNotes: {
    marginBottom: 12,
  },
  quickDetailsActions: {
    minHeight: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    minWidth: 100,
  },
});
