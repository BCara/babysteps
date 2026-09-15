import { useCareScreenStyle } from './ActivityStyle';
import NursingStartTimeFields from './nursing/NursingStartTimeFields';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { resolveEventPickerTime } from '../utils/eventEditing';

interface Props {
  value: Date;
  onChange: (value: Date) => void;
  label?: string;
  showDate?: boolean;
  disabled?: boolean;
  allowFuture?: boolean;
}

export default function EventTimeEditor({
  value,
  onChange,
  label = 'When it happened',
  showDate = true,
  disabled = false,
  allowFuture = false,
}: Props) {
  const chrome = useCareScreenStyle();
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  const formattedDate = value.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const handleChange = (
    mode: 'date' | 'time',
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (event.type === 'dismissed' || !selected) {
      setPicker(null);
      return;
    }
    onChange(resolveEventPickerTime(value, selected, mode, allowFuture));
  };

  // Date and time sit next to each other and are edited independently: an
  // already-correct date needs no interaction at all.
  const openPicker = (mode: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        ...(mode === 'date' && !allowFuture ? { maximumDate: new Date() } : {}),
        onChange: (event, selected) => handleChange(mode, event, selected),
      });
      return;
    }
    setPicker(current => (current === mode ? null : mode));
  };

  if (chrome && showDate) {
    return <View style={styles.container}><NursingStartTimeFields chrome={chrome}
      value={value} onChange={onChange} label={label} disabled={disabled} allowFuture={allowFuture} /></View>;
  }
  return (
    <View style={styles.container}>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <View style={styles.row}>
        {showDate ? (
          <Button
            mode="outlined"
            icon="calendar"
            onPress={() => openPicker('date')}
            disabled={disabled}
            style={styles.control}
            contentStyle={styles.controlContent}
            accessibilityLabel={`${label}, date: ${formattedDate}`}
            accessibilityHint="Opens the date picker"
          >
            {formattedDate}
          </Button>
        ) : null}
        <Button
          mode="outlined"
          icon="clock-outline"
          onPress={() => openPicker('time')}
          disabled={disabled}
          style={styles.control}
          contentStyle={styles.controlContent}
          accessibilityLabel={`${label}, time: ${formattedTime}`}
          accessibilityHint="Opens the time picker"
        >
          {formattedTime}
        </Button>
      </View>
      {picker && Platform.OS !== 'android' ? (
        <DateTimePicker
          themeVariant="dark"
          value={value}
          mode={picker}
          {...(picker === 'date' && !allowFuture
            ? { maximumDate: new Date() }
            : {})}
          onChange={(event, selected) => handleChange(picker, event, selected)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { marginBottom: 8 },
  // Wraps to stacked controls when a large font scale needs the extra width.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  control: { flexGrow: 1, flexBasis: 140 },
  controlContent: { paddingVertical: 4 },
});
