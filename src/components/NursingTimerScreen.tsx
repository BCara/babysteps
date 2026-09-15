import { Alert, Platform } from 'react-native';
import { useAppearance } from '../providers/AppearanceProvider';
import { formatTimerSeconds } from '../utils/feedTiming';
import NursingStartTimeFields from './nursing/NursingStartTimeFields';
import {
  NursingActionRow,
  NursingHeader,
  NursingPage,
  NursingPrimaryAction,
  NursingSideCard,
  NursingSideRow,
  NursingSpacer,
  NursingTotal,
  useNursingChrome,
} from './nursing/NursingChrome';

export interface NursingTimerScreenProps {
  startTime: Date;
  leftSeconds: number;
  rightSeconds: number;
  /** The side currently running, or an empty string when the feed is paused. */
  activeSide: 'left' | 'right' | '';
  paused: boolean;
  /** The side the previous feed finished on, marked as a starting hint. */
  previousFeedSide?: 'left' | 'right';
  sleepSessionActive?: boolean;
  busy?: boolean;
  onBack: () => void;
  onPause: () => void;
  onSwitchSide: (side: 'left' | 'right') => void;
  onFinish: () => void;
  onEditTimes: () => void;
  onDiscard: () => void;
  onChangeStartTime?: (startTime: Date) => void;
}

const SIDES = ['left', 'right'] as const;

export default function NursingTimerScreen({
  startTime,
  leftSeconds,
  rightSeconds,
  activeSide,
  paused,
  previousFeedSide,
  busy = false,
  onBack,
  onPause,
  onSwitchSide,
  onFinish,
  onEditTimes,
  onDiscard,
  onChangeStartTime,
}: NursingTimerScreenProps) {
  const { mode } = useAppearance();
  const chrome = useNursingChrome();



  const totalSeconds = leftSeconds + rightSeconds;

  const confirmDiscard = () =>
    Alert.alert(
      'Discard this feed?',
      'The timer and both side totals will be deleted. This cannot be undone.',
      [
        { text: 'Keep feeding', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ],
    );

  return (
    <NursingPage
      chrome={chrome}
      accessibilityLabel={`Nursing timer, ${mode} brightness`}
    >
      <NursingHeader
        chrome={chrome}
        title="Nursing"
        icon="mother-nurse"
        onBack={onBack}
        backLabel="Home"
      />

      <NursingStartTimeFields
        chrome={chrome}
        value={startTime}
        onChange={onChangeStartTime ?? (() => undefined)}
        disabled={busy || !onChangeStartTime}
      />

      <NursingSpacer />

      <NursingTotal
        chrome={chrome}
        value={formatTimerSeconds(totalSeconds)}
        caption="Total"
      />

      <NursingSpacer />

      <NursingSideRow>
        {SIDES.map(side => {
          const isActive = activeSide === side;
          const seconds = side === 'left' ? leftSeconds : rightSeconds;
          const label = side === 'left' ? 'Left' : 'Right';
          const pillText = isActive
            ? 'Tap to pause'
            : paused
              ? 'Tap to resume'
              : 'Tap to switch';
          return (
            <NursingSideCard
              key={side}
              chrome={chrome}
              side={side}
              label={label}
              value={formatTimerSeconds(seconds)}
              pillText={pillText}
              active={isActive}
              lastUsed={previousFeedSide === side}
              disabled={busy}
              onPress={() => (isActive ? onPause() : onSwitchSide(side))}
              accessibilityLabel={`${label} side, ${formatTimerSeconds(
                seconds,
              )}. ${pillText}.`}
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
            label: 'Edit times',
            onPress: onEditTimes,
            disabled: busy,
          },
          {
            key: 'discard',
            icon: 'trash-can-outline',
            label: 'Discard',
            onPress: confirmDiscard,
            danger: true,
            disabled: busy,
            accessibilityLabel: 'Discard this feed',
          },
        ]}
      />

      <NursingPrimaryAction
        chrome={chrome}
        pressKey="finish"
        label="Finish nursing"
        onPress={onFinish}
        disabled={busy}
      />
    </NursingPage>
  );
}
