import { useState } from 'react';
import { Alert, Linking, StyleSheet, ScrollView, View } from 'react-native';
import {
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useBabies } from '../../../src/providers/BabyProvider';
import {
  ACCOUNT_DELETION_URL,
  PRIVACY_URL,
  SUPPORT_EMAIL,
} from '../../../src/constants/links';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, signOut, deleteAccount, errorMessage } = useAuth();
  const { babies, selectedBaby, selectBaby, profile } = useBabies();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  const handleDelete = async () => {
    if (!password) {
      setDeleteError('Enter your password to continue.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(password);
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
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>Help and privacy</List.Subheader>
          <List.Item
            title="Send test feedback"
            description={SUPPORT_EMAIL}
            left={props => <List.Icon {...props} icon="message-text-outline" />}
            onPress={() =>
              openUrl(
                `mailto:${SUPPORT_EMAIL}?subject=BabySteps%20test%20feedback`,
              )
            }
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
          <List.Item
            title="App version"
            description={`${Constants.expoConfig?.version || '0.1.0'} (${Constants.expoConfig?.android?.versionCode || 1})`}
            left={props => <List.Icon {...props} icon="information-outline" />}
          />
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
      </ScrollView>

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => !deleting && setDeleteDialogVisible(false)}
        >
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.deleteCopy}>
              This permanently removes your BabySteps account. Sole-caregiver
              baby profiles and care logs are deleted; shared profiles remain for
              their other caregivers. This cannot be undone.
            </Text>
            <TextInput
              label="Confirm your password"
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={Boolean(deleteError)}
            />
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
              Permanently delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  deleteCopy: {
    marginBottom: 18,
    lineHeight: 20,
  }
});
