import { useState } from 'react';
import { useAppearance } from '../providers/AppearanceProvider';
import { formatTimerSeconds } from '../utils/feedTiming';
import NursingStartTimeFields from './nursing/NursingStartTimeFields';
import MinutesDialog from './nursing/MinutesDialog';
import { TIMER_LIMIT_MINUTES } from '../utils/timerLimits';
import {
  NursingActionRow,
  NursingHeader,
  NursingPage,
  NursingPrimaryAction,
  NursingSideCard,
  NursingSideRow,
  NursingSpacer,
  NursingTotal,
  NursingTotalSlot,
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
  /** Corrects one side's time mid-feed; the other side keeps counting. */
  onSetSideSeconds?: (side: 'left' | 'right', seconds: number) => void;
  /** Writes down a feed from earlier without touching the one running. */
  onAddEarlier?: () => void;
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
  onSetSideSeconds,
  onAddEarlier,
  onDiscard,
  onChangeStartTime,
}: NursingTimerScreenProps) {
  const { mode } = useAppearance();
  const chrome = useNursingChrome();
  const [editingSide, setEditingSide] = useState<'left' | 'right' | null>(null);



  const totalSeconds = leftSeconds + rightSeconds;

  return (
    <NursingPage
      chrome={chrome}
      // Fixed slots above the cards: a short screen scrolls rather than squeezing.
      scrollable
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

      <NursingTotalSlot>
        <NursingTotal
          chrome={chrome}
          value={formatTimerSeconds(totalSeconds)}
          caption="Total"
        />
      </NursingTotalSlot>

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
              onEditTime={onSetSideSeconds ? () => setEditingSide(side) : undefined}
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
          ...(onAddEarlier
            ? [
                {
                  key: 'add',
                  icon: 'clock-plus-outline',
                  label: 'Add earlier',
                  onPress: onAddEarlier,
                  disabled: busy,
                  accessibilityLabel: 'Add a feed from earlier',
                },
              ]
            : []),
          {
            key: 'discard',
            icon: 'trash-can-outline',
            label: 'Discard',
            // The host confirms before anything is deleted.
            onPress: onDiscard,
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
      <MinutesDialog
        chrome={chrome}
        visible={editingSide !== null}
        title={`How long on the ${editingSide ?? 'left'} side?`}
        label="Minutes on this side"
        minutes={Math.round(
          (editingSide === 'right' ? rightSeconds : leftSeconds) / 60,
        )}
        minMinutes={0}
        maxMinutes={TIMER_LIMIT_MINUTES.feed}
        onDismiss={() => setEditingSide(null)}
        onSave={minutes => {
          if (editingSide) onSetSideSeconds?.(editingSide, minutes * 60);
        }}
      />
    </NursingPage>
  );
}
