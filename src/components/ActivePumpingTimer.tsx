import { ActivitySegments as SegmentedButtons, ActivityButton as Button } from './ActivityStyle';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useCarePalette } from '../hooks/useCarePalette';
import { TIMER_LIMIT_MINUTES, timerLimitLabel } from '../utils/timerLimits';
import { formatTimerSeconds } from '../utils/feedTiming';

interface Props {
  startTime: Date;
  side: 'left' | 'right' | 'both';
  busy?: boolean;
  onChangeSide: (side: 'left' | 'right' | 'both') => void;
  onStop: () => void;
  onCancel: () => void;
  onManual: () => void;
}

export default function ActivePumpingTimer({ startTime, side, busy, onChangeSide, onStop, onCancel, onManual }: Props) {
  const { colors: eventColors } = useCarePalette();
  const theme = useTheme();
  const [elapsed, setElapsed] = useState(Date.now() - startTime.getTime());
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Date.now() - startTime.getTime()), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <Surface style={styles.card} elevation={2}>
      <View style={styles.header}>
        <View style={styles.timerInfo}><View style={[styles.dot, { backgroundColor: eventColors.pumping }]} /><View><Text variant="titleMedium">Pumping in progress</Text><Text variant="headlineMedium" style={styles.time}>{formatTimerSeconds(elapsed / 1000)}</Text></View></View>
        <View><Button compact mode="text" textColor={theme.colors.error} icon="close-circle-outline" onPress={onCancel} disabled={busy}>Cancel</Button><Button compact mode="contained-tonal" icon="stop-circle-outline" onPress={onStop} loading={busy} disabled={busy}>Stop</Button></View>
      </View>
      <Text variant="labelLarge" style={styles.label}>Side</Text>
      <SegmentedButtons value={side} onValueChange={value => onChangeSide(value as 'left' | 'right' | 'both')} buttons={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]} />
      <Text variant="bodySmall" style={styles.limitHint}>Stops automatically after {timerLimitLabel(TIMER_LIMIT_MINUTES.pumping)}</Text>
      <Button mode="text" icon="pencil-outline" onPress={onManual} disabled={busy} style={styles.manual}>Manual entry</Button>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  timerInfo: { flexDirection: 'row', alignItems: 'center' }, dot: { width: 12, height: 12, borderRadius: 6, marginRight: 14 },
  time: { fontVariant: ['tabular-nums'], fontWeight: 'bold' }, label: { marginBottom: 8 }, limitHint: { marginTop: 8, opacity: 0.68 }, manual: { alignSelf: 'flex-start', marginTop: 5 },
});
