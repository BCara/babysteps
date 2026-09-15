import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { formatTimerSeconds } from '../../utils/feedTiming';
import { useAppearance } from '../../providers/AppearanceProvider';
import { TIMER_LIMIT_MINUTES, timerLimitLabel } from '../../utils/timerLimits';
import {
  NursingBottomRow,
  NursingHeader,
  NursingHint,
  NursingPage,
  NursingPrimaryAction,
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

interface SleepTimerScreenProps {
  startTime: Date;
  sleepType?: SleepType;
  customSleepLocations: CustomSleepLocation[];
  onAddSleepLocation: (label: string) => Promise<void>;
  onChangeSleepType: (sleepType: SleepType | undefined) => void;
  onChangeStartTime?: (next: Date) => void;
  onStop: () => void;
  onDiscard: () => void;
  onManual: () => void;
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
  onChangeStartTime,
  onStop,
  onDiscard,
  onManual,
  onBack,
  busy = false,
}: SleepTimerScreenProps) {
  const { mode } = useAppearance();
  const chrome = useActivityChrome('sleep');
  const [addingPlace, setAddingPlace] = useState(false);
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime.getTime());


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

  const confirmDiscard = () =>
    Alert.alert(
      'Discard this sleep?',
      'The timer will be deleted. This cannot be undone.',
      [
        { text: 'Keep sleeping', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ],
    );

  return (
    <NursingPage
      chrome={chrome}
      accessibilityLabel={`Sleep timer, ${mode} brightness`}
    >
      <NursingHeader
        chrome={chrome}
        title="Sleep"
        icon="sleep"
        onBack={onBack}
        backLabel="Home"
      />

      <NursingStartTimeFields
        chrome={chrome}
        label="Started"
        value={startTime}
        onChange={onChangeStartTime ?? (() => undefined)}
        disabled={busy || !onChangeStartTime}
      />

      <NursingSpacer />

      <NursingTotal
        chrome={chrome}
        value={formatTimerSeconds(elapsed / 1000)}
        caption="Asleep"
      />

      {overLimit ? (
        <NursingHint chrome={chrome}>
          Past {timerLimitLabel(limitMinutes)} — stopping will save it capped at
          that.
        </NursingHint>
      ) : null}

      <NursingSpacer />

      <SleepLocationPicker
        chrome={chrome}
        definitions={sleepLocationDefinitions(customSleepLocations)}
        value={sleepType}
        onChange={onChangeSleepType}
        onAdd={() => setAddingPlace(true)}
        disabled={busy}
      />

      <NursingSpacer />

      <NursingPrimaryAction
        chrome={chrome}
        pressKey="stop"
        label="Stop sleep"
        onPress={onStop}
        disabled={busy}
      />

      <NursingBottomRow
        chrome={chrome}
        actions={[
          {
            key: 'manual',
            icon: 'pencil-outline',
            label: 'Edit times',
            onPress: onManual,
            disabled: busy,
          },
          {
            key: 'discard',
            icon: 'delete-outline',
            label: 'Discard',
            onPress: confirmDiscard,
            danger: true,
            disabled: busy,
          },
        ]}
      />

      <AddSleepPlaceDialog
        chrome={chrome}
        visible={addingPlace}
        onDismiss={() => setAddingPlace(false)}
        onAdd={onAddSleepLocation}
      />
    </NursingPage>
  );
}
