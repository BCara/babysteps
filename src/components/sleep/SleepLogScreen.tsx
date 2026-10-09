import { useState } from 'react';
import ContextualVoiceButton from '../ContextualVoiceButton';
import type { VoiceEntryValues } from '../../utils/voiceCommand';
import {
  NursingBottomRow,
  NursingError,
  NursingHeader,
  NursingHint,
  NursingPage,
  NursingPrimaryAction,
  useActivityChrome,
  type NursingBottomAction,
} from '../nursing/NursingChrome';
import { NursingScroll, NursingTextField } from '../nursing/NursingFields';
import NursingStartTimeFields from '../nursing/NursingStartTimeFields';
import SleepLocationPicker from './SleepLocationPicker';
import AddSleepPlaceDialog from './AddSleepPlaceDialog';
import SleepSettlingFields from './SleepSettlingFields';
import {
  sleepLocationDefinitions,
  type CustomSleepLocation,
  type SleepType,
} from '../../utils/sleepLocation';
import type { SettlingDifficulty } from '../../utils/sleepSettling';

interface SleepLogScreenProps {
  /** True when this is the running sleep being written down rather than a new one. */
  editingTimer: boolean;
  startTime: Date;
  onStartTimeChange: (next: Date) => void;
  endTime: Date;
  onEndTimeChange: (next: Date) => void;
  durationMinutes: string;
  onDurationChange: (value: string) => void;
  sleepType?: SleepType;
  onSleepTypeChange: (next: SleepType | undefined) => void;
  customSleepLocations: CustomSleepLocation[];
  onAddSleepLocation: (label: string) => Promise<void>;
  settlingMinutes: string;
  onSettlingMinutesChange: (value: string) => void;
  settlingDifficulty?: SettlingDifficulty;
  onSettlingDifficultyChange: (next: SettlingDifficulty | undefined) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onVoiceFill: (values: VoiceEntryValues) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

/**
 * Writing a sleep down by hand — the manual entry, and the timer's "Edit times".
 *
 * Start, end and duration all appear because a caregiver knows different ones
 * on different occasions: sometimes "she went down at seven", sometimes "that
 * was about forty minutes". Editing any one recalculates the others.
 */
export default function SleepLogScreen({
  editingTimer,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  durationMinutes,
  onDurationChange,
  sleepType,
  onSleepTypeChange,
  customSleepLocations,
  onAddSleepLocation,
  settlingMinutes,
  onSettlingMinutesChange,
  settlingDifficulty,
  onSettlingDifficultyChange,
  notes,
  onNotesChange,
  onVoiceFill,
  error,
  saving,
  onSave,
  onClose,
}: SleepLogScreenProps) {
  const chrome = useActivityChrome('sleep');
  const [addingPlace, setAddingPlace] = useState(false);

  const bottomActions: NursingBottomAction[] = [
    ...(editingTimer
      ? [
          {
            key: 'timer',
            icon: 'arrow-left',
            label: 'Back to timer',
            onPress: onClose,
            disabled: saving,
          },
        ]
      : []),
    {
      key: 'cancel',
      icon: 'close',
      label: 'Cancel',
      onPress: onClose,
      muted: true,
      disabled: saving,
    },
  ];

  return (
    <NursingPage
      chrome={chrome}
      accessibilityLabel={editingTimer ? 'Edit sleep times' : 'Log sleep'}
    >
      <NursingHeader
        chrome={chrome}
        title={editingTimer ? 'Edit times' : 'Log sleep'}
        icon="sleep"
        onBack={onClose}
        backLabel={editingTimer ? 'Back to timer' : 'Close'}
      />

      <NursingScroll>
        <ContextualVoiceButton
          context="sleep"
          onFill={onVoiceFill}
          disabled={saving}
          iconColor={chrome.flat.accent}
          containerColor={chrome.flat.bgCard}
          messageColor={chrome.flat.textSecondary}
        />

        <NursingHint chrome={chrome}>
          Enter any two values; the third is calculated. The two you edited most
          recently stay fixed.
        </NursingHint>
        <NursingHint chrome={chrome}>Started</NursingHint>
        <NursingStartTimeFields
          chrome={chrome}
          label="Started"
          value={startTime}
          onChange={onStartTimeChange}
          disabled={saving}
        />
        <NursingTextField
          chrome={chrome}
          label="Duration � minutes"
          value={durationMinutes}
          onChangeText={onDurationChange}
          disabled={saving}
          accessibilityLabel="Sleep duration in minutes"
        />
        <NursingHint chrome={chrome}>Ended</NursingHint>
        <NursingStartTimeFields
          chrome={chrome}
          label="Ended"
          value={endTime}
          onChange={onEndTimeChange}
          disabled={saving}
        />

        <SleepLocationPicker
          chrome={chrome}
          definitions={sleepLocationDefinitions(customSleepLocations)}
          value={sleepType}
          onChange={onSleepTypeChange}
          onAdd={() => setAddingPlace(true)}
          disabled={saving}
        />

        <SleepSettlingFields
          chrome={chrome}
          minutes={settlingMinutes}
          onMinutesChange={onSettlingMinutesChange}
          difficulty={settlingDifficulty}
          onDifficultyChange={onSettlingDifficultyChange}
          disabled={saving}
        />

        <NursingTextField
          chrome={chrome}
          label="Notes (optional)"
          value={notes}
          onChangeText={onNotesChange}
          keyboardType="default"
          multiline
          disabled={saving}
        />

        <NursingError chrome={chrome} message={error} />
      </NursingScroll>

      <NursingPrimaryAction
        chrome={chrome}
        pressKey="save"
        label={saving ? 'Saving…' : 'Save sleep'}
        onPress={onSave}
        disabled={saving}
      />

      <NursingBottomRow chrome={chrome} actions={bottomActions} />

      <AddSleepPlaceDialog
        chrome={chrome}
        visible={addingPlace}
        onDismiss={() => setAddingPlace(false)}
        onAdd={onAddSleepLocation}
      />
    </NursingPage>
  );
}
