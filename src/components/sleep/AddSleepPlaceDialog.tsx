import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';
import type { NursingChrome } from '../nursing/NursingChrome';
import { SLEEP_LABEL_MAX_LENGTH } from '../../utils/sleepLocation';

/**
 * Names a new sleep place.
 *
 * Deliberately a plain dialog in the sleep palette rather than a whole screen:
 * it is a single field, and losing the sleep screen behind it would mean
 * finding your way back to what you were doing.
 */
export default function AddSleepPlaceDialog({
  chrome,
  visible,
  onDismiss,
  onAdd,
}: {
  chrome: NursingChrome;
  visible: boolean;
  onDismiss: () => void;
  onAdd: (label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLabel('');
    setError('');
  }, [visible]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onAdd(label);
      onDismiss();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message.includes('permission-denied')
            ? 'Your account could not save this place. Please try again later.'
            : nextError.message
          : 'Unable to add this sleep place.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Surface
          style={[styles.sheet, { backgroundColor: chrome.flat.bgCard }]}
          elevation={5}
        >
          <Text
            variant="titleMedium"
            style={[styles.title, { color: chrome.flat.textPrimary }]}
          >
            Add a sleep place
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: chrome.flat.textSecondary }}
          >
            It joins the other places everywhere sleep is logged.
          </Text>

          <TextInput
            mode="outlined"
            label="Name"
            value={label}
            onChangeText={value => {
              setLabel(value);
              setError('');
            }}
            maxLength={SLEEP_LABEL_MAX_LENGTH}
            autoFocus
            disabled={saving}
            placeholder="Nan’s house"
            style={styles.input}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
          />

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <View style={styles.actions}>
            <Button mode="text" onPress={onDismiss} disabled={saving}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => void submit()}
              loading={saving}
              disabled={saving}
            >
              Add
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
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
