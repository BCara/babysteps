import { ActivityActions } from './ActivityStyle';
import { ActivityTextInput as TextInput, ActivitySegments as SegmentedButtons, ActivityButton as Button } from './ActivityStyle';
import SleepEditScreen from './sleep/SleepEditScreen';
import ExpandedQuickCareView from './ExpandedQuickCareView';
import { careActionByType } from '../constants/careActions';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Portal,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { BabyEvent, type DiaperAmount } from '../services/firebase/events';
import { shiftedEventTimes } from '../utils/eventEditing';
import { distributeNursingDuration } from '../utils/manualNursing';
import EventTimeEditor from './EventTimeEditor';
import ContextualVoiceButton from './ContextualVoiceButton';
import type { VoiceEntryValues } from '../utils/voiceCommand';
import {
  sleepLocationFor,
  type SleepType,
} from '../utils/sleepLocation';
import { useBabies } from '../providers/BabyProvider';
import {
  checkSleepEntry,
  sleepMinutesBetween,
  updateSleepEntry,
  type SleepTimeField,
} from '../utils/sleepEntry';
import {
  checkSettlingMinutes,
  settlingMinutesInput,
  type SettlingDifficulty,
} from '../utils/sleepSettling';
import { nappyTypeOptions } from '../constants/nappyTypes';
import DiaperAmountFields from './DiaperAmountFields';
import NursingEditScreen from './nursing/NursingEditScreen';
import {
  diaperAmountMetadata,
  diaperAmountValues,
} from '../utils/diaperAmounts';

interface EventEditModalProps {
  event: BabyEvent | null;
  visible: boolean;
  onClose: () => void;
  onSave: (
    eventId: string,
    updates: Partial<
      Pick<
        BabyEvent,
        'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'
      >
    >,
  ) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  allowDelete?: boolean;
}

const formatDurationEntry = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  return String(Math.round(safeSeconds / 60));
};

const parseDurationEntry = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return Number.NaN;
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds >= 60
    ) {
      return Number.NaN;
    }
    return minutes * 60 + seconds;
  }

  const minutes = Number(trimmed);
  return Number.isFinite(minutes) && minutes >= 0
    ? Math.round(minutes * 60)
    : Number.NaN;
};

const inferBreastSide = (
  leftSeconds: number,
  rightSeconds: number,
  fallback?: 'left' | 'right' | 'both' | '',
) => {
  if (leftSeconds > 0 && rightSeconds > 0) return 'both';
  if (leftSeconds > 0) return 'left';
  if (rightSeconds > 0) return 'right';
  return fallback || '';
};

