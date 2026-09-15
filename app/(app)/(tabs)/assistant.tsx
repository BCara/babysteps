import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import PremiumCard from '../../../src/components/PremiumCard';
import { useAiAssistant } from '../../../src/providers/AiAssistantProvider';
import { useBabies } from '../../../src/providers/BabyProvider';
import {
  AiResult,
  createAiRequestId,
  deviceTimeZone,
} from '../../../src/services/aiAssistant';

const suggestions = [
  'What was logged today?',
  'When was the most recent feed?',
  'How has sleep varied this week?',
  'How many nappies were logged this week?',
];

function ResultCard({ result }: { result: AiResult }) {
  const theme = useTheme();
  const from = new Date(result.dataWindow.from);
  const to = new Date(result.dataWindow.to);

  return (
    <Surface style={styles.resultCard} elevation={1}>
      <View style={styles.resultHeading}>
        <View
          style={[
            styles.resultIcon,
            {
              backgroundColor:
                result.kind === 'safety_redirect'
                  ? theme.colors.errorContainer
                  : theme.colors.primaryContainer,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              result.kind === 'safety_redirect'
                ? 'shield-alert-outline'
                : result.kind === 'out_of_scope'
                  ? 'information-outline'
                  : 'creation-outline'
            }
            size={22}
            color={
              result.kind === 'safety_redirect'
                ? theme.colors.error
                : theme.colors.primary
            }
          />
        </View>
        <View style={styles.resultTitleCopy}>
          <Text variant="titleMedium" style={styles.strongText}>
            {result.title}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {result.cached ? 'CACHED OR NO AI CHARGE' : 'NEW AI RESPONSE'}
          </Text>
        </View>
      </View>

      <Text variant="bodyLarge" style={styles.resultText}>
        {result.text}
      </Text>

      {result.evidence.length ? (
        <View style={styles.evidenceList}>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            BASED ON LOGGED FACTS
          </Text>
          {result.evidence.map(item => (
            <View key={item.factId} style={styles.evidenceRow}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text variant="bodyMedium" style={styles.evidenceCopy}>
                <Text style={styles.strongText}>{item.label}: </Text>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Divider style={styles.resultDivider} />
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {result.dataWindow.eventsIncluded} records in the window ·{' '}
        {from.toLocaleDateString()} to {to.toLocaleDateString()}
      </Text>
    </Surface>
  );
}

export default function AssistantScreen() {
  const theme = useTheme();
  const { selectedBaby } = useBabies();
  const {
    status,
    loading,
    busy,
    notice,
    refreshStatus,
    setConsent,
    generate,
    clearNotice,
  } = useAiAssistant();
  const [question, setQuestion] = useState('');
  const [todayResult, setTodayResult] = useState<AiResult | null>(null);
  const [weekResult, setWeekResult] = useState<AiResult | null>(null);
  const [answer, setAnswer] = useState<AiResult | null>(null);
  const timezone = useMemo(deviceTimeZone, []);

  const createSummary = async (period: 'today' | 'last7days') => {
    if (!selectedBaby?.id) return;
    try {
      const result = await generate({
        requestId: createAiRequestId(),
        babyId: selectedBaby.id,
        mode: 'summary',
        period,
        timezone,
      });
      if (period === 'today') setTodayResult(result);
      else setWeekResult(result);
    } catch {
      // The shared provider exposes the bounded error in the Snackbar.
    }
  };

  const ask = async () => {
    if (!selectedBaby?.id || question.trim().length < 3) return;
    try {
      const result = await generate({
        requestId: createAiRequestId(),
        babyId: selectedBaby.id,
        mode: 'ask',
        question: question.trim(),
        timezone,
      });
      setAnswer(result);
      setQuestion('');
    } catch {
      // The shared provider exposes the bounded error in the Snackbar.
    }
  };

  if (loading && !status) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium">Checking Assistant access…</Text>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <MaterialCommunityIcons
          name="cloud-alert-outline"
          size={44}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="titleLarge" style={styles.strongText}>
          Assistant unavailable
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.centeredCopy, { color: theme.colors.onSurfaceVariant }]}
        >
          Care logging and the standard Summary continue to work normally.
        </Text>
        <Button mode="outlined" onPress={refreshStatus} loading={loading}>
          Try again
        </Button>
        <Snackbar visible={Boolean(notice)} onDismiss={clearNotice}>
          {notice}
        </Snackbar>
      </SafeAreaView>
    );
  }

  if (!status.enabled) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <MaterialCommunityIcons
          name="creation-outline"
          size={46}
          color={theme.colors.primary}
        />
        <Text variant="titleLarge" style={styles.strongText}>
          Assistant is switched off
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.centeredCopy, { color: theme.colors.onSurfaceVariant }]}
        >
          The operator has not enabled AI for this test build. No care data is
          being sent to an AI provider.
        </Text>
        <Button mode="outlined" onPress={refreshStatus} loading={loading}>
          Check again
        </Button>
      </SafeAreaView>
    );
  }

  if (!status.consented) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.consentContainer}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="creation-outline"
              size={36}
              color={theme.colors.primary}
            />
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            PitterPatter Assistant
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.consentLead, { color: theme.colors.onSurfaceVariant }]}
          >
            Ask about the selected baby’s PitterPatter records and create short
            Today or seven-day summaries.
          </Text>

          <Surface style={styles.consentCard} elevation={1}>
            {[
              'For Assistant questions, Firebase sends a stripped-down set of recent logged facts to the OpenAI API. Names, IDs, exact date of birth, notes, provider names and observations are excluded.',
              'If you choose appointment or immunisation import, the selected image or pasted message or email text is sent to OpenAI so editable date, time, provider, location and other relevant fields can be extracted. The source is not attached to the saved record.',
              'OpenAI states that API data is not used to train its models unless the operator opts in. Default abuse-monitoring logs may retain submitted content for up to 30 days.',
              'The Assistant only explains records. It cannot diagnose, assess symptoms, recommend medicine, or make parenting and medical decisions.',
              'Questions are not saved as chat history. Short-lived server-side response caches prevent duplicate charges and are removed when AI consent is revoked.',
            ].map(copy => (
              <View key={copy} style={styles.consentRow}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={21}
                  color={theme.colors.primary}
                />
                <Text variant="bodyMedium" style={styles.consentCopy}>
                  {copy}
                </Text>
              </View>
            ))}
          </Surface>

          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            By enabling the Assistant, you confirm you are an adult caregiver
            and consent to this optional processing. You can turn it off in
            Settings.
          </Text>
          <Button
            mode="contained"
            icon="creation-outline"
            loading={busy}
            disabled={busy}
            onPress={() => void setConsent(true).catch(() => undefined)}
          >
            Enable Assistant
          </Button>
        </ScrollView>
        <Snackbar visible={Boolean(notice)} onDismiss={clearNotice}>
          {notice}
        </Snackbar>
      </SafeAreaView>
    );
  }

  const allowanceUsed = status.usage.remaining <= 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View>
              <Text variant="headlineMedium" style={styles.title}>
                Assistant
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {selectedBaby
                  ? `Logged-record insights for ${selectedBaby.name}`
                  : 'Select a baby profile to continue'}
              </Text>
            </View>
            <Surface
              style={[
                styles.allowancePill,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              elevation={0}
            >
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onPrimaryContainer }}
              >
                {status.usage.remaining}/{status.usage.limit} left
              </Text>
            </Surface>
          </View>

          {!selectedBaby?.id ? (
            <Surface style={styles.emptyCard} elevation={1}>
              <MaterialCommunityIcons
                name="baby-face-outline"
                size={38}
                color={theme.colors.primary}
              />
              <Text variant="titleMedium" style={styles.strongText}>
                Select a baby first
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                The Assistant never combines records from different baby
                profiles.
              </Text>
            </Surface>
          ) : allowanceUsed ? (
            <>
              <Surface style={styles.emptyCard} elevation={1}>
                <MaterialCommunityIcons
                  name="timer-sand-empty"
                  size={38}
                  color={theme.colors.primary}
                />
                <Text variant="titleMedium" style={styles.strongText}>
                  Assistant allowance used
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {status.usage.accessLevel === 'free'
                    ? 'The five lifetime Free generations are complete. Premium includes 100 successful generations per UTC calendar month.'
                    : 'The monthly allowance renews at the start of the next UTC calendar month.'}
                </Text>
              </Surface>
              {status.usage.accessLevel === 'free' ? <PremiumCard /> : null}
            </>
          ) : (
            <>
              <View style={styles.sectionHeading}>
                <Text variant="titleLarge" style={styles.strongText}>
                  Summaries
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Cached views do not use another generation.
                </Text>
              </View>
              <View style={styles.summaryGrid}>
                <Surface style={styles.summaryCard} elevation={1}>
                  <MaterialCommunityIcons
                    name="weather-sunset"
                    size={27}
                    color={theme.colors.primary}
                  />
                  <Text variant="titleMedium" style={styles.strongText}>
                    Today
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Explain today’s recorded care.
                  </Text>
                  <Button
                    mode="outlined"
                    compact
                    disabled={busy}
                    onPress={() => void createSummary('today')}
                  >
                    Generate
                  </Button>
                </Surface>
                <Surface style={styles.summaryCard} elevation={1}>
                  <MaterialCommunityIcons
                    name="calendar-week-outline"
                    size={27}
                    color={theme.colors.primary}
                  />
                  <Text variant="titleMedium" style={styles.strongText}>
                    Last 7 days
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Describe recent recorded patterns.
                  </Text>
                  <Button
                    mode="outlined"
                    compact
                    disabled={busy}
                    onPress={() => void createSummary('last7days')}
                  >
                    Generate
                  </Button>
                </Surface>
              </View>

              {busy ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" />
                  <Text variant="bodyMedium">Checking the logged facts…</Text>
                </View>
              ) : null}
              {todayResult ? <ResultCard result={todayResult} /> : null}
              {weekResult ? <ResultCard result={weekResult} /> : null}

              <Divider style={styles.sectionDivider} />
              <View style={styles.sectionHeading}>
                <Text variant="titleLarge" style={styles.strongText}>
                  Ask about the log
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Each question is independent and uses at most 30 days of
                  records.
                </Text>
              </View>

              <View style={styles.chipList}>
                {suggestions.map(suggestion => (
                  <Chip
                    key={suggestion}
                    mode="outlined"
                    onPress={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </Chip>
                ))}
              </View>

              <TextInput
                style={styles.questionInput}
                mode="outlined"
                label="Question about logged records"
                placeholder="When was the most recent feed?"
                value={question}
                onChangeText={value => setQuestion(value.slice(0, 600))}
                multiline
                maxLength={600}
                right={<TextInput.Affix text={`${question.length}/600`} />}
              />
              <Button
                style={styles.questionButton}
                mode="contained"
                icon="send-outline"
                loading={busy}
                disabled={busy || question.trim().length < 3}
                onPress={() => void ask()}
              >
                Ask Assistant
              </Button>
              {answer ? <ResultCard result={answer} /> : null}
            </>
          )}

          <Text
            variant="bodySmall"
            style={[styles.footerCopy, { color: theme.colors.onSurfaceVariant }]}
          >
            AI can make mistakes. Check the Activity list for the exact source
            records. For health or safety concerns, contact a qualified health
            professional or local emergency services.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Snackbar visible={Boolean(notice)} onDismiss={clearNotice}>
        {notice}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
  },
  centeredCopy: { textAlign: 'center', lineHeight: 21 },
  scrollContent: { paddingBottom: 36 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontWeight: '800' },
  strongText: { fontWeight: '700' },
  allowancePill: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  sectionHeading: { marginHorizontal: 20, marginTop: 12, marginBottom: 10, gap: 2 },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
  },
  summaryCard: { flex: 1, borderRadius: 18, padding: 14, gap: 8 },
  busyRow: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultCard: { marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 20 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitleCopy: { flex: 1, gap: 2 },
  resultText: { marginTop: 14, lineHeight: 24 },
  evidenceList: { marginTop: 15, gap: 8 },
  evidenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  evidenceCopy: { flex: 1, lineHeight: 20 },
  resultDivider: { marginVertical: 13 },
  sectionDivider: { marginHorizontal: 20, marginVertical: 18 },
  chipList: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  questionInput: { marginHorizontal: 20 },
  questionButton: { marginHorizontal: 20, marginTop: 10 },
  footerCopy: { marginHorizontal: 22, marginTop: 24, lineHeight: 18 },
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  consentContainer: { padding: 24, gap: 16 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentLead: { lineHeight: 24 },
  consentCard: { borderRadius: 20, padding: 16, gap: 14 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  consentCopy: { flex: 1, lineHeight: 21 },
});
