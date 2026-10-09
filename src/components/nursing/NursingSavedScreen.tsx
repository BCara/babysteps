import { formatNursingDuration } from '../../utils/breastFeed';
import { formatNursingStartTime } from './startTime';
import {
  NursingActionRow,
  NursingFieldCard,
  NursingHeader,
  NursingPage,
  NursingPrimaryAction,
  NursingSideCard,
  NursingSideRow,
  NursingSpacer,
  NursingTotal,
  useNursingChrome,
} from './NursingChrome';

interface NursingSavedScreenProps {
  startTime: Date;
  leftSeconds: number;
  rightSeconds: number;
  busy?: boolean;
  /** Reopens the saved feed on that side and keeps timing it. */
  onContinue: (side: 'left' | 'right') => void;
  onDone: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}

const SIDES = ['left', 'right'] as const;

/**
 * The feed just saved.
 *
 * Same shape as the running timer so the screen does not appear to change
 * under a caregiver's thumb when the feed ends — only the pills and the
 * primary action say something different.
 */
export default function NursingSavedScreen({
  startTime,
  leftSeconds,
  rightSeconds,
  busy = false,
  onContinue,
  onDone,
  onEdit,
  onDiscard,
}: NursingSavedScreenProps) {
  const chrome = useNursingChrome();
  const totalSeconds = leftSeconds + rightSeconds;

  return (
    <NursingPage chrome={chrome} accessibilityLabel="Nursing feed saved">
      <NursingHeader
        chrome={chrome}
        title="Feed saved"
        icon="mother-nurse"
        onBack={onDone}
        backLabel="Done"
      />

      <NursingFieldCard
        chrome={chrome}
        pressKey="start"
        icon="calendar"
        label="Start time"
        value={formatNursingStartTime(startTime)}
        trailingIcon={null}
      />

      <NursingSpacer />

      <NursingTotal
        chrome={chrome}
        value={formatNursingDuration(totalSeconds)}
        caption="Saved"
      />

      <NursingSpacer />

      <NursingSideRow>
        {SIDES.map(side => {
          const seconds = side === 'left' ? leftSeconds : rightSeconds;
          const label = side === 'left' ? 'Left' : 'Right';
          return (
            <NursingSideCard
              key={side}
              chrome={chrome}
              side={side}
              label={label}
              value={formatNursingDuration(seconds)}
              pillText="Tap to continue"
              disabled={busy}
              onPress={() => onContinue(side)}
              accessibilityLabel={`${label} side, ${formatNursingDuration(
                seconds,
              )}. Tap to continue this feed on the ${side}.`}
            />
          );
        })}
      </NursingSideRow>

      <NursingSpacer />

      <NursingActionRow
        chrome={chrome}
        divider
        actions={[
          {
            key: 'edit',
            icon: 'pencil',
            label: 'Edit nursing',
            onPress: onEdit,
            disabled: busy,
          },
          {
            key: 'discard',
            icon: 'trash-can-outline',
            label: 'Discard',
            // The host confirms before anything is deleted.
            onPress: onDiscard,
            danger: true,
            disabled: busy,
            accessibilityLabel: 'Discard this saved feed',
          },
        ]}
      />

      <NursingPrimaryAction
        chrome={chrome}
        pressKey="done"
        label="Done"
        onPress={onDone}
        disabled={busy}
      />
    </NursingPage>
  );
}
