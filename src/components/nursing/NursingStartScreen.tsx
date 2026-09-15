import { useState } from 'react';
import { formatTimerSeconds } from '../../utils/feedTiming';
import NursingStartTimeFields from './NursingStartTimeFields';
import {
  NursingBottomRow,
  NursingError,
  NursingHeader,
  NursingPage,
  NursingPrimaryAction,
  NursingSideCard,
  NursingSideRow,
  NursingSpacer,
  NursingTotal,
  useNursingChrome,
} from './NursingChrome';

interface NursingStartScreenProps {
  /** The side used last, offered as the one-tap start. */
  defaultBreastSide?: 'left' | 'right';
  onClose: () => void;
  onManualEntry: (startTime?: Date) => void;
  onStart: (side: 'left' | 'right', startTime?: Date) => Promise<void>;
}

const SIDES = ['left', 'right'] as const;
const sideLabel = (side: 'left' | 'right') =>
  side === 'left' ? 'Left' : 'Right';

/**
 * Starting a feed, in the running timer's clothes.
 *
 * The same two side cards land in the same place they will occupy once the
 * timer is running, so the tap that starts a feed and the tap that switches
 * sides are the same reach.
 */
export default function NursingStartScreen({
  defaultBreastSide,
  onClose,
  onManualEntry,
  onStart,
}: NursingStartScreenProps) {
  const chrome = useNursingChrome();
  const [startTime, setStartTime] = useState(() => new Date());
  const [startTimeEdited, setStartTimeEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async (side: 'left' | 'right') => {
    setBusy(true);
    setError('');
    try {
      await onStart(side, startTimeEdited ? startTime : new Date());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to start the nursing timer.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <NursingPage chrome={chrome} accessibilityLabel="Start nursing">
      <NursingHeader
        chrome={chrome}
        title="Nursing"
        icon="mother-nurse"
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

      <NursingTotal
        chrome={chrome}
        value={formatTimerSeconds(0)}
        caption="Total"
      />

      <NursingSpacer />

      <NursingSideRow>
        {SIDES.map(side => {
          const lastUsed = defaultBreastSide === side;
          return (
            <NursingSideCard
              key={side}
              chrome={chrome}
              side={side}
              label={sideLabel(side)}
              value={formatTimerSeconds(0)}
              pillText="Tap to start"
              lastUsed={lastUsed}
              disabled={busy}
              onPress={() => void start(side)}
              accessibilityLabel={`Start nursing on the ${side} side${
                lastUsed ? ', the side used last' : ''
              }`}
            />
          );
        })}
      </NursingSideRow>

      <NursingError chrome={chrome} message={error} />

      <NursingSpacer />

      <NursingPrimaryAction
        chrome={chrome}
        label="Manual entry"
        onPress={() => onManualEntry(startTimeEdited ? startTime : undefined)}
        disabled={busy}
        accessibilityLabel="Enter a finished feed by hand"
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
    </NursingPage>
  );
}
