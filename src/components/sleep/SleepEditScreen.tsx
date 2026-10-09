import { SafeAreaView } from 'react-native-safe-area-context';
import ContextualVoiceButton from '../ContextualVoiceButton';
import type { VoiceEntryValues } from '../../utils/voiceCommand';
import { sleepLocationDefinitions, type CustomSleepLocation, type SleepType } from '../../utils/sleepLocation';
import {
  NursingBottomRow, NursingError, NursingHeader, NursingHint, NursingPage,
  NursingPrimaryAction, useActivityChrome, type NursingBottomAction,
} from '../nursing/NursingChrome';
import { NursingScroll, NursingTextField } from '../nursing/NursingFields';
import NursingStartTimeFields from '../nursing/NursingStartTimeFields';
import SleepLocationPicker from './SleepLocationPicker';
import SleepSettlingFields from './SleepSettlingFields';
import type { SettlingDifficulty } from '../../utils/sleepSettling';

interface Props {
  startTime: Date;
  endTime?: Date;
  onStartTimeChange: (next: Date) => void;
  onEndTimeChange: (next: Date) => void;
  duration: string;
  onDurationChange: (next: string) => void;
  sleepType: SleepType;
  onSleepTypeChange: (next: SleepType) => void;
  customSleepLocations: CustomSleepLocation[];
  settlingMinutes: string;
  onSettlingMinutesChange: (value: string) => void;
  settlingDifficulty?: SettlingDifficulty;
  onSettlingDifficultyChange: (next: SettlingDifficulty | undefined) => void;
  notes: string;
  onNotesChange: (next: string) => void;
  onVoiceFill: (values: VoiceEntryValues) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

/** The saved-sleep editor uses the same blue activity chrome as the timer. */
export default function SleepEditScreen(props: Props) {
  const chrome = useActivityChrome('sleep');
  const actions: NursingBottomAction[] = [
    ...(props.onDelete ? [{
      key: 'delete', icon: 'trash-can-outline', label: 'Delete', danger: true,
      onPress: props.onDelete, disabled: props.saving,
      accessibilityLabel: 'Delete this sleep',
    }] : []),
    { key: 'cancel', icon: 'close', label: 'Cancel', muted: true,
      onPress: props.onClose, disabled: props.saving },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: chrome.flat.bgPage }} edges={['top', 'bottom']}>
      <NursingPage chrome={chrome} accessibilityLabel="Edit sleep">
        <NursingHeader chrome={chrome} title="Edit sleep" icon="sleep"
          onBack={props.onClose} backLabel="Close" />
        <NursingScroll>
          <ContextualVoiceButton context="sleep" onFill={props.onVoiceFill} disabled={props.saving}
            iconColor={chrome.flat.accent} containerColor={chrome.flat.bgCard}
            messageColor={chrome.flat.textSecondary} />
          <NursingStartTimeFields chrome={chrome} label="Sleep started" value={props.startTime}
            onChange={props.onStartTimeChange} disabled={props.saving} />
          {props.endTime ? <NursingStartTimeFields chrome={chrome} label="Sleep ended" value={props.endTime}
            onChange={props.onEndTimeChange} disabled={props.saving} /> : null}
          <NursingHint chrome={chrome}>Sleep location</NursingHint>
          <SleepLocationPicker chrome={chrome} definitions={sleepLocationDefinitions(props.customSleepLocations)}
            value={props.sleepType} onChange={next => props.onSleepTypeChange(next || [])} disabled={props.saving} />
          <NursingTextField chrome={chrome} label="Duration in minutes" value={props.duration}
            onChangeText={props.onDurationChange} disabled={props.saving} />
          <SleepSettlingFields chrome={chrome} minutes={props.settlingMinutes}
            onMinutesChange={props.onSettlingMinutesChange}
            difficulty={props.settlingDifficulty}
            onDifficultyChange={props.onSettlingDifficultyChange} disabled={props.saving} />
          <NursingTextField chrome={chrome} label="Notes" value={props.notes}
            onChangeText={props.onNotesChange} keyboardType="default" multiline disabled={props.saving} />
          <NursingError chrome={chrome} message={props.error} />
        </NursingScroll>
        <NursingPrimaryAction chrome={chrome} pressKey="save" label={props.saving ? 'Saving...' : 'Save changes'}
          onPress={props.onSave} disabled={props.saving} />
        <NursingBottomRow chrome={chrome} align={props.onDelete ? 'space-between' : 'center'} actions={actions} />
      </NursingPage>
    </SafeAreaView>
  );
}
