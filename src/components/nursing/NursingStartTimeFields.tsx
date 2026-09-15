import { useState } from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { resolveEventPickerTime } from '../../utils/eventEditing';
import {
  NursingFieldCard,
  NursingPrimaryAction,
  type NursingChrome,
} from './NursingChrome';
import { NursingFieldHalf, NursingFieldRow } from './NursingFields';
import { formatNursingDate, formatNursingTime } from './startTime';

interface Props {
  chrome: NursingChrome;
  value: Date;
  onChange: (next: Date) => void;
  /** "Start time" on the timer, "When it happened" on a saved feed. */
  label?: string;
  disabled?: boolean;
  allowFuture?: boolean;
}

/**
 * The date and the time, side by side, each opening the platform's own picker.
 *
 * The same control the rest of the app uses for event times, rather than a
 * bespoke one to learn at 3am: the date opens a calendar, the time opens a
 * clock, and a date that is already right needs no interaction at all.
 */
export default function NursingStartTimeFields({
  chrome,
  value,
  onChange,
  label = 'Start time',
  disabled = false,
  allowFuture = false,
}: Props) {
  // iOS shows the picker inline, so it gets a sheet of its own and a draft to
  // confirm. Android opens its own dialog and needs neither.
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState(value);

  const clamp = (next: Date) =>
    !allowFuture && next.getTime() > Date.now() ? new Date() : next;

  const commit = (mode: 'date' | 'time', selected: Date) =>
    onChange(clamp(resolveEventPickerTime(value, selected, mode, allowFuture)));

  const handleAndroidChange = (
    mode: 'date' | 'time',
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (event.type === 'dismissed' || !selected) return;
    commit(mode, selected);
  };

  const openPicker = (mode: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        ...(mode === 'date' && !allowFuture ? { maximumDate: new Date() } : {}),
        onChange: (event, selected) =>
          handleAndroidChange(mode, event, selected),
      });
      return;
    }
    setDraft(value);
    setPicker(mode);
  };

  return (
    <>
      <NursingFieldRow>
        <NursingFieldHalf>
          <NursingFieldCard
            chrome={chrome}
            pressKey="date"
            label="Date"
            value={formatNursingDate(value)}
            disabled={disabled}
            onPress={() => openPicker('date')}
            accessibilityLabel={`${label} date, ${formatNursingDate(value)}`}
            accessibilityHint="Opens the date picker"
          />
        </NursingFieldHalf>
        <NursingFieldHalf>
          <NursingFieldCard
            chrome={chrome}
            pressKey="time"
            label="Time"
            value={formatNursingTime(value)}
            disabled={disabled}
            onPress={() => openPicker('time')}
            accessibilityLabel={`${label}, ${formatNursingTime(value)}`}
            accessibilityHint="Opens the time picker"
          />
        </NursingFieldHalf>
      </NursingFieldRow>

      <Modal
        visible={picker !== null && Platform.OS !== 'android'}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.overlayHost}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPicker(null)}
            accessibilityRole="button"
            accessibilityLabel="Close without changing the time"
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.scrim,
                { backgroundColor: chrome.tokens.bgPage },
              ]}
            />
          </Pressable>

          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: chrome.tokens.bgCard,
                borderColor: chrome.tokens.borderControl,
              },
            ]}
          >
            <Animated.Text
              style={[styles.sheetLabel, { color: chrome.tokens.textSecondary }]}
            >
              {label}
            </Animated.Text>
            {picker ? (
              <DateTimePicker
                value={draft}
                mode={picker}
                display="spinner"
                themeVariant="dark"
                {...(picker === 'date' && !allowFuture
                  ? { maximumDate: new Date() }
                  : {})}
                onChange={(_event, selected) => selected && setDraft(selected)}
              />
            ) : null}
            <NursingPrimaryAction
              chrome={chrome}
              pressKey="apply-time"
              label="Done"
              onPress={() => {
                if (picker) commit(picker, draft);
                setPicker(null);
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlayHost: { flex: 1, justifyContent: 'center', padding: 16 },
  scrim: { opacity: 0.92 },
  sheet: { borderRadius: 16, borderWidth: 0.5, padding: 16, gap: 12 },
  sheetLabel: { fontSize: 12, fontWeight: '400' },
});
