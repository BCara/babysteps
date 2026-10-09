import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Button,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  acceptBabyInvite,
  formatInviteCode,
  friendlySharingError,
} from '../../src/services/caregiverSharing';

const cleanCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export default function JoinBabyScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(() => cleanCode(params.code || ''));
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (code.length !== 8) {
      setError('Invite codes are 8 letters and numbers.');
      return;
    }
    setJoining(true);
    setError('');
    try {
      // The new baby becomes the active profile server-side, so Home opens on it.
      await acceptBabyInvite(code);
      router.replace('/(app)/(tabs)');
    } catch (nextError) {
      setError(friendlySharingError(nextError));
    } finally {
      setJoining(false);
    }
  };

  const close = () =>
    router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)');

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarCopy}>
          <Text variant="headlineSmall" style={styles.title}>
            Join a baby’s profile
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Enter the code a partner or carer shared with you.
          </Text>
        </View>
        <IconButton icon="close" onPress={close} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Invite code"
          mode="outlined"
          value={formatInviteCode(code)}
          onChangeText={value => setCode(cleanCode(value))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={!params.code}
          maxLength={9}
          placeholder="K7QM-3XPD"
          style={styles.input}
          contentStyle={styles.codeInput}
          error={Boolean(error)}
          onSubmitEditing={handleJoin}
        />
        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>

        <Button
          mode="contained"
          onPress={handleJoin}
          loading={joining}
          disabled={joining}
          contentStyle={styles.button}
        >
          Join
        </Button>

        <Text variant="bodySmall" style={styles.note}>
          You’ll see the same care log as the person who invited you, and
          anything you log will be visible to them.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  topBarCopy: { flex: 1 },
  title: { fontWeight: 'bold' },
  subtitle: { marginTop: 4, opacity: 0.7 },
  content: {
    padding: 24,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  input: { marginBottom: 2 },
  codeInput: { fontSize: 22, letterSpacing: 3 },
  button: { minHeight: 52 },
  note: { textAlign: 'center', opacity: 0.66, marginTop: 18, lineHeight: 18 },
});
