import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { formatTimerSeconds } from '../utils/feedTiming';

interface ActiveTimerProps {
  activityType: string;
  startTime: Date;
  onStop: () => void;
  stopping?: boolean;
  indicatorColor?: string;
}

export default function ActiveTimer({
  activityType,
  startTime,
  onStop,
  stopping = false,
  indicatorColor = '#E76F51',
}: ActiveTimerProps) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime.getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <Surface style={styles.container} elevation={2}>
      <View style={styles.info}>
        <View style={[styles.pulseIndicator, { backgroundColor: indicatorColor }]} />
        <View>
          <Text variant="titleMedium" style={{ textTransform: 'capitalize' }}>
            {activityType} in progress
          </Text>
          <Text variant="headlineMedium" style={styles.time}>
            {formatTimerSeconds(elapsed / 1000)}
          </Text>
        </View>
      </View>
      <Button
        mode="contained-tonal"
        icon="stop-circle-outline"
        onPress={onStop}
        loading={stopping}
        disabled={stopping}
        accessibilityLabel={`Stop ${activityType} timer`}
      >
        Stop
      </Button>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontWeight: 'bold',
  }
});
