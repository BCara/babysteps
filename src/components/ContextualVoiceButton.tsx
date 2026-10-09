import { useLayoutEffect, useRef, useState } from 'react';
import { useActivityHeaderVoice } from './ActivityHeaderVoice';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
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
  parseContextualVoiceEntry,
  type VoiceEntryContext,
  type VoiceEntryValues,
} from '../utils/voiceCommand';
import { useVoiceTestLog } from '../hooks/useVoiceTestLog';
import VoiceTestPrompt from './VoiceTestPrompt';

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
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const ownsRecognitionSession = useRef(false);
  const voiceTest = useVoiceTestLog();
  const [testEntryId, setTestEntryId] = useState<string | null>(null);
  const latestTranscript = useRef('');

  useSpeechRecognitionEvent('start', () => {
    if (!ownsRecognitionSession.current) return;
    setListening(true);
    setIsError(false);
    setCanOpenSettings(false);
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
    latestTranscript.current = transcript;
    if (!event.isFinal) {
      setMessage(`Heard: “${transcript}”`);
      return;
    }

    const parsed = parseContextualVoiceEntry(context, transcript);
    setMessage(parsed.description);
    setIsError(!parsed.values);
    setTestEntryId(
      voiceTest.record({
        source: `${context} form`,
        heard: transcript,
        understood: parsed.description,
      }),
    );
    if (parsed.values) onFill(parsed.values);
  });
  useSpeechRecognitionEvent('error', event => {
    if (!ownsRecognitionSession.current) return;
    ownsRecognitionSession.current = false;
    setListening(false);
    if (event.error === 'aborted') return;
    setIsError(true);
    const denial =
      event.error === 'not-allowed'
        ? describeMicrophoneDenial(
            { granted: false, canAskAgain: false },
            Platform.OS,
          )
        : null;
    const nextMessage =
      denial
        ? denial.message
        : event.error === 'no-speech' || event.error === 'speech-timeout'
          ? 'I did not hear anything. Tap the microphone and try again.'
          : 'Voice input is unavailable right now. Please try again.';
    setCanOpenSettings(Boolean(denial?.canOpenSettings));
    setMessage(nextMessage);
    setTestEntryId(
      voiceTest.record({
        source: `${context} form`,
        heard: latestTranscript.current,
        understood: nextMessage,
        error: event.error,
      }),
    );
  });

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setCanOpenSettings(false);
      setIsError(true);
      setMessage(MICROPHONE_SETTINGS_FAILED_MESSAGE);
    }
  };

  const startListening = async () => {
    latestTranscript.current = '';
    setTestEntryId(null);
    setMessage('');
    setIsError(false);
    setCanOpenSettings(false);
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      const denial = describeMicrophoneDenial(permission, Platform.OS);
      setIsError(true);
      setCanOpenSettings(denial.canOpenSettings);
      setMessage(denial.message);
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
        size={header ? 22 : 24}
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
  const feedbackColor = isError
    ? theme.colors.error
    : header?.color ?? messageColor ?? theme.colors.onSurfaceVariant;
  const feedback = message ? (
        <View style={styles.feedback}>
          <Text
            variant="bodySmall"
            accessibilityLiveRegion="polite"
            style={[styles.message, { color: feedbackColor }]}
          >
            {message}
          </Text>
          {canOpenSettings ? (
            <Button
              compact
              mode="text"
              icon="cog-outline"
              onPress={openSettings}
              textColor={feedbackColor}
              style={styles.settingsButton}
              accessibilityHint="Opens the system settings for PitterPatter"
            >
              {MICROPHONE_SETTINGS_LABEL}
            </Button>
          ) : null}
          {!listening ? (
            <VoiceTestPrompt entryId={testEntryId} color={feedbackColor} />
          ) : null}
        </View>
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
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  feedback: {
    alignItems: 'flex-start',
  },
  message: {
    marginTop: 7,
    lineHeight: 18,
  },
  settingsButton: {
    marginTop: 2,
    marginLeft: -8,
  },
});
