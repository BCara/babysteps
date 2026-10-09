import { useState } from 'react';
import {
  NursingActionRow,
  NursingError,
  NursingHeader,
  NursingPrimaryAction,
  useActivityChrome,
} from '../nursing/NursingChrome';
import NursingStartTimeFields from '../nursing/NursingStartTimeFields';
import SleepLocationPicker from './SleepLocationPicker';
import AddSleepPlaceDialog from './AddSleepPlaceDialog';
import SleepSettlingFields from './SleepSettlingFields';
import MinutesDialog from '../nursing/MinutesDialog';
import SleepScreenLayout, {
  SleepClock,
  SleepFieldLabel,
  WokeUpFields,
} from './SleepScreenLayout';
import { sleepDetailsSummary } from './sleepDetailsSummary';
import {
  sleepLocationDefinitions,
  type CustomSleepLocation,
  type SleepType,
} from '../../utils/sleepLocation';
import {
  checkSettlingMinutes,
  settlingMinutesInput,
  type SettlingDifficulty,
} from '../../utils/sleepSettling';
import { sleepMinutesBetween, sleepTimesForDuration } from '../../utils/sleepEntry';
import { formatNursingDuration } from '../../utils/breastFeed';
import { TIMER_LIMIT_MINUTES } from '../../utils/timerLimits';

export interface SleepSavedChanges {
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  sleepType?: SleepType;
  settlingMinutes?: number;
  settlingDifficulty?: SettlingDifficulty;
}

interface SleepSavedScreenProps {
  startTime: Date;
  endTime: Date;
  sleepType?: SleepType;
  settlingMinutes?: number;
  settlingDifficulty?: SettlingDifficulty;
  customSleepLocations: CustomSleepLocation[];
  onAddSleepLocation: (label: string) => Promise<void>;
  onSave: (changes: SleepSavedChanges) => Promise<void>;
  /** "Still asleep" after all: the sleep goes back to being a running timer. */
  onReopen: () => Promise<void>;
  onDelete: () => void;
  onDone: () => void;
  busy?: boolean;
}

/**
 * The sleep that was just stopped, laid out exactly as it was while running.
 *
 * Stopping is when the details are freshest and most often wrong — the timer
 * was stopped late, or the place was never picked — so this is where they can
 * be put right, rather than the screen jumping straight back to "Start sleep"
 * as if nothing had happened. Nothing is written until "Save changes".
 */
