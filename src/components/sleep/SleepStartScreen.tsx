import { useState } from 'react';
import {
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
  type SettlingDifficulty,
  type SettlingMetadata,
} from '../../utils/sleepSettling';
import { sleepMinutesBetween, sleepTimesForDuration } from '../../utils/sleepEntry';
import { formatNursingDuration } from '../../utils/breastFeed';
import { TIMER_LIMIT_MINUTES } from '../../utils/timerLimits';

interface SleepStartScreenProps {
  /** Only set when the caregiver has pinned a place in Quick Care. */
  defaultSleepType?: SleepType;
  customSleepLocations: CustomSleepLocation[];
  onAddSleepLocation: (label: string) => Promise<void>;
  onClose: () => void;
  onStart: (
    sleepType: SleepType | undefined,
    startTime?: Date,
    settling?: SettlingMetadata,
  ) => Promise<void>;
  /** A sleep that is already over, written down without leaving this screen. */
  onLogSleep: (
    sleepType: SleepType | undefined,
    startTime: Date,
    endTime: Date,
    durationMinutes: number,
    settling?: SettlingMetadata,
  ) => Promise<void>;
}

/**
 * Starting a sleep, or writing down one that is already over.
 *
 * Both are the same facts, so they are one screen. With no woke-up time the
 * button starts a timer; give it one and the clock becomes the sleep's length
 * and the button saves the sleep that already happened. Where and how settling
 * went sit one scroll down, out of the way until they are wanted.
 */
export default function SleepStartScreen({
  defaultSleepType,
  customSleepLocations,
  onAddSleepLocation,
  onClose,
  onStart,
  onLogSleep,
}: SleepStartScreenProps) {
  const chrome = useActivityChrome('sleep');
  const [sleepType, setSleepType] = useState<SleepType | undefined>(
    defaultSleepType,
  );
  const [startTime, setStartTime] = useState(() => new Date());
  const [startTimeEdited, setStartTimeEdited] = useState(false);
  const [endTime, setEndTime] = useState<Date | undefined>();
  const [addingPlace, setAddingPlace] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [settlingMinutes, setSettlingMinutes] = useState('');
  const [settlingDifficulty, setSettlingDifficulty] =
    useState<SettlingDifficulty>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const definitions = sleepLocationDefinitions(customSleepLocations);
  const durationMinutes = endTime ? sleepMinutesBetween(startTime, endTime) : 0;

  // Settling is the one thing here that can be typed wrong, so it is checked
  // before anything is saved rather than discarded silently.
  const checkedSettling = (): SettlingMetadata | null => {
    const settling = checkSettlingMinutes(settlingMinutes);
    if (settling.error) {
      setError(settling.error);
      return null;
    }
    return { settlingMinutes: settling.minutes, settlingDifficulty };
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    const settling = checkedSettling();
    if (!settling) return;
    void run(
      () => onStart(sleepType, startTimeEdited ? startTime : new Date(), settling),
      'Unable to start the sleep timer.',
    );
  };

  const save = () => {
    if (!endTime) return;
    if (durationMinutes <= 0) {
      setError('The woke-up time needs to be after the fell-asleep time.');
      return;
    }
    const settling = checkedSettling();
    if (!settling) return;
    void run(
      () => onLogSleep(sleepType, startTime, endTime, durationMinutes, settling),
      'Unable to save this sleep.',
    );
  };

  const primary = endTime ? save : start;
  const clockValue = endTime
    ? formatNursingDuration(Math.max(0, durationMinutes) * 60)
    : '00:00';
  const summary = sleepDetailsSummary({
    sleepType,
    customSleepLocations,
    settlingDifficulty,
    settlingMinutes: checkSettlingMinutes(settlingMinutes).minutes,
  });

  return (
    <SleepScreenLayout
      chrome={chrome}
      accessibilityLabel="Start sleep"
      header={
        <NursingHeader
          chrome={chrome}
          title="Sleep"
          icon="sleep"
          onBack={onClose}
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
            onChange={next => {
              setStartTime(next);
              setStartTimeEdited(true);
            }}
            disabled={busy}
          />
          <SleepFieldLabel chrome={chrome}>Woke up</SleepFieldLabel>
          <WokeUpFields
            chrome={chrome}
            value={endTime}
            onChange={setEndTime}
            disabled={busy}
          />
        </>
      }
      clock={
        <SleepClock
          chrome={chrome}
          value={clockValue}
          caption={endTime ? 'Duration · tap to change' : 'Asleep'}
          onPress={endTime ? () => setEditingDuration(true) : undefined}
          accessibilityLabel={`Duration ${clockValue}. Tap to change`}
        />
      }
      primary={
        <NursingPrimaryAction
          chrome={chrome}
          pressKey="start"
          label={endTime ? 'Save sleep' : 'Start sleep'}
          onPress={primary}
          disabled={busy}
        />
      }
      notice={<NursingError chrome={chrome} message={error} />}
      mini={{
        value: clockValue,
        caption: endTime ? 'Duration' : 'Not started',
        action: {
          label: endTime ? 'Save' : 'Start',
          icon: endTime ? 'check' : 'play',
          onPress: primary,
          disabled: busy,
        },
      }}
      detailsSummary={summary}
      details={
        <>
          <SleepFieldLabel chrome={chrome}>Where</SleepFieldLabel>
          <SleepLocationPicker
            chrome={chrome}
            definitions={definitions}
            value={sleepType}
            onChange={setSleepType}
            onAdd={() => setAddingPlace(true)}
            disabled={busy}
          />
          <SleepSettlingFields
            chrome={chrome}
            minutes={settlingMinutes}
            onMinutesChange={setSettlingMinutes}
            difficulty={settlingDifficulty}
            onDifficultyChange={setSettlingDifficulty}
            disabled={busy}
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
              setStartTimeEdited(true);
              setEndTime(next.endTime);
            }}
          />
        </>
      }
    />
  );
}
