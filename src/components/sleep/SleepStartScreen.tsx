import { useState } from 'react';
import { formatTimerSeconds } from '../../utils/feedTiming';
import {
  NursingBottomRow,
  NursingError,
  NursingHeader,
  NursingHint,
  NursingPage,
  NursingPrimaryAction,
  NursingSecondaryAction,
  NursingSpacer,
  NursingTotal,
  useActivityChrome,
} from '../nursing/NursingChrome';
import NursingStartTimeFields from '../nursing/NursingStartTimeFields';
import SleepLocationPicker from './SleepLocationPicker';
import AddSleepPlaceDialog from './AddSleepPlaceDialog';
import {
  sleepLocationDefinitions,
  type CustomSleepLocation,
  type SleepType,
} from '../../utils/sleepLocation';

interface SleepStartScreenProps {
  /** Only set when the caregiver has pinned a place in Quick Care. */
  defaultSleepType?: SleepType;
  customSleepLocations: CustomSleepLocation[];
  onAddSleepLocation: (label: string) => Promise<void>;
  onClose: () => void;
  onManualEntry: (startTime?: Date) => void;
  onStart: (sleepType: SleepType | undefined, startTime?: Date) => Promise<void>;
}

/**
 * Starting a sleep, in the running timer's clothes.
 *
 * Nursing puts the two sides where they will sit once the timer runs, so the
 * tap that starts a feed is the tap that switches sides. Sleep has one button
 * instead — a place is optional and does not start anything on its own — so the
 * picker sits where the timer will show it and Start stays in one fixed spot.
 */
export default function SleepStartScreen({
  defaultSleepType,
  customSleepLocations,
  onAddSleepLocation,
  onClose,
  onManualEntry,
  onStart,
}: SleepStartScreenProps) {
  const chrome = useActivityChrome('sleep');
  const [sleepType, setSleepType] = useState<SleepType | undefined>(
    defaultSleepType,
  );
  const [startTime, setStartTime] = useState(() => new Date());
  const [startTimeEdited, setStartTimeEdited] = useState(false);
  const [addingPlace, setAddingPlace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const definitions = sleepLocationDefinitions(customSleepLocations);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await onStart(sleepType, startTimeEdited ? startTime : new Date());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to start the sleep timer.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <NursingPage chrome={chrome} accessibilityLabel="Start sleep">
      <NursingHeader
        chrome={chrome}
        title="Sleep"
        icon="sleep"
        onBack={onClose}
        backLabel="Home"
      />

      <NursingStartTimeFields
        chrome={chrome}
        value={startTime}
        onChange={next => {
          setStartTime(next);
          setStartTimeEdited(true);
        }}
        disabled={busy}
      />

      <NursingSpacer />

      <NursingTotal chrome={chrome} value={formatTimerSeconds(0)} caption="Total" />

      <NursingSpacer />

      <NursingHint chrome={chrome}>
        Where is the baby sleeping? Optional — tap again to clear.
      </NursingHint>

      <SleepLocationPicker
        chrome={chrome}
        definitions={definitions}
        value={sleepType}
        onChange={setSleepType}
        onAdd={() => setAddingPlace(true)}
        disabled={busy}
      />

      <NursingError chrome={chrome} message={error} />

      <NursingSpacer />

      <NursingPrimaryAction
        chrome={chrome}
        pressKey="start"
        label="Start sleep"
        onPress={() => void start()}
        disabled={busy}
      />

      <NursingSecondaryAction
        chrome={chrome}
        pressKey="manual"
        label="Manual entry"
        onPress={() => onManualEntry(startTimeEdited ? startTime : undefined)}
        disabled={busy}
        accessibilityLabel="Enter a finished sleep by hand"
      />

      <NursingBottomRow
        chrome={chrome}
        actions={[
          {
            key: 'close',
            icon: 'close',
            label: 'Close',
            onPress: onClose,
            muted: true,
            disabled: busy,
          },
        ]}
      />

      <AddSleepPlaceDialog
        chrome={chrome}
        visible={addingPlace}
        onDismiss={() => setAddingPlace(false)}
        onAdd={async label => {
          await onAddSleepLocation(label);
        }}
      />
    </NursingPage>
  );
}
