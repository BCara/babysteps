import { useLayoutEffect, useRef, useState } from 'react';
import { useActivityHeaderVoice } from './ActivityHeaderVoice';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  parseContextualVoiceEntry,
  type VoiceEntryContext,
  type VoiceEntryValues,
} from '../utils/voiceCommand';

interface Props {
  context: VoiceEntryContext;
  onFill: (values: VoiceEntryValues) => void;
  disabled?: boolean;
  /** Colours for a screen with its own palette, such as the nursing screens. */
  iconColor?: string;
  containerColor?: string;
  messageColor?: string;
}

export default function ContextualVoiceButton({
  context,
  onFill,
  disabled = false,
  iconColor,
  containerColor,
  messageColor,
}: Props) {
  const theme = useTheme();
  const header = useActivityHeaderVoice();
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const ownsRecognitionSession = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    if (!ownsRecognitionSession.current) return;
    setListening(true);
    setIsError(false);
    setMessage('Listening…');
  });
  useSpeechRecognitionEvent('end', () => {
    if (!ownsRecognitionSession.current) return;
    ownsRecognitionSession.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('result', event => {
    if (!ownsRecognitionSession.current) return;
    const transcript = event.results[0]?.transcript?.trim() || '';
    if (!transcript) return;
    if (!event.isFinal) {
      setMessage(`Heard: “${transcript}”`);
      return;
    }

    const parsed = parseContextualVoiceEntry(context, transcript);
    setMessage(parsed.description);
    setIsError(!parsed.values);
    if (parsed.values) onFill(parsed.values);
  });
  useSpeechRecognitionEvent('error', event => {
    if (!ownsRecognitionSession.current) return;
    ownsRecognitionSession.current = false;
    setListening(false);
    if (event.error === 'aborted') return;
    setIsError(true);
    setMessage(
      event.error === 'no-speech' || event.error === 'speech-timeout'
        ? 'I did not hear anything. Tap the microphone and try again.'
        : event.error === 'not-allowed'
          ? 'Microphone access is needed for voice input.'
          : 'Voice input is unavailable right now. Please try again.',
    );
  });

  const startListening = async () => {
    setMessage('');
    setIsError(false);
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setIsError(true);
      setMessage('Microphone access is needed for voice input.');
      return;
    }

    ownsRecognitionSession.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-AU',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  };

  const button = (
      <IconButton
        mode="contained-tonal"
        icon={listening ? 'microphone' : 'microphone-outline'}
        iconColor={
          listening
            ? theme.colors.error
            : header?.color ?? iconColor ?? theme.colors.primary
        }
        containerColor={header ? 'rgba(255,255,255,0.12)' : containerColor}
        size={header ? 30 : 24}
        style={[styles.microphoneButton, header && styles.headerMicrophoneButton]}
        onPress={
          listening
            ? () => {
                if (ownsRecognitionSession.current) {
                  ExpoSpeechRecognitionModule.stop();
                }
              }
            : startListening
        }
        disabled={disabled}
        accessibilityLabel={
          listening ? 'Stop listening' : `Fill ${context} form with voice`
        }
      />
  );
  const feedback = message ? (
        <Text
          variant="bodySmall"
          accessibilityLiveRegion="polite"
          style={[
            styles.message,
            {
              color: isError
                ? theme.colors.error
                : header?.color ?? messageColor ?? theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {message}
        </Text>
      ) : null;

  useLayoutEffect(() => {
    header?.setContent({ button, message: feedback });
    return () => header?.setContent(null);
  });

  return header ? null : (
    <View style={styles.container}>{button}{feedback}</View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  microphoneButton: {
    margin: 0,
  },
  headerMicrophoneButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  message: {
    marginTop: 7,
    lineHeight: 18,
  },
});
