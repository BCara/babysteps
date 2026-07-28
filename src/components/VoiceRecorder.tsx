import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { MotiView } from 'moti';
import { IconButton, useTheme } from 'react-native-paper';

export const VoiceRecorder = () => {
  const { isRecording, recordingDuration, startRecording, stopRecording } = useVoiceRecorder();
  const theme = useTheme();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.recordContainer}>
        {isRecording && (
          <MotiView
            from={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{
              type: 'timing',
              duration: 1500,
              loop: true,
            }}
            style={[styles.ripple, { backgroundColor: theme.colors.error }]}
          />
        )}
        <TouchableOpacity
          onPressIn={startRecording}
          onPressOut={stopRecording}
          activeOpacity={0.8}
        >
          <View style={[styles.micButton, { backgroundColor: isRecording ? theme.colors.error : theme.colors.primary }]}>
            <IconButton
              icon="microphone"
              iconColor="#fff"
              size={48}
              style={{ margin: 0 }}
            />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={[styles.timer, { color: theme.colors.onSurface }]}>
        {isRecording ? formatTime(recordingDuration) : 'Hold to record log'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  recordContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 2,
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    zIndex: 1,
  },
  timer: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
  },
});
