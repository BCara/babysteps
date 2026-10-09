import { SafeAreaView } from 'react-native-safe-area-context';
import ContextualVoiceButton from '../ContextualVoiceButton';
import type { VoiceEntryValues } from '../../utils/voiceCommand';
import {
  NursingBottomRow,
  NursingError,
  NursingHeader,
  NursingPage,
  NursingPrimaryAction,
  useNursingChrome,
  type NursingBottomAction,
} from './NursingChrome';
import {
  NursingChoice,
  NursingFieldHalf,
  NursingFieldRow,
  NursingScroll,
  NursingTextField,
} from './NursingFields';
import NursingStartTimeFields from './NursingStartTimeFields';

interface NursingEditScreenProps {
  startTime: Date;
  onStartTimeChange: (next: Date) => void;
  totalMinutes: string;
  onTotalMinutesChange: (value: string) => void;
  leftMinutes: string;
  rightMinutes: string;
  onSideMinutesChange: (side: 'left' | 'right', value: string) => void;
  /** Which side the feed ended on. Only asked when both sides were used. */
  finishedOn?: {
    value: 'left' | 'right';
    onChange: (side: 'left' | 'right') => void;
  };
  notes: string;
  onNotesChange: (value: string) => void;
  onVoiceFill: (values: VoiceEntryValues) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

/**
 * Editing a nursing feed that has already been saved.
 *
 * The same form as the manual entry, plus the question only a finished feed
 * raises: which side it ended on.
 */
export default function NursingEditScreen({
  startTime,
  onStartTimeChange,
  totalMinutes,
  onTotalMinutesChange,
  leftMinutes,
  rightMinutes,
  onSideMinutesChange,
  finishedOn,
  notes,
  onNotesChange,
  onVoiceFill,
  error,
  saving,
  onSave,
  onClose,
  onDelete,
}: NursingEditScreenProps) {
  const chrome = useNursingChrome();

  const bottomActions: NursingBottomAction[] = [
    ...(onDelete
      ? [
          {
            key: 'delete',
            icon: 'trash-can-outline',
            label: 'Delete',
            onPress: onDelete,
            danger: true,
            disabled: saving,
            accessibilityLabel: 'Delete this feed',
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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: chrome.flat.bgPage }}
      edges={['top', 'bottom']}
    >
      <NursingPage chrome={chrome} accessibilityLabel="Edit nursing feed">
        <NursingHeader
          chrome={chrome}
          title="Edit nursing"
          icon="mother-nurse"
          onBack={onClose}
          backLabel="Close"
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
            label="When it happened"
            value={startTime}
            onChange={onStartTimeChange}
            disabled={saving}
          />

          <NursingTextField
            chrome={chrome}
            label="Total · minutes"
            value={totalMinutes}
            onChangeText={onTotalMinutesChange}
            disabled={saving}
            accessibilityLabel="Total nursing minutes"
          />

          <NursingFieldRow>
            <NursingFieldHalf>
              <NursingTextField
                chrome={chrome}
                label="Left · minutes"
                value={leftMinutes}
                onChangeText={value => onSideMinutesChange('left', value)}
                disabled={saving}
                accessibilityLabel="Minutes on the left side"
              />
            </NursingFieldHalf>
            <NursingFieldHalf>
              <NursingTextField
                chrome={chrome}
                label="Right · minutes"
                value={rightMinutes}
                onChangeText={value => onSideMinutesChange('right', value)}
                disabled={saving}
                accessibilityLabel="Minutes on the right side"
              />
            </NursingFieldHalf>
          </NursingFieldRow>

          {finishedOn ? (
            <NursingChoice
              chrome={chrome}
              label="Finished on"
              value={finishedOn.value}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={finishedOn.onChange}
              disabled={saving}
            />
          ) : null}

          <NursingTextField
            chrome={chrome}
            label="Notes"
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
          label={saving ? 'Saving…' : 'Save changes'}
          onPress={onSave}
          disabled={saving}
        />

        <NursingBottomRow
          chrome={chrome}
          align={onDelete ? 'space-between' : 'center'}
          actions={bottomActions}
        />
      </NursingPage>
    </SafeAreaView>
  );
}
