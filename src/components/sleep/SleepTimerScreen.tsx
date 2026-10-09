import { useEffect, useRef, useState } from 'react';
import { formatTimerSeconds } from '../../utils/feedTiming';
import { useAppearance } from '../../providers/AppearanceProvider';
import { TIMER_LIMIT_MINUTES, timerLimitLabel } from '../../utils/timerLimits';
import {
  NursingActionRow,
  NursingError,
  NursingHeader,
  NursingHint,
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
  type SettlingMetadata,
} from '../../utils/sleepSettling';
import { sleepMinutesBetween } from '../../utils/sleepEntry';
import { formatNursingDuration } from '../../utils/breastFeed';

/**
 * Long enough that a typed number is finished, short enough that leaving the
 * screen straight afterwards still saves it.
 */
const SETTLING_COMMIT_DELAY_MS = 700;

interface SleepTimerScreenProps {
  startTime: Date;
  sleepType?: SleepType;
  customSleepLocations: CustomSleepLocation[];
  onAddSleepLocation: (label: string) => Promise<void>;
  onChangeSleepType: (sleepType: SleepType | undefined) => void;
  settlingMinutes?: number;
  settlingDifficulty?: SettlingDifficulty;
  onChangeSettling?: (next: SettlingMetadata) => void;
  onChangeStartTime?: (next: Date) => void;
  onStop: () => void;
  /** Stops the sleep at a woke-up time set on this screen, not at now. */
  onStopAt: (endTime: Date) => void;
  onDiscard: () => void;
  /** Writes down a sleep from earlier without touching the one running. */
  onAddEarlier?: () => void;
  onBack: () => void;
  busy?: boolean;
}

