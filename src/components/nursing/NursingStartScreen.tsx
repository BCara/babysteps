import { useState } from 'react';
import { formatTimerSeconds } from '../../utils/feedTiming';
import NursingStartTimeFields from './NursingStartTimeFields';
import {
  NursingBottomRow,
  NursingError,
  NursingHeader,
  NursingOr,
  NursingPage,
  NursingSecondaryAction,
  NursingSideCard,
  NursingSideRow,
  NursingSpacer,
  NursingTotal,
  NursingTotalSlot,
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
 * Starting a feed.
 *
 * The two side cards are the start: a tap picks the side and runs the timer.
 * They lead, and the start time sits above them as optional detail. Manual
 * entry stays behind an "or", pushed down to sit with Close — it is the way
 * out of this screen rather than a third thing to weigh up against the sides.
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
    <NursingPage chrome={chrome} scrollable accessibilityLabel="Start nursing">
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

      <NursingTotalSlot>
        <NursingTotal chrome={chrome} value={formatTimerSeconds(0)} caption="Total" />
      </NursingTotalSlot>

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

      <NursingOr chrome={chrome} />

      <NursingSecondaryAction
        chrome={chrome}
        pressKey="manual"
        label="Log nursing manually"
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
