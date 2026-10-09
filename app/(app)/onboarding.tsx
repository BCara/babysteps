import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useBabies } from '../../src/providers/BabyProvider';

const defaultBirthDate = () => new Date();

export default function OnboardingScreen() {
  const theme = useTheme();
  const { babies, addBaby } = useBabies();
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(defaultBirthDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type !== 'dismissed' && selectedDate) setDateOfBirth(selectedDate);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Enter your baby’s name.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await addBaby({
        name: name.trim(),
        dateOfBirth,
        isActive: true,
      });
      router.replace('/(app)/(tabs)');
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to create the baby profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.topBar}>
        <View>
          <Text variant="headlineSmall" style={styles.title}>
            {babies.length ? 'Add another baby' : 'Who are we caring for?'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            You can update these details later.
          </Text>
        </View>
        {babies.length ? (
          <IconButton icon="close" onPress={() => router.back()} />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Baby’s name"
          mode="outlined"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          style={styles.input}
        />

        <Text variant="labelLarge" style={styles.label}>
          Date of birth
        </Text>
        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => setShowDatePicker(true)}
          contentStyle={styles.dateButton}
          style={styles.input}
        >
          {dateOfBirth.toLocaleDateString([], {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Button>

        {showDatePicker ? (
          <DateTimePicker
            value={dateOfBirth}
            mode="date"
            maximumDate={new Date()}
            minimumDate={new Date(2010, 0, 1)}
            onChange={handleDateChange}
          />
        ) : null}

        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          contentStyle={styles.saveButton}
        >
          {babies.length ? 'Add baby' : 'Start tracking'}
        </Button>

        {babies.length ? null : (
          <Button
            mode="text"
            icon="ticket-confirmation-outline"
            onPress={() => router.push('/(app)/join-baby')}
            style={styles.joinButton}
          >
            Someone shared a baby with me
          </Button>
        )}

        <Text variant="bodySmall" style={styles.privacyNote}>
          PitterPatter stores this information securely in your private account. It
          is not used for advertising.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    marginBottom: 22,
  },
  label: {
    marginBottom: 8,
  },
  dateButton: {
    minHeight: 52,
    justifyContent: 'center',
  },
  saveButton: {
    minHeight: 52,
  },
  joinButton: {
    marginTop: 12,
  },
  privacyNote: {
    textAlign: 'center',
    opacity: 0.66,
    marginTop: 18,
    lineHeight: 18,
  },
});
