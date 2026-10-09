import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Button,
  HelperText,
  IconButton,
  List,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/providers/AuthProvider';
import { useBabies } from '../../src/providers/BabyProvider';
import {
  BabyInvite,
  Caregiver,
  createBabyInvite,
  formatInviteCode,
  friendlySharingError,
  inviteShareMessage,
  removeBabyCaregiver,
  revokeBabyInvite,
  subscribeToCaregivers,
} from '../../src/services/caregiverSharing';

export default function SharingScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { babies, selectedBaby } = useBabies();
  const { babyId } = useLocalSearchParams<{ babyId?: string }>();
  const baby = babies.find(item => item.id === babyId) || selectedBaby;
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [invite, setInvite] = useState<BabyInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setInvite(null);
    setError('');
    if (!baby?.id) return;
    return subscribeToCaregivers(baby.id, setCaregivers, nextError =>
      setError(friendlySharingError(nextError)),
    );
  }, [baby?.id]);

  if (!baby?.id || !user) {
    return null;
  }

  const memberIds = baby.authorizedCaregivers || [];
  const ownerId = memberIds[0];
  const isOwner = ownerId === user.uid;
  const people = memberIds.map(id => {
    const record = caregivers.find(caregiver => caregiver.id === id);
    return {
      id,
      name:
        id === user.uid
          ? 'You'
          : record?.displayName || record?.email || 'Caregiver',
      detail: [id === ownerId ? 'Created this profile' : null, record?.email]
        .filter(Boolean)
        .join(' · '),
    };
  });

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (nextError) {
      setError(friendlySharingError(nextError));
    } finally {
      setBusy(false);
    }
  };

  const createInvite = () =>
    run(async () => {
      const nextInvite = await createBabyInvite(baby.id!);
      setInvite(nextInvite);
      await Share.share({ message: inviteShareMessage(nextInvite) });
    });

  const cancelInvite = () =>
    run(async () => {
      if (!invite) return;
      await revokeBabyInvite(invite.code);
      setInvite(null);
      setNotice('Invite cancelled. That code no longer works.');
    });

  const confirmRemove = (person: { id: string; name: string }) =>
    Alert.alert(
      `Remove ${person.name}?`,
      `They will no longer see or log care for ${baby.name}. Care they already logged stays.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await removeBabyCaregiver(baby.id!, person.id);
              setNotice(`${person.name} no longer has access.`);
            }),
        },
      ],
    );

  const confirmLeave = () =>
    Alert.alert(
      `Leave ${baby.name}’s profile?`,
      'You will lose access to this baby’s care log. Another caregiver can invite you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await removeBabyCaregiver(baby.id!);
              router.back();
            }),
        },
      ],
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <View style={styles.topBarCopy}>
          <Text variant="titleLarge" style={styles.title}>
            Share {baby.name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Partners and carers see the same care log and can add to it
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Invite a partner or carer
          </Text>
          {invite ? (
            <>
              <Text variant="bodyMedium" style={styles.cardCopy}>
                Send them this code. They enter it after signing in to
                PitterPatter. It works once and expires on{' '}
                {new Date(invite.expiresAtMillis).toLocaleDateString([], {
                  day: 'numeric',
                  month: 'long',
                })}
                .
              </Text>
              <Text
                variant="displaySmall"
                selectable
                style={[styles.code, { color: theme.colors.primary }]}
                accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}
              >
                {formatInviteCode(invite.code)}
              </Text>
              <View style={styles.row}>
                <Button
                  mode="contained"
                  icon="share-variant"
                  onPress={() =>
                    Share.share({ message: inviteShareMessage(invite) })
                  }
                  disabled={busy}
                >
                  Share again
                </Button>
                <Button mode="text" onPress={cancelInvite} disabled={busy}>
                  Cancel invite
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text variant="bodyMedium" style={styles.cardCopy}>
                They’ll get full access to {baby.name}’s profile: feeds,
                sleeps, nappies, health records and stats. Only invite people
                you trust with your child’s details.
              </Text>
              <Button
                mode="contained"
                icon="account-plus-outline"
                onPress={createInvite}
                loading={busy}
                disabled={busy}
                contentStyle={styles.buttonContent}
              >
                Create invite
              </Button>
            </>
          )}
        </Surface>

        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>

        <List.Section>
          <List.Subheader>Who has access</List.Subheader>
          {people.map(person => (
            <List.Item
              key={person.id}
              title={person.name}
              description={person.detail || undefined}
              left={props => (
                <List.Icon
                  {...props}
                  icon={
                    person.id === ownerId
                      ? 'account-star-outline'
                      : 'account-outline'
                  }
                />
              )}
              right={props =>
                isOwner && person.id !== user.uid ? (
                  <IconButton
                    {...props}
                    icon="account-remove-outline"
                    accessibilityLabel={`Remove ${person.name}`}
                    onPress={() => confirmRemove(person)}
                    disabled={busy}
                  />
                ) : null
              }
            />
          ))}
        </List.Section>

        {!isOwner && memberIds.length > 1 ? (
          <Button
            mode="text"
            textColor={theme.colors.error}
            onPress={confirmLeave}
            disabled={busy}
          >
            Leave this profile
          </Button>
        ) : null}
      </ScrollView>

      <Snackbar
        visible={Boolean(notice)}
        onDismiss={() => setNotice('')}
        duration={4000}
      >
        {notice}
      </Snackbar>
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
  content: { padding: 18, paddingBottom: 40 },
  card: { borderRadius: 18, padding: 18, gap: 12 },
  cardTitle: { fontWeight: '800' },
  cardCopy: { lineHeight: 20, opacity: 0.8 },
  code: {
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginVertical: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttonContent: { minHeight: 48 },
});