/** The sleep timer follows the same appearance preference as the rest of the app. */
export default function SleepTimerScreen({
  startTime,
  sleepType,
  customSleepLocations,
  onAddSleepLocation,
  onChangeSleepType,
  settlingMinutes,
  settlingDifficulty,
  onChangeSettling,
  onChangeStartTime,
  onStop,
  onStopAt,
  onDiscard,
  onAddEarlier,
  onBack,
  busy = false,
}: SleepTimerScreenProps) {
  const { mode } = useAppearance();
  const chrome = useActivityChrome('sleep');
  const [addingPlace, setAddingPlace] = useState(false);
  // A woke-up time set here but not yet saved: the sleep keeps running until
  // "Save sleep" stops it at that time, and clearing it changes nothing.
  const [endDraft, setEndDraft] = useState<Date | undefined>();
  const [editingDuration, setEditingDuration] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime.getTime());
  // The typed minutes are held here and written a moment later: the record is
  // already saved, so every keystroke would otherwise be its own write.
  const [settlingDraft, setSettlingDraft] = useState(() =>
    settlingMinutesInput(settlingMinutes),
  );
  const commitTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const committed = useRef(settlingMinutes);

  /**
   * A saved value only reaches the field when it is news.
   *
   * Our own write comes back through this prop a moment after it is made, by
   * which time the caregiver may have typed another digit — replaying it would
   * take that digit away again. What is worth replaying is the other kind of
   * change: the same sleep edited on another phone.
   */
  useEffect(() => {
    if (settlingMinutes === committed.current) return;
    committed.current = settlingMinutes;
    setSettlingDraft(settlingMinutesInput(settlingMinutes));
  }, [settlingMinutes]);

  const pending = useRef<SettlingMetadata | undefined>(undefined);

  /**
   * Writes whatever is still waiting, now.
   *
   * The delay is there to spare Firestore a write per keystroke, not to put
   * the last number at risk: stopping the sleep or leaving the screen inside
   * that window has to save it rather than drop it. Held in a ref so the
   * unmount cleanup calls the current one rather than the first render's.
   */
  const flush = useRef(() => {});
  flush.current = () => {
    if (commitTimeout.current === undefined) return;
    clearTimeout(commitTimeout.current);
    commitTimeout.current = undefined;
    const next = pending.current;
    pending.current = undefined;
    if (!next || !onChangeSettling) return;
    committed.current = next.settlingMinutes;
    onChangeSettling(next);
  };

  useEffect(() => () => flush.current(), []);

  const commitSettling = (next: SettlingMetadata, delayMs: number) => {
    if (!onChangeSettling) return;
    clearTimeout(commitTimeout.current);
    pending.current = next;
    commitTimeout.current = setTimeout(() => flush.current(), delayMs);
  };

  const changeSettlingMinutes = (value: string) => {
    setSettlingDraft(value);
    const checked = checkSettlingMinutes(value);
    // A half-typed or out-of-range number is simply not saved yet; the field
    // keeps it on screen so it can be finished or corrected.
    if (checked.error) return;
    commitSettling(
      { settlingMinutes: checked.minutes, settlingDifficulty },
      SETTLING_COMMIT_DELAY_MS,
    );
  };

  const changeSettlingDifficulty = (next: SettlingDifficulty | undefined) => {
    const checked = checkSettlingMinutes(settlingDraft);
    commitSettling(
      {
        settlingMinutes: checked.error ? settlingMinutes : checked.minutes,
        settlingDifficulty: next,
      },
      0,
    );
  };

  useEffect(() => {
    setElapsed(Date.now() - startTime.getTime());
    const interval = setInterval(
      () => setElapsed(Date.now() - startTime.getTime()),
      1000,
    );
    return () => clearInterval(interval);
  }, [startTime]);

  const limitMinutes = TIMER_LIMIT_MINUTES.sleep;
  const overLimit = elapsed / 60_000 > limitMinutes;

  const draftMinutes = endDraft ? sleepMinutesBetween(startTime, endDraft) : 0;
  const sinceStartMinutes = Math.max(1, Math.floor(elapsed / 60_000));
  const clockValue = endDraft
    ? formatNursingDuration(Math.max(0, draftMinutes) * 60)
    : formatTimerSeconds(elapsed / 1000);

  const stop = () => {
    flush.current();
    onStop();
  };

  const stopAtDraft = () => {
    if (!endDraft) return;
    if (draftMinutes <= 0) {
      setError('The woke-up time needs to be after the fell-asleep time.');
      return;
    }
    setError('');
    flush.current();
    onStopAt(endDraft);
  };

  const primary = endDraft ? stopAtDraft : stop;

  return (
    <SleepScreenLayout
      chrome={chrome}
      accessibilityLabel={`Sleep timer, ${mode} brightness`}
      header={
        <NursingHeader
          chrome={chrome}
          title="Sleep"
          icon="sleep"
          onBack={onBack}
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
            onChange={onChangeStartTime ?? (() => undefined)}
            disabled={busy || !onChangeStartTime}
          />
          <SleepFieldLabel chrome={chrome}>Woke up</SleepFieldLabel>
          <WokeUpFields
            chrome={chrome}
            value={endDraft}
            onChange={next => {
              setError('');
              setEndDraft(next);
            }}
            disabled={busy}
          />
        </>
      }
      clock={
        <SleepClock
          chrome={chrome}
          value={clockValue}
          caption={endDraft ? 'Duration · tap to change' : 'Asleep'}
          onPress={endDraft ? () => setEditingDuration(true) : undefined}
          accessibilityLabel={`Duration ${clockValue}. Tap to change`}
        />
      }
      primary={
        <NursingPrimaryAction
          chrome={chrome}
          pressKey="stop"
          label={endDraft ? 'Save sleep' : 'Stop sleep'}
          onPress={primary}
          disabled={busy}
        />
      }
      actions={
        <NursingActionRow
          chrome={chrome}
          actions={[
            ...(onAddEarlier
              ? [
                  {
                    key: 'add',
                    icon: 'clock-plus-outline',
                    label: 'Add earlier',
                    onPress: onAddEarlier,
                    disabled: busy,
                    accessibilityLabel: 'Add a sleep from earlier',
                  },
                ]
              : []),
            {
              key: 'discard',
              icon: 'delete-outline',
              label: 'Discard',
              // The host confirms before anything is deleted.
              onPress: onDiscard,
              danger: true,
              disabled: busy,
            },
          ]}
        />
      }
      notice={
        <>
          <NursingError chrome={chrome} message={error} />
          {overLimit && !endDraft ? (
            <NursingHint chrome={chrome}>
              Past {timerLimitLabel(limitMinutes)} — stopping will save it
              capped at that.
            </NursingHint>
          ) : null}
        </>
      }
      mini={{
        value: clockValue,
        caption: endDraft ? 'Duration' : 'Asleep',
        action: {
          label: endDraft ? 'Save' : 'Stop',
          icon: endDraft ? 'check' : 'stop',
          onPress: primary,
          disabled: busy,
        },
      }}
      detailsSummary={sleepDetailsSummary({
        sleepType,
        customSleepLocations,
        settlingDifficulty,
        settlingMinutes: checkSettlingMinutes(settlingDraft).minutes,
      })}
      details={
        <>
          <SleepFieldLabel chrome={chrome}>Where</SleepFieldLabel>
          <SleepLocationPicker
            chrome={chrome}
            definitions={sleepLocationDefinitions(customSleepLocations)}
            value={sleepType}
            onChange={onChangeSleepType}
            onAdd={() => setAddingPlace(true)}
            disabled={busy}
          />
          {onChangeSettling ? (
            <SleepSettlingFields
              chrome={chrome}
              minutes={settlingDraft}
              onMinutesChange={changeSettlingMinutes}
              difficulty={settlingDifficulty}
              onDifficultyChange={changeSettlingDifficulty}
              disabled={busy}
            />
          ) : null}
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
            minutes={draftMinutes}
            // A running sleep cannot have lasted longer than it has been going.
            maxMinutes={Math.min(sinceStartMinutes, TIMER_LIMIT_MINUTES.sleep)}
            onDismiss={() => setEditingDuration(false)}
            onSave={minutes => {
              setError('');
              setEndDraft(new Date(startTime.getTime() + minutes * 60_000));
            }}
          />
        </>
      }
    />
  );
}
