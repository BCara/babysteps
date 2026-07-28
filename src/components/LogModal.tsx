import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
  Surface,
  Button,
  TextInput,
  IconButton,
  SegmentedButtons,
  useTheme,
} from 'react-native-paper';
import { eventColors } from '../theme/eventColors';

export type QuickLogInput =
  | {
      type: 'feed';
      feedType: 'breast' | 'bottle';
      amount?: number;
      unit?: 'ml' | 'oz';
      durationMinutes?: number;
      notes?: string;
    }
  | {
      type: 'diaper';
      condition: 'wet' | 'dirty' | 'both';
      notes?: string;
    };

interface LogModalProps {
  visible: boolean;
  type: 'feed' | 'diaper' | null;
  onClose: () => void;
  onSave: (data: QuickLogInput) => Promise<void>;
}

export default function LogModal({ visible, type, onClose, onSave }: LogModalProps) {
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [amount, setAmount] = useState('');
  const [feedType, setFeedType] = useState<'breast' | 'bottle'>('bottle');
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  const [condition, setCondition] = useState<'wet' | 'dirty' | 'both'>('wet');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const theme = useTheme();

  useEffect(() => {
    if (visible) {
      setNotes('');
      setDuration('');
      setAmount('');
      setFeedType('bottle');
      setUnit('ml');
      setCondition('wet');
      setError('');
    }
  }, [type, visible]);

  if (!type) return null;
  const color = eventColors[type as keyof typeof eventColors] || theme.colors.primary;

  const parsePositive = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const handleSave = async () => {
    const parsedDuration = parsePositive(duration);
    const parsedAmount = parsePositive(amount);
    if (parsedDuration === null || parsedAmount === null) {
      setError('Enter a valid positive number.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (type === 'feed') {
        await onSave({
          type,
          feedType,
          amount: feedType === 'bottle' ? parsedAmount : undefined,
          unit: feedType === 'bottle' ? unit : undefined,
          durationMinutes: parsedDuration,
          notes,
        });
      } else {
        await onSave({ type, condition, notes });
      }
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save this log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Surface style={styles.modal} elevation={5}>
          <View style={[styles.header, { backgroundColor: color }]}>
            <Text variant="titleLarge" style={styles.title}>Log {type}</Text>
            <IconButton icon="close" onPress={onClose} />
          </View>
          
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {type === 'feed' ? (
              <>
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Feed type
                </Text>
                <SegmentedButtons
                  value={feedType}
                  onValueChange={value => setFeedType(value as 'breast' | 'bottle')}
                  buttons={[
                    { value: 'bottle', label: 'Bottle', icon: 'baby-bottle-outline' },
                    { value: 'breast', label: 'Breast', icon: 'mother-nurse' },
                  ]}
                  style={styles.input}
                />
                {feedType === 'bottle' ? (
                  <View style={styles.amountRow}>
                    <TextInput
                      label="Amount"
                      mode="outlined"
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                      style={styles.amountInput}
                    />
                    <SegmentedButtons
                      value={unit}
                      onValueChange={value => setUnit(value as 'ml' | 'oz')}
                      buttons={[
                        { value: 'ml', label: 'ml' },
                        { value: 'oz', label: 'oz' },
                      ]}
                      style={styles.unitInput}
                    />
                  </View>
                ) : null}
                <TextInput
                  label="Duration in minutes (optional)"
                  mode="outlined"
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  style={styles.input}
                />
              </>
            ) : (
              <>
                <Text variant="labelLarge" style={styles.fieldLabel}>
                  Nappy type
                </Text>
                <SegmentedButtons
                  value={condition}
                  onValueChange={value =>
                    setCondition(value as 'wet' | 'dirty' | 'both')
                  }
                  buttons={[
                    { value: 'wet', label: 'Wet' },
                    { value: 'dirty', label: 'Dirty' },
                    { value: 'both', label: 'Both' },
                  ]}
                  style={styles.input}
                />
              </>
            )}

            <TextInput
              label="Notes (optional)"
              mode="outlined"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              style={styles.input}
            />

            {error ? (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button mode="outlined" onPress={onClose} disabled={saving} style={styles.button}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
                style={styles.button}
              >
                Save
              </Button>
            </View>
          </ScrollView>
        </Surface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  content: {
    padding: 24,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  input: {
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    marginBottom: 16,
  },
  unitInput: {
    width: 138,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  button: {
    minWidth: 100,
  },
});
