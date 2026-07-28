import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  IconButton,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { BabyEvent } from '../services/firebase/events';

interface EventEditModalProps {
  event: BabyEvent | null;
  visible: boolean;
  onClose: () => void;
  onSave: (
    eventId: string,
    updates: Partial<Pick<BabyEvent, 'durationMinutes' | 'notes' | 'metadata'>>,
  ) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
}

export default function EventEditModal({
  event,
  visible,
  onClose,
  onSave,
  onDelete,
}: EventEditModalProps) {
  const theme = useTheme();
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [condition, setCondition] = useState<'wet' | 'dirty' | 'both'>('wet');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!event) return;
    setNotes(event.notes || '');
    setAmount(event.metadata?.amount?.toString() || '');
    setDuration(event.durationMinutes?.toString() || '');
    setCondition(event.metadata?.diaperCondition || 'wet');
    setError('');
  }, [event]);

  if (!event?.id) return null;

  const handleSave = async () => {
    const parsedAmount = amount ? Number(amount) : undefined;
    const parsedDuration = duration ? Number(duration) : undefined;
    if (
      (parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) ||
      (parsedDuration !== undefined &&
        (!Number.isFinite(parsedDuration) || parsedDuration <= 0))
    ) {
      setError('Enter valid positive numbers.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(event.id!, {
        notes: notes.trim() || '',
        durationMinutes: parsedDuration,
        metadata: {
          ...event.metadata,
          amount: event.type === 'feed' ? parsedAmount : event.metadata?.amount,
          diaperCondition:
            event.type === 'diaper' ? condition : event.metadata?.diaperCondition,
        },
      });
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update event.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this log?',
      'It will be removed from your timeline.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await onDelete(event.id!);
              onClose();
            } catch (nextError) {
              setError(
                nextError instanceof Error ? nextError.message : 'Unable to delete event.',
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Surface style={styles.modal} elevation={5}>
          <View style={styles.header}>
            <View>
              <Text variant="titleLarge" style={styles.title}>
                Edit {event.type === 'diaper' ? 'nappy' : event.type}
              </Text>
              <Text variant="bodySmall">
                {event.startTime.toLocaleString([], {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <IconButton icon="close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {event.type === 'feed' && event.metadata?.feedType === 'bottle' ? (
              <TextInput
                label={`Amount (${event.metadata?.unit || 'ml'})`}
                mode="outlined"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
              />
            ) : null}
            {event.type !== 'diaper' ? (
              <TextInput
                label="Duration in minutes"
                mode="outlined"
                keyboardType="number-pad"
                value={duration}
                onChangeText={setDuration}
                style={styles.input}
              />
            ) : (
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
            )}
            <TextInput
              label="Notes"
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
              <Button
                mode="text"
                textColor={theme.colors.error}
                icon="delete-outline"
                onPress={confirmDelete}
                disabled={saving}
              >
                Delete
              </Button>
              <View style={styles.saveActions}>
                <Button mode="outlined" onPress={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                >
                  Save
                </Button>
              </View>
            </View>
          </ScrollView>
        </Surface>
      </View>
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
    maxHeight: '84%',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
