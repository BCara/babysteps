import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVoiceTestLog } from '../../src/hooks/useVoiceTestLog';
import {
  formatVoiceTestExport,
  summariseVoiceTest,
} from '../../src/utils/voiceTestLog';

export default function VoiceLogScreen() {
  const theme = useTheme();
  const { enabled, entries, answer, clear, setEnabled } = useVoiceTestLog();
  const summary = summariseVoiceTest(entries);

  const confirmClear = () =>
    Alert.alert('Clear the voice test log?', 'This removes every logged attempt from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clear },
    ]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <View style={styles.topBarCopy}>
          <Text variant="titleLarge" style={styles.title}>
            Voice test log
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {summary.total} attempts · {summary.yes} right · {summary.no} wrong ·{' '}
            {summary.unanswered} to answer
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Button
            mode="contained"
            icon="share-variant-outline"
            disabled={!entries.length}
            onPress={() =>
              void Share.share({ message: formatVoiceTestExport(entries) })
            }
          >
            Share log
          </Button>
          <Button mode="outlined" disabled={!entries.length} onPress={confirmClear}>
            Clear
          </Button>
          <Button mode="text" onPress={() => setEnabled(!enabled)}>
            {enabled ? 'Stop testing' : 'Start testing'}
          </Button>
        </View>

        {!entries.length ? (
          <Text variant="bodyMedium" style={styles.empty}>
            Use the microphone anywhere in the app. Each attempt shows up here
            and asks whether it got it right.
          </Text>
        ) : null}

        {entries.map(entry => (
          <Surface
            key={entry.id}
            elevation={1}
            style={[
              styles.card,
              entry.answer === 'no' && { borderColor: theme.colors.error, borderWidth: 1 },
            ]}
          >
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {new Date(entry.at).toLocaleString([], {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {entry.source}
            </Text>
            <Text variant="bodyLarge">
              {entry.heard ? `“${entry.heard}”` : '(heard nothing)'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {entry.understood}
            </Text>
            <View style={styles.answers}>
              <Button
                compact
                mode={entry.answer === 'yes' ? 'contained' : 'outlined'}
                icon="thumb-up-outline"
                onPress={() => answer(entry.id, 'yes')}
              >
                Right
              </Button>
              <Button
                compact
                mode={entry.answer === 'no' ? 'contained' : 'outlined'}
                icon="thumb-down-outline"
                buttonColor={entry.answer === 'no' ? theme.colors.error : undefined}
                onPress={() => answer(entry.id, 'no')}
              >
                Wrong
              </Button>
            </View>
          </Surface>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    minHeight: 70,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarCopy: { flex: 1 },
  title: { fontWeight: '800' },
  content: { padding: 18, paddingBottom: 40, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { lineHeight: 20, opacity: 0.75 },
  card: { borderRadius: 18, padding: 16, gap: 4 },
  answers: { marginTop: 8, flexDirection: 'row', gap: 8 },
});
