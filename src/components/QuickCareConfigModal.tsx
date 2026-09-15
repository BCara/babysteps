import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  IconButton,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import type {
  ConfigurableQuickCareKey,
  QuickCarePreference,
} from '../constants/quickCarePreferences';

interface Props {
  visible: boolean;
  careKey: ConfigurableQuickCareKey | null;
  preference?: QuickCarePreference;
  onClose: () => void;
  onSave: (
    careKey: ConfigurableQuickCareKey,
    preference: QuickCarePreference,
  ) => Promise<void>;
}

const labels: Record<ConfigurableQuickCareKey, string> = {
  nursing: 'Nursing',
  bottle: 'Bottle',
  sleep: 'Sleep',
  diaper: 'Nappy',
  pumping: 'Pumping',
};

export default function QuickCareConfigModal({
  visible,
  careKey,
  preference,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState<QuickCarePreference>({ mode: 'auto' });
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !careKey) return;
    const next = preference || { mode: 'auto' };
    setDraft(next);
    setAmount(next.bottleAmount?.toString() || '');
    setError('');
  }, [careKey, preference, visible]);

  if (!careKey) return null;

  const set = <Key extends keyof QuickCarePreference>(
    key: Key,
    value: QuickCarePreference[Key],
  ) => setDraft(current => ({ ...current, [key]: value }));

  const save = async () => {
    let next = draft;
    if (draft.mode === 'specific' && careKey === 'bottle') {
      const bottleAmount = Number(amount);
      if (!Number.isFinite(bottleAmount) || bottleAmount <= 0) {
        setError('Enter a bottle amount greater than zero.');
        return;
      }
      next = {
        ...draft,
        bottleAmount,
        bottleUnit: draft.bottleUnit || 'ml',
      };
    }

    setSaving(true);
    setError('');
    try {
      await onSave(careKey, next);
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to save this quick action.',
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
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Surface
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
          elevation={5}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text variant="titleLarge" style={styles.title}>
                Configure {labels[careKey]}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Auto follows the last logged choice. Specific always uses the
                option below.
              </Text>
            </View>
            <IconButton icon="close" onPress={onClose} disabled={saving} />
          </View>

          <SegmentedButtons
            value={draft.mode}
            onValueChange={value => set('mode', value as 'auto' | 'specific')}
            buttons={[
              { value: 'auto', label: 'Auto' },
              { value: 'specific', label: 'Specific' },
            ]}
            style={styles.mode}
          />

          {draft.mode === 'specific' ? (
            <View style={styles.options}>
              {careKey === 'nursing' ? (
                <SegmentedButtons
                  value={draft.breastSide || 'left'}
                  onValueChange={value =>
                    set('breastSide', value as 'left' | 'right')
                  }
                  buttons={[
                    { value: 'left', label: 'Left first' },
                    { value: 'right', label: 'Right first' },
                  ]}
                />
              ) : null}
              {careKey === 'bottle' ? (
                <View style={styles.amountRow}>
                  <TextInput
                    mode="outlined"
                    label="Quick bottle amount"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    style={styles.amount}
                  />
                  <SegmentedButtons
                    value={draft.bottleUnit || 'ml'}
                    onValueChange={value =>
                      set('bottleUnit', value as 'ml' | 'oz')
                    }
                    buttons={[
                      { value: 'ml', label: 'ml' },
                      { value: 'oz', label: 'oz' },
                    ]}
                    style={styles.unit}
                  />
                </View>
              ) : null}
              {careKey === 'sleep' ? (
                <SegmentedButtons
                  value={draft.sleepType || 'cot'}
                  onValueChange={value =>
                    set(
                      'sleepType',
                      value as 'contactNap' | 'car' | 'cot',
                    )
                  }
                  buttons={[
                    { value: 'contactNap', label: 'Contact' },
                    { value: 'car', label: 'Car' },
                    { value: 'cot', label: 'Cot' },
                  ]}
                />
              ) : null}
              {careKey === 'diaper' ? (
                <SegmentedButtons
                  value={draft.diaperCondition || 'wet'}
                  onValueChange={value =>
                    set(
                      'diaperCondition',
                      value as 'wet' | 'dirty' | 'both',
                    )
                  }
                  buttons={[
                    { value: 'wet', label: 'Wet' },
                    { value: 'dirty', label: 'Dirty' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              ) : null}
              {careKey === 'pumping' ? (
                <SegmentedButtons
                  value={draft.pumpingSide || 'both'}
                  onValueChange={value =>
                    set('pumpingSide', value as 'left' | 'right' | 'both')
                  }
                  buttons={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              ) : null}
            </View>
          ) : null}

          {error ? <HelperText type="error">{error}</HelperText> : null}
          <View style={styles.footer}>
            <Button mode="text" onPress={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button mode="contained" onPress={() => void save()} loading={saving}>
              Save
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
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  sheet: { borderRadius: 22, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1, paddingTop: 5 },
  title: { fontWeight: '800', marginBottom: 3 },
  mode: { marginTop: 16 },
  options: { marginTop: 14 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { flex: 1 },
  unit: { width: 126 },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