export default function EventEditModal({
  event,
  visible,
  onClose,
  onSave,
  onDelete,
  allowDelete = true,
}: EventEditModalProps) {
  const theme = useTheme();
  const { customSleepLocations } = useBabies();
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const sleepEditOrder = useRef<SleepTimeField[]>([]);
  const [sleepEndTime, setSleepEndTime] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [leftDuration, setLeftDuration] = useState('');
  const [rightDuration, setRightDuration] = useState('');
  const [sideDurationsEdited, setSideDurationsEdited] = useState(false);
  const [condition, setCondition] = useState<'wet' | 'dirty' | 'both'>('wet');
  const [diaperAmount, setDiaperAmount] = useState<DiaperAmount>();
  const [wetDiaperAmount, setWetDiaperAmount] =
    useState<DiaperAmount>();
  const [dirtyDiaperAmount, setDirtyDiaperAmount] =
    useState<DiaperAmount>();
  const [pumpingSide, setPumpingSide] = useState<'left' | 'right' | 'both'>(
    'both',
  );
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  const [storageLocation, setStorageLocation] = useState<
    'usedNow' | 'fridge' | 'freezer' | 'discarded'
  >('usedNow');
  const [lastBreastSide, setLastBreastSide] = useState<'left' | 'right'>('left');
  const [sleepType, setSleepType] = useState<SleepType>('cot');
  const [settlingMinutes, setSettlingMinutes] = useState('');
  const [settlingDifficulty, setSettlingDifficulty] =
    useState<SettlingDifficulty>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !event) return;
    setNotes(event.notes || '');
    setStartTime(event.startTime);
    setSleepEndTime(event.endTime || event.startTime);
    setAmount(event.metadata?.amount?.toString() || '');
    const isNursingFeed =
      event.type === 'feed' && event.metadata?.feedType === 'breast';
    const storedLeftSeconds = event.metadata?.leftBreastDurationSeconds;
    const storedRightSeconds = event.metadata?.rightBreastDurationSeconds;
    const hasStoredSideTimes =
      storedLeftSeconds !== undefined || storedRightSeconds !== undefined;
    const storedSideTotal =
      (storedLeftSeconds || 0) + (storedRightSeconds || 0);
    setDuration(
      isNursingFeed
        ? formatDurationEntry(
            hasStoredSideTimes && storedSideTotal > 0
              ? storedSideTotal
              : (event.durationMinutes || 0) * 60,
          )
        : event.durationMinutes?.toString() || '',
    );
    setLeftDuration(
      isNursingFeed
        ? formatDurationEntry(storedLeftSeconds || 0)
        : '',
    );
    setRightDuration(
      isNursingFeed
        ? formatDurationEntry(storedRightSeconds || 0)
        : '',
    );
    setSideDurationsEdited(false);
    setCondition(event.metadata?.diaperCondition || 'wet');
    const diaperAmounts = diaperAmountValues(event.metadata);
    setDiaperAmount(diaperAmounts.amount);
    setWetDiaperAmount(diaperAmounts.wetAmount);
    setDirtyDiaperAmount(diaperAmounts.dirtyAmount);
    setPumpingSide(event.metadata?.pumpingSide || 'both');
    setUnit(event.metadata?.unit || 'ml');
    setStorageLocation(event.metadata?.storageLocation || 'usedNow');
    setLastBreastSide(
      event.metadata?.lastBreastSide ||
        (event.metadata?.breastSide === 'right' ? 'right' : 'left'),
    );
    sleepEditOrder.current = [];
    setSleepType(event.metadata?.sleepType || []);
    setSettlingMinutes(settlingMinutesInput(event.metadata?.settlingMinutes));
    setSettlingDifficulty(event.metadata?.settlingDifficulty);
    setError('');
  }, [event?.id, visible]);

  if (!visible || !event?.id) return null;

  const isNursingFeed =
    event.type === 'feed' && event.metadata?.feedType === 'breast';
  // A running sleep has no end time to edit yet, so it keeps the simpler form.
  const editsSleepTimes = event.type === 'sleep' && Boolean(event.endTime);

  // Start time, end time and duration describe the same sleep, so editing one
  // recalculates the others rather than letting them drift apart.
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

  const enteredLeftSeconds = parseDurationEntry(leftDuration);
  const enteredRightSeconds = parseDurationEntry(rightDuration);
  const inferredBreastSide = inferBreastSide(
    enteredLeftSeconds !== undefined && Number.isFinite(enteredLeftSeconds)
      ? enteredLeftSeconds
      : 0,
    enteredRightSeconds !== undefined && Number.isFinite(enteredRightSeconds)
      ? enteredRightSeconds
      : 0,
    event.metadata?.breastSide,
  );

  const updateSideDuration = (side: 'left' | 'right', value: string) => {
    if (side === 'left') setLeftDuration(value);
    else setRightDuration(value);
    setSideDurationsEdited(true);

    const nextLeft = parseDurationEntry(side === 'left' ? value : leftDuration);
    const nextRight = parseDurationEntry(
      side === 'right' ? value : rightDuration,
    );
    if (
      nextLeft !== undefined &&
      nextRight !== undefined &&
      Number.isFinite(nextLeft) &&
      Number.isFinite(nextRight)
    ) {
      setDuration(formatDurationEntry(nextLeft + nextRight));
    }
  };

  const updateTotalDuration = (value: string) => {
    setDuration(value);
    const nextTotal = parseDurationEntry(value);
    if (nextTotal === undefined || !Number.isFinite(nextTotal)) return;

    const currentLeft = parseDurationEntry(leftDuration);
    const currentRight = parseDurationEntry(rightDuration);
    const distributed = distributeNursingDuration({
      totalSeconds: nextTotal,
      leftSeconds:
        currentLeft !== undefined && Number.isFinite(currentLeft)
          ? currentLeft
          : 0,
      rightSeconds:
        currentRight !== undefined && Number.isFinite(currentRight)
          ? currentRight
          : 0,
      breastSide: inferBreastSide(
        currentLeft !== undefined && Number.isFinite(currentLeft)
          ? currentLeft
          : 0,
        currentRight !== undefined && Number.isFinite(currentRight)
          ? currentRight
          : 0,
        event.metadata?.breastSide,
      ),
    });

    setLeftDuration(formatDurationEntry(distributed.leftSeconds));
    setRightDuration(formatDurationEntry(distributed.rightSeconds));
    setSideDurationsEdited(true);
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

  const handleVoiceFill = (values: VoiceEntryValues) => {
    if (isNursingFeed) {
      if (values.leftMinutes !== undefined || values.rightMinutes !== undefined) {
        const left = values.leftMinutes || 0;
        const right = values.rightMinutes || 0;
        setLeftDuration(left > 0 ? formatVoiceNumber(left) : '');
        setRightDuration(right > 0 ? formatVoiceNumber(right) : '');
        setDuration(formatVoiceNumber(left + right));
        setLastBreastSide(right > 0 ? 'right' : 'left');
        setSideDurationsEdited(true);
      } else if (values.durationMinutes !== undefined) {
        updateTotalDuration(formatVoiceNumber(values.durationMinutes));
      }
    } else if (values.durationMinutes !== undefined) {
      const spokenDuration = formatVoiceNumber(values.durationMinutes);
      // Sleep keeps its start time tied to the duration it was given.
      if (editsSleepTimes) handleSleepDurationChange(spokenDuration);
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
    if (values.pumpingSide) setPumpingSide(values.pumpingSide);
    if (values.storageLocation) setStorageLocation(values.storageLocation);
    setError('');
  };

  const handleSave = async () => {
    if (startTime.getTime() > Date.now()) {
      setError('Choose a time that is not in the future.');
      return;
    }
    const sleepEntry = editsSleepTimes
      ? checkSleepEntry({ startTime, endTime: sleepEndTime, durationInput: duration })
      : null;
    if (sleepEntry?.error) {
      setError(sleepEntry.error);
      return;
    }
    const settling =
      event.type === 'sleep' ? checkSettlingMinutes(settlingMinutes) : null;
    if (settling?.error) {
      setError(settling.error);
      return;
    }
    const parsedAmount = amount ? Number(amount) : undefined;
    const parsedDurationSeconds = isNursingFeed
      ? parseDurationEntry(duration)
      : undefined;
    let parsedDuration = isNursingFeed
      ? parsedDurationSeconds === undefined
        ? undefined
        : parsedDurationSeconds / 60
      : duration
        ? Number(duration)
        : undefined;
    const parsedLeftSeconds = isNursingFeed
      ? parseDurationEntry(leftDuration)
      : undefined;
    const parsedRightSeconds = isNursingFeed
      ? parseDurationEntry(rightDuration)
      : undefined;
    if (
      (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) ||
      (parsedDuration !== undefined &&
        (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) ||
      (parsedLeftSeconds !== undefined && !Number.isFinite(parsedLeftSeconds)) ||
      (parsedRightSeconds !== undefined && !Number.isFinite(parsedRightSeconds))
    ) {
      setError(
        isNursingFeed
          ? 'Enter nursing times in minutes.'
          : 'Enter valid positive numbers.',
      );
      return;
    }

    const savedLeftSeconds = parsedLeftSeconds || 0;
    const savedRightSeconds = parsedRightSeconds || 0;
    const savedSideTotalSeconds = savedLeftSeconds + savedRightSeconds;
    if (isNursingFeed && sideDurationsEdited) {
      if (savedSideTotalSeconds <= 0) {
        setError('Add time to the left or right side.');
        return;
      }
      parsedDuration = savedSideTotalSeconds / 60;
    }

    const savedBreastSide =
      isNursingFeed && sideDurationsEdited
        ? savedLeftSeconds > 0 && savedRightSeconds > 0
          ? 'both'
          : savedLeftSeconds > 0
            ? 'left'
            : 'right'
        : event.metadata?.breastSide || undefined;
    const savedBreastSidesUsed: Array<'left' | 'right'> | undefined =
      isNursingFeed && sideDurationsEdited
        ? (['left', 'right'] as const).filter(side =>
            side === 'left' ? savedLeftSeconds > 0 : savedRightSeconds > 0,
          )
        : savedBreastSide === 'both'
          ? ['left', 'right']
          : savedBreastSide
            ? [savedBreastSide]
            : undefined;
    const savedLastBreastSide =
      isNursingFeed && savedBreastSide === 'both'
        ? lastBreastSide
        : savedBreastSide === 'left' || savedBreastSide === 'right'
          ? savedBreastSide
          : undefined;

    setSaving(true);
    setError('');
    try {
      await onSave(event.id!, {
        ...(sleepEntry?.times
          ? {
              startTime: sleepEntry.times.startTime,
              endTime: sleepEntry.times.endTime,
            }
          : shiftedEventTimes(
              event,
              startTime,
              sideDurationsEdited || parsedDuration !== event.durationMinutes
                ? parsedDuration
                : undefined,
            )),
        notes: notes.trim() || '',
        durationMinutes: sleepEntry?.times
          ? sleepEntry.times.durationMinutes
          : parsedDuration,
        metadata: {
          ...event.metadata,
          amount: event.type === 'feed' ? parsedAmount : event.metadata?.amount,
          ...(event.type === 'pumping'
            ? {
                amount: parsedAmount,
                unit,
                pumpingSide,
                storageLocation,
              }
            : {}),
          breastSide:
            isNursingFeed
              ? savedBreastSide
              : event.metadata?.breastSide,
          breastSidesUsed:
            isNursingFeed
              ? savedBreastSidesUsed
              : event.metadata?.breastSidesUsed,
          lastBreastSide:
            isNursingFeed
              ? savedLastBreastSide
              : event.metadata?.lastBreastSide,
          leftBreastDurationSeconds:
            isNursingFeed && sideDurationsEdited
              ? savedLeftSeconds
              : event.metadata?.leftBreastDurationSeconds,
          rightBreastDurationSeconds:
            isNursingFeed && sideDurationsEdited
              ? savedRightSeconds
              : event.metadata?.rightBreastDurationSeconds,
          breastSideStartedAtMs: isNursingFeed
            ? undefined
            : event.metadata?.breastSideStartedAtMs,
          sleepType:
            event.type === 'sleep' ? sleepType : event.metadata?.sleepType,
          settlingMinutes:
            event.type === 'sleep'
              ? settling!.minutes
              : event.metadata?.settlingMinutes,
          settlingDifficulty:
            event.type === 'sleep'
              ? settlingDifficulty
              : event.metadata?.settlingDifficulty,
          diaperCondition:
            event.type === 'diaper' ? condition : event.metadata?.diaperCondition,
          ...(event.type === 'diaper'
            ? diaperAmountMetadata(
                condition,
                diaperAmount,
                wetDiaperAmount,
                dirtyDiaperAmount,
              )
            : {}),
        },
      });
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update event.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this log?',
      'It will be removed from your timeline.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await onDelete(event.id!);
              onClose();
            } catch (nextError) {
              setError(
                nextError instanceof Error ? nextError.message : 'Unable to delete event.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  // Nursing and sleep keep their activity-specific controls in the editor.
  // Other events share the full-screen Quick Care shell.
  if (isNursingFeed || event.type === 'sleep') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoider}
        >
          <Portal.Host>
            {event.type === 'sleep' ? (
              <SleepEditScreen
                startTime={startTime}
                endTime={editsSleepTimes ? sleepEndTime : undefined}
                onStartTimeChange={editsSleepTimes ? handleSleepStartChange : setStartTime}
                onEndTimeChange={handleSleepEndChange}
                duration={duration}
                onDurationChange={editsSleepTimes ? handleSleepDurationChange : setDuration}
                sleepType={sleepType}
                onSleepTypeChange={setSleepType}
                customSleepLocations={customSleepLocations}
                settlingMinutes={settlingMinutes}
                onSettlingMinutesChange={setSettlingMinutes}
                settlingDifficulty={settlingDifficulty}
                onSettlingDifficultyChange={setSettlingDifficulty}
                notes={notes}
                onNotesChange={setNotes}
                onVoiceFill={handleVoiceFill}
                error={error}
                saving={saving}
                onSave={() => void handleSave()}
                onClose={onClose}
                onDelete={allowDelete ? confirmDelete : undefined}
              />
            ) : (
            <NursingEditScreen
              startTime={startTime}
              onStartTimeChange={setStartTime}
              totalMinutes={duration}
              onTotalMinutesChange={updateTotalDuration}
              leftMinutes={leftDuration}
              rightMinutes={rightDuration}
              onSideMinutesChange={updateSideDuration}
              finishedOn={
                inferredBreastSide === 'both'
                  ? { value: lastBreastSide, onChange: setLastBreastSide }
                  : undefined
              }
              notes={notes}
              onNotesChange={setNotes}
              onVoiceFill={handleVoiceFill}
              error={error}
              saving={saving}
              onSave={() => void handleSave()}
              onClose={onClose}
              onDelete={allowDelete ? confirmDelete : undefined}
            />
            )}
          </Portal.Host>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  const definition = careActionByType[event.type];
  const title = event.type === 'feed' ? 'Edit bottle feed' : `Edit ${definition.label.toLowerCase()}`;
  return (
    <ExpandedQuickCareView
      visible={visible}
      title={title}
      icon={definition.icon}
      color={definition.color}
      onClose={onClose}
      backLabel="Back"
      scrollable={false}
    >
      <Surface style={[styles.modal, { backgroundColor: 'transparent' }]} elevation={0}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
          >
            <ContextualVoiceButton
              context={event.type === 'feed' ? 'bottle' : event.type}
              onFill={handleVoiceFill}
              disabled={saving}
            />
            <EventTimeEditor
              value={startTime}
              onChange={editsSleepTimes ? handleSleepStartChange : setStartTime}
              label={
                event.type === 'diaper'
                  ? 'Nappy date and time'
                  : editsSleepTimes
                    ? 'Sleep started'
                    : 'When it happened'
              }
            />
            {editsSleepTimes ? (
              <EventTimeEditor
                value={sleepEndTime}
                onChange={handleSleepEndChange}
                label="Sleep ended"
              />
            ) : null}
            {event.type === 'feed' && event.metadata?.feedType === 'bottle' ? (
              <TextInput
                label={`Amount (${event.metadata?.unit || 'ml'})`}
                mode="outlined"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
              />
            ) : null}
            {event.type === 'pumping' ? (
              <>
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Side
                </Text>
                <SegmentedButtons
                  value={pumpingSide}
                  onValueChange={value =>
                    setPumpingSide(value as 'left' | 'right' | 'both')
                  }
                  buttons={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'both', label: 'Both' },
                  ]}
                  style={styles.input}
                />
                <TextInput
                  label={`Amount (${unit})`}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  style={styles.input}
                />
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Unit
                </Text>
                <SegmentedButtons
                  value={unit}
                  onValueChange={value => setUnit(value as 'ml' | 'oz')}
                  buttons={[
                    { value: 'ml', label: 'ml' },
                    { value: 'oz', label: 'oz' },
                  ]}
                  style={styles.input}
                />
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Stored
                </Text>
                <SegmentedButtons
                  value={storageLocation}
                  onValueChange={value =>
                    setStorageLocation(
                      value as
                        | 'usedNow'
                        | 'fridge'
                        | 'freezer'
                        | 'discarded',
                    )
                  }
                  buttons={[
                    { value: 'usedNow', label: 'Now' },
                    { value: 'fridge', label: 'Fridge' },
                    { value: 'freezer', label: 'Freezer' },
                    { value: 'discarded', label: 'Discard' },
                  ]}
                  style={styles.input}
                />
              </>
            ) : null}
            {event.type !== 'diaper' && !isNursingFeed ? (
              <TextInput
                label="Duration in minutes"
                mode="outlined"
                keyboardType="number-pad"
                value={duration}
                onChangeText={
                  editsSleepTimes ? handleSleepDurationChange : setDuration
                }
                style={styles.input}
              />
            ) : event.type === 'diaper' ? (
              <>
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Nappy type
                </Text>
                <SegmentedButtons
                  value={condition}
                  onValueChange={value =>
                    changeDiaperCondition(value as 'wet' | 'dirty' | 'both')
                  }
                  buttons={nappyTypeOptions}
                  style={styles.input}
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
            ) : null}
            <TextInput
              label="Notes"
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
            <ActivityActions onSave={() => void handleSave()} onClose={onClose}
              onDelete={allowDelete ? confirmDelete : undefined} saving={saving} />
          </ScrollView>
      </Surface>
    </ExpandedQuickCareView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  modal: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 22,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
