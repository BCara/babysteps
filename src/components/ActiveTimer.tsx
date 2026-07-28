import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';

interface ActiveTimerProps {
  activityType: string;
  startTime: Date;
  onStop: () => void;
  stopping?: boolean;
}

export default function ActiveTimer({
  activityType,
  startTime,
  onStop,
  stopping = false,
}: ActiveTimerProps) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime.getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatElapsed = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Surface style={styles.container} elevation={2}>
      <View style={styles.info}>
        <View style={styles.pulseIndicator} />
        <View>
          <Text variant="titleMedium" style={{ textTransform: 'capitalize' }}>
            {activityType} in progress
          </Text>
          <Text variant="headlineMedium" style={styles.time}>
            {formatElapsed(elapsed)}
          </Text>
        </View>
      </View>
      <Button
        mode="contained-tonal"
        icon="stop-circle-outline"
        onPress={onStop}
        loading={stopping}
        disabled={stopping}
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
    backgroundColor: '#E76F51',
    marginRight: 16,
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontWeight: 'bold',
  }
});
