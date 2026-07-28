import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { MotiView } from 'moti';

interface ActiveTimerProps {
  activityType: string;
  startTime: number;
  onStop: () => void;
}

export default function ActiveTimer({ activityType, startTime, onStop }: ActiveTimerProps) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
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
        <MotiView
          from={{ opacity: 0.5, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ loop: true, type: 'timing', duration: 1000 }}
          style={styles.pulseIndicator}
        />
        <View>
          <Text variant="titleMedium" style={{ textTransform: 'capitalize' }}>{activityType}</Text>
          <Text variant="headlineMedium" style={styles.time}>{formatElapsed(elapsed)}</Text>
        </View>
      </View>
      <IconButton 
        icon="stop-circle" 
        size={40} 
        iconColor="#E76F51"
        onPress={onStop} 
      />
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
    backgroundColor: '#FFFFFF',
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
