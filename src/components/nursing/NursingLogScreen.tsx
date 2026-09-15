import ContextualVoiceButton from '../ContextualVoiceButton';
import type { VoiceEntryValues } from '../../utils/voiceCommand';
import {
  NursingBottomRow,
  NursingError,
  NursingHeader,
  NursingHint,
  NursingPage,
  NursingPrimaryAction,
  useNursingChrome,
  type NursingBottomAction,
} from './NursingChrome';
import {
  NursingFieldHalf,
  NursingFieldRow,
  NursingScroll,
  NursingTextField,
} from './NursingFields';
import NursingStartTimeFields from './NursingStartTimeFields';

interface NursingLogScreenProps {
  /** True when this is the running feed being written down rather than a new one. */
  editingTimer: boolean;
  startTime: Date;
  onStartTimeChange: (next: Date) => void;
  totalMinutes: string;
  leftMinutes: string;
  rightMinutes: string;
  onMinutesChange: (field: 'total' | 'left' | 'right', value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onVoiceFill: (values: VoiceEntryValues) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

/**
 * Writing a nursing feed down by hand — the manual entry, and the timer's
 * "Edit times".
 *
 * The fields scroll; the header and the save action do not, so the button a
 * caregiver is reaching for stays where it was before the keyboard opened.
 */
export default function NursingLogScreen({
  editingTimer,
  startTime,
  onStartTimeChange,
  totalMinutes,
  leftMinutes,
  rightMinutes,
  onMinutesChange,
  notes,
  onNotesChange,
  onVoiceFill,
  error,
  saving,
  onSave,
  onClose,
}: NursingLogScreenProps) {
  const chrome = useNursingChrome();

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
      accessibilityLabel={editingTimer ? 'Edit nursing times' : 'Log nursing'}
    >
      <NursingHeader
        chrome={chrome}
        title={editingTimer ? 'Edit times' : 'Log nursing'}
        icon="mother-nurse"
        eyebrow="NURSING"
        onBack={onClose}
        backLabel={editingTimer ? 'Back to timer' : 'Close'}
      />

      <NursingScroll>
        <ContextualVoiceButton
          context="nursing"
          onFill={onVoiceFill}
          disabled={saving}
          iconColor={chrome.flat.accent}
          containerColor={chrome.flat.bgCard}
          messageColor={chrome.flat.textSecondary}
        />

        <NursingStartTimeFields
          chrome={chrome}
          label="Started"
          value={startTime}
          onChange={onStartTimeChange}
          disabled={saving}
        />

        <NursingHint chrome={chrome}>
          Enter any two times. The third is calculated from the two you edited
          most recently.
        </NursingHint>

        <NursingTextField
          chrome={chrome}
          label="Total · minutes"
          value={totalMinutes}
          onChangeText={value => onMinutesChange('total', value)}
          disabled={saving}
          accessibilityLabel="Total nursing minutes"
        />

        <NursingFieldRow>
          <NursingFieldHalf>
            <NursingTextField
              chrome={chrome}
              label="Left · minutes"
              value={leftMinutes}
              onChangeText={value => onMinutesChange('left', value)}
              disabled={saving}
              accessibilityLabel="Minutes on the left side"
            />
          </NursingFieldHalf>
          <NursingFieldHalf>
            <NursingTextField
              chrome={chrome}
              label="Right · minutes"
              value={rightMinutes}
              onChangeText={value => onMinutesChange('right', value)}
              disabled={saving}
              accessibilityLabel="Minutes on the right side"
            />
          </NursingFieldHalf>
        </NursingFieldRow>

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
        label={saving ? 'Saving…' : 'Save nursing'}
        onPress={onSave}
        disabled={saving}
      />

      <NursingBottomRow chrome={chrome} actions={bottomActions} />
    </NursingPage>
  );
}
