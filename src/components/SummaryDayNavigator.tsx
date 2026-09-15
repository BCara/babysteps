import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, IconButton, Surface, Text, useTheme } from 'react-native-paper';

interface Props {
  value: Date;
  onChange: (value: Date) => void;
}

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const dayLabel = (value: Date) => {
  const selected = startOfDay(value);
  const today = startOfDay(new Date());
  const difference = Math.round(
    (today.getTime() - selected.getTime()) / 86_400_000,
  );
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return value.toLocaleDateString([], { weekday: 'long' });
};

export default function SummaryDayNavigator({ value, onChange }: Props) {
  const theme = useTheme();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const selectedDay = startOfDay(value);
  const today = startOfDay(new Date());
  const canGoForward = selectedDay.getTime() < today.getTime();

  const chooseDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) return;
    onChange(startOfDay(selected));
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDay,
        mode: 'date',
        maximumDate: today,
        onChange: chooseDate,
      });
      return;
    }
    setShowIosPicker(current => !current);
  };

  const moveDay = (offset: -1 | 1) => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + offset);
    if (next.getTime() <= today.getTime()) onChange(next);
  };

  return (
    <View>
      <Surface
        elevation={0}
        style={[
          styles.navigator,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <IconButton
          icon="chevron-left"
          onPress={() => moveDay(-1)}
          accessibilityLabel="Show previous day"
        />
        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={`Choose summary date. ${dayLabel(selectedDay)}, ${selectedDay.toLocaleDateString()}`}
          style={({ pressed }) => [
            styles.dateButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon source="calendar-month-outline" size={21} color={theme.colors.primary} />
          <View style={styles.dateCopy}>
            <Text variant="titleSmall" style={styles.dayLabel}>
              {dayLabel(selectedDay)}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {selectedDay.toLocaleDateString([], {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        </Pressable>
        <IconButton
          icon="chevron-right"
          onPress={() => moveDay(1)}
          disabled={!canGoForward}
          accessibilityLabel="Show next day"
        />
      </Surface>
      {showIosPicker && Platform.OS !== 'android' ? (
        <DateTimePicker
          value={selectedDay}
          mode="date"
          display="inline"
          maximumDate={today}
          onChange={chooseDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  navigator: {
    minHeight: 62,
    marginTop: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  dateCopy: {
    alignItems: 'center',
  },
  dayLabel: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