export default function SleepSavedScreen({
  startTime: savedStart,
  endTime: savedEnd,
  sleepType: savedSleepType,
  settlingMinutes: savedSettlingMinutes,
  settlingDifficulty: savedSettlingDifficulty,
  customSleepLocations,
  onAddSleepLocation,
  onSave,
  onReopen,
  onDelete,
  onDone,
  busy = false,
}: SleepSavedScreenProps) {
  const chrome = useActivityChrome('sleep');
  const [startTime, setStartTime] = useState(savedStart);
  const [endTime, setEndTime] = useState(savedEnd);
  const [sleepType, setSleepType] = useState<SleepType | undefined>(savedSleepType);
  const [settlingMinutes, setSettlingMinutes] = useState(() =>
    settlingMinutesInput(savedSettlingMinutes),
  );
  const [settlingDifficulty, setSettlingDifficulty] = useState<
    SettlingDifficulty | undefined
  >(savedSettlingDifficulty);
  const [addingPlace, setAddingPlace] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const working = busy || saving;
  const durationMinutes = sleepMinutesBetween(startTime, endTime);
  const clockValue = formatNursingDuration(Math.max(0, durationMinutes) * 60);
  const checkedSettling = checkSettlingMinutes(settlingMinutes);

  const changed =
    startTime.getTime() !== savedStart.getTime() ||
    endTime.getTime() !== savedEnd.getTime() ||
    JSON.stringify(sleepType ?? null) !== JSON.stringify(savedSleepType ?? null) ||
    settlingDifficulty !== savedSettlingDifficulty ||
    (checkedSettling.error ? true : checkedSettling.minutes !== savedSettlingMinutes);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : fallback);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!changed) {
      onDone();
      return;
    }
    if (durationMinutes <= 0) {
      setError('The woke-up time needs to be after the fell-asleep time.');
      return;
    }
    if (checkedSettling.error) {
      setError(checkedSettling.error);
      return;
    }
    void run(
      () =>
        onSave({
          startTime,
          endTime,
          durationMinutes,
          sleepType,
          settlingMinutes: checkedSettling.minutes,
          settlingDifficulty,
        }),
      'Unable to save the changes.',
    );
  };

  const primaryLabel = changed ? 'Save changes' : 'Done';

  return (
    <SleepScreenLayout
      chrome={chrome}
      accessibilityLabel="Saved sleep"
      header={
        <NursingHeader
          chrome={chrome}
          title="Sleep saved"
          icon="sleep"
          onBack={onDone}
          backLabel="Home"
          bleedPagePadding={false}
        />
      }
      fields={
        <>
          <SleepFieldLabel chrome={chrome}>Fell asleep</SleepFieldLabel>
          <NursingStartTimeFields
            chrome={chrome}
            label="Fell asleep"
            value={startTime}
            onChange={setStartTime}
            disabled={working}
          />
          <SleepFieldLabel chrome={chrome}>Woke up</SleepFieldLabel>
          <WokeUpFields
            chrome={chrome}
            value={endTime}
            onChange={next => {
              setError('');
              if (next) setEndTime(next);
              else void run(onReopen, 'Unable to reopen this sleep.');
            }}
            disabled={working}
          />
        </>
      }
      clock={
        <SleepClock
          chrome={chrome}
          value={clockValue}
          caption="Slept · tap to change"
          onPress={() => setEditingDuration(true)}
          accessibilityLabel={`Slept ${clockValue}. Tap to change`}
        />
      }
      primary={
        <NursingPrimaryAction
          chrome={chrome}
          pressKey="done"
          label={primaryLabel}
          onPress={save}
          disabled={working}
        />
      }
      actions={
        <NursingActionRow
          chrome={chrome}
          actions={[
            {
              key: 'delete',
              icon: 'delete-outline',
              label: 'Delete',
              // The host confirms before anything is deleted.
              onPress: onDelete,
              danger: true,
              disabled: working,
              accessibilityLabel: 'Delete this sleep',
            },
          ]}
        />
      }
      notice={<NursingError chrome={chrome} message={error} />}
      mini={{
        value: clockValue,
        caption: 'Slept',
        action: {
          label: changed ? 'Save' : 'Done',
          icon: 'check',
          onPress: save,
          disabled: working,
        },
      }}
      detailsSummary={sleepDetailsSummary({
        sleepType,
        customSleepLocations,
        settlingDifficulty,
        settlingMinutes: checkedSettling.minutes,
      })}
      details={
        <>
          <SleepFieldLabel chrome={chrome}>Where</SleepFieldLabel>
          <SleepLocationPicker
            chrome={chrome}
            definitions={sleepLocationDefinitions(customSleepLocations)}
            value={sleepType}
            onChange={setSleepType}
            onAdd={() => setAddingPlace(true)}
            disabled={working}
          />
          <SleepSettlingFields
            chrome={chrome}
            minutes={settlingMinutes}
            onMinutesChange={setSettlingMinutes}
            difficulty={settlingDifficulty}
            onDifficultyChange={setSettlingDifficulty}
            disabled={working}
          />
        </>
      }
      overlays={
        <>
          <AddSleepPlaceDialog
            chrome={chrome}
            visible={addingPlace}
            onDismiss={() => setAddingPlace(false)}
            onAdd={onAddSleepLocation}
          />
          <MinutesDialog
            chrome={chrome}
            visible={editingDuration}
            title="How long was the sleep?"
            label="Minutes asleep"
            minutes={durationMinutes}
            maxMinutes={TIMER_LIMIT_MINUTES.sleep}
            onDismiss={() => setEditingDuration(false)}
            onSave={minutes => {
              const next = sleepTimesForDuration(startTime, minutes, new Date());
              setStartTime(next.startTime);
              setEndTime(next.endTime);
            }}
          />
        </>
      }
    />
  );
}
