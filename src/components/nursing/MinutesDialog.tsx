import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';
import type { NursingChrome } from './NursingChrome';
import { formatNursingDuration } from '../../utils/breastFeed';

/**
 * Types a length in minutes, for when the length is what was remembered rather
 * than a clock time — how long a sleep lasted, or how long one side really ran.
 */
export default function MinutesDialog({
  chrome,
  visible,
  title,
  label = 'Minutes',
  minutes,
  minMinutes = 1,
  maxMinutes,
  onDismiss,
  onSave,
}: {
  chrome: NursingChrome;
  visible: boolean;
  title: string;
  label?: string;
  minutes: number;
  /** Zero where "none at all" is a real answer, such as one side of a feed. */
  minMinutes?: number;
  /** The longest this could have been, for the error to name. */
  maxMinutes: number;
  onDismiss: () => void;
  onSave: (minutes: number) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setValue(String(Math.max(0, minutes)));
    setError('');
  }, [visible, minutes]);

  const parsed = Number(value.trim());
  const valid =
    value.trim() !== '' &&
    Number.isInteger(parsed) &&
    parsed >= minMinutes &&
    parsed <= maxMinutes;

  const submit = () => {
    if (!valid) {
      setError(`Enter whole minutes between ${minMinutes} and ${maxMinutes}.`);
      return;
    }
    onSave(parsed);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Surface style={[styles.sheet, { backgroundColor: chrome.flat.bgCard }]} elevation={5}>
          <Text variant="titleMedium" style={[styles.title, { color: chrome.flat.textPrimary }]}>
            {title}
          </Text>
          <TextInput
            mode="outlined"
            label={label}
            value={value}
            onChangeText={next => {
              setValue(next.replace(/[^0-9]/g, ''));
              setError('');
            }}
            keyboardType="number-pad"
            autoFocus
            style={styles.input}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          {error ? (
            <HelperText type="error">{error}</HelperText>
          ) : valid ? (
            <HelperText type="info">{formatNursingDuration(parsed * 60)}</HelperText>
          ) : null}
          <View style={styles.actions}>
            <Button mode="text" onPress={onDismiss}>
              Cancel
            </Button>
            <Button mode="contained" onPress={submit}>
              Set
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
  },
  sheet: { borderRadius: 20, padding: 18, gap: 4 },
  title: { fontWeight: '800' },
  input: { marginTop: 12 },
  actions: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
