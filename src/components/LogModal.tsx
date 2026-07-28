import React, { useState } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { Text, Surface, Button, TextInput, IconButton, useTheme } from 'react-native-paper';
import { eventColors } from '../theme/eventColors';

interface LogModalProps {
  visible: boolean;
  type: string | null;
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function LogModal({ visible, type, onClose, onSave }: LogModalProps) {
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const theme = useTheme();

  if (!type) return null;
  const color = eventColors[type as keyof typeof eventColors] || theme.colors.primary;

  const handleSave = () => {
    onSave({
      type,
      notes,
      duration: duration ? parseInt(duration) : undefined,
      startTime: new Date(),
    });
    setNotes('');
    setDuration('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Surface style={styles.modal} elevation={5}>
          <View style={[styles.header, { backgroundColor: color }]}>
            <Text variant="titleLarge" style={styles.title}>Log {type}</Text>
            <IconButton icon="close" onPress={onClose} />
          </View>
          
          <View style={styles.content}>
            {(type === 'sleep' || type === 'feed' || type === 'tummytime' || type === 'pumping') && (
              <TextInput
                label="Duration (minutes)"
                mode="outlined"
                keyboardType="numeric"
                value={duration}
                onChangeText={setDuration}
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
            
            <View style={styles.actions}>
              <Button mode="outlined" onPress={onClose} style={styles.button}>Cancel</Button>
              <Button mode="contained" onPress={handleSave} style={styles.button}>Save</Button>
            </View>
          </View>
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '50%',
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
  input: {
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  button: {
    minWidth: 100,
  }
});
