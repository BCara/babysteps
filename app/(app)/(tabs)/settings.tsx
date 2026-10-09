import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  ScrollView,
  View,
} from 'react-native';
import {
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useBabies } from '../../../src/providers/BabyProvider';
import {
  ACCOUNT_DELETION_URL,
  PRIVACY_URL,
  SUPPORT_EMAIL,
} from '../../../src/constants/links';
import PremiumCard from '../../../src/components/PremiumCard';
import { useMonetization } from '../../../src/providers/MonetizationProvider';
import { useAiAssistant } from '../../../src/providers/AiAssistantProvider';
import { useMissedCareSetting } from '../../../src/hooks/useMissedCare';
import { useVoiceTestLog } from '../../../src/hooks/useVoiceTestLog';
import {
  AppVersionInfo,
  formatVersionDetails,
  formatVersionLine,
} from '../../../src/utils/appVersion';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut, deleteAccount, errorMessage } = useAuth();
  const { babies, selectedBaby, selectBaby, profile } = useBabies();
  const missedCare = useMissedCareSetting();
  const voiceTest = useVoiceTestLog();
  const {
    privacyOptionsRequired,
    showAdPrivacyOptions,
    notice,
    clearNotice,
  } = useMonetization();
  const {
    status: aiStatus,
    loading: aiLoading,
    busy: aiBusy,
    notice: aiNotice,
    setConsent: setAiConsent,
    clearNotice: clearAiNotice,
  } = useAiAssistant();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo>({
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuild: Application.nativeBuildVersion,
    bundleVersion: Constants.expoConfig?.version ?? null,
    lastUpdated: null,
  });
  const usesPassword = Boolean(
    user?.providerData.some(provider => provider.providerId === 'password'),
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    Application.getLastUpdateTimeAsync()
      .then(lastUpdated => {
        if (active) setVersionInfo(info => ({ ...info, lastUpdated }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const showVersionDetails = async () => {
    const extraLines = [`${Platform.OS} ${Platform.Version}`];
    if (Platform.OS !== 'web') {
      const microphone = await ExpoSpeechRecognitionModule.getPermissionsAsync()
        .then(permission => (permission.granted ? 'allowed' : 'not allowed'))
        .catch(() => 'unknown');
      extraLines.push(`Microphone: ${microphone}`);
    }
    Alert.alert('About this build', formatVersionDetails(versionInfo, extraLines), [
      {
        text: voiceTest.enabled ? 'Stop voice testing' : 'Voice testing',
        onPress: () => voiceTest.setEnabled(!voiceTest.enabled),
      },
      { text: 'OK', style: 'cancel' },
    ]);
  };

  const openUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  const openFeedbackEmail = () => {
    const subject = encodeURIComponent('PitterPatter feedback');
    const body = encodeURIComponent(
      [
        'What would you like to tell us?',
        '',
        '',
        'Please avoid including a child’s real name or sensitive care notes.',
        '',
        '--- App details ---',
        formatVersionLine(versionInfo),
        `Android ${Platform.Version}`,
      ].join('\n'),
    );

    return openUrl(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const handleDelete = async () => {
    if (usesPassword && !password) {
      setDeleteError('Enter your password to continue.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(usesPassword ? password : undefined);
      setDeleteDialogVisible(false);
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Log out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', onPress: signOut },
    ]);

  const changeAiConsent = (enabled: boolean) => {
    if (enabled) {
      router.push('/(app)/(tabs)/assistant');
      return;
    }
    Alert.alert(
      'Turn off AI Assistant?',
      'Future AI requests will be blocked and PitterPatter’s cached AI responses will be removed. Care logs and standard summaries are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () => void setAiConsent(false).catch(() => undefined),
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <ScrollView>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Settings
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {profile?.displayName || user?.displayName || 'Caregiver'}
            {user?.email ? ` · ${user.email}` : ''}
          </Text>
        </View>

        <List.Section>
          <List.Subheader>Baby profiles</List.Subheader>
          {babies.map(baby => (
            <List.Item
              key={baby.id}
              title={baby.name}
              description={baby.dateOfBirth.toLocaleDateString([], {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              left={props => <List.Icon {...props} icon="baby-face-outline" />}
              right={props =>
                baby.id === selectedBaby?.id ? (
                  <List.Icon {...props} icon="check-circle" />
                ) : null
              }
              onPress={async () => {
                if (baby.id) await selectBaby(baby.id);
              }}
            />
          ))}
          <List.Item
            title="Add another baby"
            left={props => <List.Icon {...props} icon="plus-circle-outline" />}
            onPress={() => router.push('/(app)/onboarding')}
          />
          <List.Item
            title="Join with an invite code"
            description="Get access to a baby someone shared with you"
            left={props => <List.Icon {...props} icon="ticket-confirmation-outline" />}
            onPress={() => router.push('/(app)/join-baby')}
          />
        </List.Section>

        <Divider />

        {selectedBaby?.id ? (
          <List.Section>
            <List.Subheader>Sharing</List.Subheader>
            <List.Item
              title={`Share ${selectedBaby.name}`}
              description={
                (selectedBaby.authorizedCaregivers?.length || 1) > 1
                  ? `${selectedBaby.authorizedCaregivers!.length} caregivers have access`
                  : 'Invite a partner or carer to log care together'
              }
              left={props => <List.Icon {...props} icon="account-multiple-plus-outline" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() =>
                router.push({
                  pathname: '/(app)/sharing',
                  params: { babyId: selectedBaby.id! },
                })
              }
            />
          </List.Section>
        ) : null}

        <Divider />

        {Platform.OS === 'android' ? (
          <>
            <List.Section>
              <List.Subheader>Watch &amp; Home screen</List.Subheader>
              <List.Item
                title="Watch Tiles & widgets"
                description="Configure watch controls and Home screen widgets"
                left={props => <List.Icon {...props} icon="widgets-outline" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push('/(app)/widget-settings')}
              />
            </List.Section>
            <Divider />
          </>
        ) : null}

        <List.Section>
          <List.Subheader>Plan</List.Subheader>
          <PremiumCard />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>Assistant</List.Subheader>
          <List.Item
            title="AI Assistant"
            description={
              aiStatus?.consented
                ? `${aiStatus.usage.remaining} of ${aiStatus.usage.limit} generations remaining`
                : aiStatus?.enabled
                  ? 'Optional logged-record summaries and questions'
                  : 'Not enabled for this test build'
            }
            left={props => <List.Icon {...props} icon="creation-outline" />}
            right={() => (
              <Switch
                value={Boolean(aiStatus?.consented)}
                disabled={
                  aiLoading || aiBusy || !aiStatus || !aiStatus.enabled
                }
                onValueChange={changeAiConsent}
                accessibilityLabel="Enable AI Assistant"
              />
            )}
            onPress={() => changeAiConsent(!aiStatus?.consented)}
            disabled={aiLoading || aiBusy || !aiStatus || !aiStatus.enabled}
          />
          <List.Item
            title="Missed sleep and feed hints"
            description="Ask on Home when a gap looks unusual for your baby"
            left={props => <List.Icon {...props} icon="timeline-question-outline" />}
            right={() => (
              <Switch
                value={missedCare.enabled}
                onValueChange={missedCare.setEnabled}
                accessibilityLabel="Missed sleep and feed hints"
              />
            )}
            onPress={() => missedCare.setEnabled(!missedCare.enabled)}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>Help and privacy</List.Subheader>
          <List.Item
            title="Send test feedback"
            description={SUPPORT_EMAIL}
            left={props => <List.Icon {...props} icon="message-text-outline" />}
            onPress={openFeedbackEmail}
          />
          <List.Item
            title="Privacy policy"
            left={props => <List.Icon {...props} icon="shield-lock-outline" />}
            onPress={() => openUrl(PRIVACY_URL)}
          />
          <List.Item
            title="Account deletion information"
            left={props => <List.Icon {...props} icon="account-remove-outline" />}
            onPress={() => openUrl(ACCOUNT_DELETION_URL)}
          />
          {voiceTest.enabled ? (
            <List.Item
              title="Voice test log"
              description={`${voiceTest.entries.length} attempts logged on this phone`}
              left={props => <List.Icon {...props} icon="microphone-message" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/(app)/voice-log')}
            />
          ) : null}
          {privacyOptionsRequired ? (
            <List.Item
              title="Ad privacy choices"
              description="Review or change your advertising consent"
              left={props => (
                <List.Icon {...props} icon="shield-account-outline" />
              )}
              onPress={showAdPrivacyOptions}
            />
          ) : null}
        </List.Section>

        <View style={styles.accountActions}>
          <Button mode="outlined" icon="logout" onPress={confirmSignOut}>
            Log out
          </Button>
          <Button
            mode="text"
            textColor={theme.colors.error}
            onPress={() => {
              setPassword('');
              setDeleteError('');
              setDeleteDialogVisible(true);
            }}
          >
            Delete account and data
          </Button>
        </View>

        <Text
          variant="labelSmall"
          style={styles.versionLine}
          onLongPress={showVersionDetails}
          accessibilityHint="Hold to show build details"
        >
          {formatVersionLine(versionInfo)}
        </Text>
      </ScrollView>

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => !deleting && setDeleteDialogVisible(false)}
        >
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.deleteCopy}>
              This permanently removes your PitterPatter account. Sole-caregiver
              baby profiles and care logs are deleted; shared profiles remain for
              their other caregivers. This cannot be undone. Deleting PitterPatter
              does not cancel an active Google Play subscription; cancel it in
              Google Play first to prevent another renewal.
            </Text>
            {usesPassword ? (
              <TextInput
                label="Confirm your password"
                mode="outlined"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={Boolean(deleteError)}
              />
            ) : (
              <Text variant="bodyMedium">
                Continue with Google to confirm it is really you.
              </Text>
            )}
            {deleteError ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.error, marginTop: 8 }}
              >
                {deleteError}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setDeleteDialogVisible(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              textColor={theme.colors.error}
              onPress={handleDelete}
              loading={deleting}
              disabled={deleting}
            >
              {usesPassword ? 'Permanently delete' : 'Continue with Google'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={Boolean(notice || aiNotice)}
        onDismiss={() => {
          clearNotice();
          clearAiNotice();
        }}
        duration={4000}
      >
        {notice || aiNotice}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.65,
  },
  accountActions: {
    padding: 24,
    gap: 10,
  },
  versionLine: {
    textAlign: 'center',
    opacity: 0.4,
    paddingTop: 8,
    paddingBottom: 32,
  },
  deleteCopy: {
    marginBottom: 18,
    lineHeight: 20,
  }
});
