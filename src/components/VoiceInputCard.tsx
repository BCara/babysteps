import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Surface, Text, useTheme } from 'react-native-paper';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  describeMicrophoneDenial,
  MICROPHONE_SETTINGS_FAILED_MESSAGE,
  MICROPHONE_SETTINGS_LABEL,
} from '../utils/microphonePermission';
import {
  parseVoiceCommand,
  VoiceCommand,
} from '../utils/voiceCommand';

interface VoiceInputCardProps {
  onCommand: (command: VoiceCommand) => Promise<void>;
  disabled?: boolean;
  autoStart?: boolean;
  placement?: 'standalone' | 'quickCareHeader';
}

export default function VoiceInputCard({
  onCommand,
  disabled = false,
  autoStart = false,
  placement = 'standalone',
}: VoiceInputCardProps) {
  const theme = useTheme();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const autoStartAttempted = useRef(false);
  const ownsRecognitionSession = useRef(false);
  const parsed = useMemo(() => parseVoiceCommand(transcript), [transcript]);

  useSpeechRecognitionEvent('start', () => {
    if (!ownsRecognitionSession.current) return;
    setListening(true);
    setCanOpenSettings(false);
    setError('');
  });
  useSpeechRecognitionEvent('end', () => {
    if (!ownsRecognitionSession.current) return;
    ownsRecognitionSession.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('result', event => {
    if (!ownsRecognitionSession.current) return;
    const nextTranscript = event.results[0]?.transcript?.trim() || '';
    if (nextTranscript) setTranscript(nextTranscript);
  });
  useSpeechRecognitionEvent('error', event => {
    if (!ownsRecognitionSession.current) return;
    ownsRecognitionSession.current = false;
    setListening(false);
    if (event.error === 'aborted') return;
    if (event.error === 'not-allowed') {
      const denial = describeMicrophoneDenial(
        { granted: false, canAskAgain: false },
        Platform.OS,
      );
      setCanOpenSettings(denial.canOpenSettings);
      setError(denial.message);
      return;
    }
    setCanOpenSettings(false);
    setError(
      event.error === 'no-speech' || event.error === 'speech-timeout'
        ? 'I did not hear anything. Tap the microphone and try again.'
        : 'Voice input is unavailable right now. Please try again.',
    );
  });

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setCanOpenSettings(false);
      setError(MICROPHONE_SETTINGS_FAILED_MESSAGE);
    }
  }, []);

  const startListening = useCallback(async () => {
    setTranscript('');
    setError('');
    setCanOpenSettings(false);
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      const denial = describeMicrophoneDenial(permission, Platform.OS);
      setCanOpenSettings(denial.canOpenSettings);
      setError(denial.message);
      return;
    }

    ownsRecognitionSession.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-AU',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  }, []);

  useEffect(() => {
    if (!autoStart || disabled || autoStartAttempted.current) return;
    autoStartAttempted.current = true;
    void startListening();
  }, [autoStart, disabled, startListening]);

  const reset = () => {
    if (listening && ownsRecognitionSession.current) {
      ExpoSpeechRecognitionModule.abort();
    }
    ownsRecognitionSession.current = false;
    setListening(false);
    setTranscript('');
    setCanOpenSettings(false);
    setError('');
  };

  const confirm = async () => {
    if (!parsed.command || saving) return;
    setSaving(true);
    setCanOpenSettings(false);
    setError('');
    try {
      await onCommand(parsed.command);
      setTranscript('');
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'That command could not be completed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const active = listening || Boolean(transcript) || Boolean(error);

  if (!active) {
    return (
      <Pressable
        onPress={startListening}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Use voice input"
        accessibilityHint="Speak a feed, sleep, or nappy command"
        style={({ pressed }) => [
          styles.compactPressable,
          placement === 'quickCareHeader' && styles.headerCompactPressable,
          {
            backgroundColor:
              placement === 'quickCareHeader'
                ? theme.colors.elevation.level2
                : theme.colors.primary,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <MaterialCommunityIcons
          name="microphone-outline"
          size={placement === 'quickCareHeader' ? 30 : 28}
          color={
            placement === 'quickCareHeader'
              ? theme.colors.primary
              : theme.colors.onPrimary
          }
        />
      </Pressable>
    );
  }

  return (
    <Surface
      style={[
        styles.card,
        placement === 'quickCareHeader' && styles.headerCard,
        { backgroundColor: theme.colors.surface },
      ]}
      elevation={1}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.micCircle,
            {
              backgroundColor: listening
                ? theme.colors.errorContainer
                : theme.colors.primaryContainer,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={listening ? 'microphone' : 'microphone-outline'}
            size={25}
            color={listening ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer}
          />
        </View>
        <View style={styles.cardHeading}>
          <Text variant="titleMedium" style={styles.title}>
            {listening ? 'Listening…' : 'Voice input'}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {listening ? 'Say one care event' : 'Check what I heard before saving'}
          </Text>
        </View>
        <Button compact onPress={reset} textColor={theme.colors.onSurfaceVariant}>
          Cancel
        </Button>
      </View>

      {transcript ? (
        <View
          style={[
            styles.transcript,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            HEARD
          </Text>
          <Text variant="bodyLarge">“{transcript}”</Text>
          <View style={styles.interpretation}>
            <MaterialCommunityIcons
              name={parsed.command ? 'check-circle-outline' : 'help-circle-outline'}
              size={19}
              color={parsed.command ? theme.colors.primary : theme.colors.error}
            />
            <Text
              variant="bodyMedium"
              style={[
                styles.interpretationCopy,
                {
                  color: parsed.command
                    ? theme.colors.onSurface
                    : theme.colors.error,
                },
              ]}
            >
              {parsed.description}
            </Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {canOpenSettings ? (
          <Button
            mode="outlined"
            icon="cog-outline"
            onPress={openSettings}
            accessibilityHint="Opens the system settings for PitterPatter"
          >
            {MICROPHONE_SETTINGS_LABEL}
          </Button>
        ) : null}
        {listening ? (
          <Button
            mode="outlined"
            icon="stop-circle-outline"
            onPress={() => ExpoSpeechRecognitionModule.stop()}
          >
            Stop listening
          </Button>
        ) : (
          <Button mode="outlined" icon="microphone" onPress={startListening}>
            Try again
          </Button>
        )}
        {parsed.command && !listening ? (
          <Button mode="contained" onPress={confirm} loading={saving} disabled={saving}>
            Confirm
          </Button>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  compactPressable: {
    marginHorizontal: 16,
    marginTop: 4,
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCompactPressable: {
    marginHorizontal: 0,
    marginTop: 0,
    alignSelf: 'auto',
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  micCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '800',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 22,
    padding: 15,
  },
  headerCard: {
    flexBasis: '100%',
    width: '100%',
    marginHorizontal: 0,
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  cardHeading: {
    flex: 1,
  },
  transcript: {
    marginTop: 14,
    borderRadius: 15,
    padding: 13,
    gap: 4,
  },
  interpretation: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  interpretationCopy: {
    flex: 1,
  },
  error: {
    marginTop: 10,
    lineHeight: 18,
  },
  actions: {
    marginTop: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
