import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, Button, HelperText, TextInput, useTheme } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function RegisterScreen() {
  const theme = useTheme();
  const { register, signInWithGoogle, errorMessage } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('Complete all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await register(name, email, password);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleRegister = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="headlineLarge" style={styles.title}>
          Create your account
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          You’ll add your baby on the next screen.
        </Text>

        <TextInput
          label="Your name"
          mode="outlined"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          style={styles.input}
        />
        <TextInput
          label="Email"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          label="Password"
          mode="outlined"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          style={styles.input}
        />
        <TextInput
          label="Confirm password"
          mode="outlined"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleRegister}
          style={styles.input}
        />
        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>

        <Button
          mode="contained"
          onPress={handleRegister}
          loading={busy}
          disabled={busy}
          contentStyle={styles.buttonContent}
        >
          Create account
        </Button>

        {Platform.OS === 'android' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text variant="bodySmall" style={styles.dividerText}>
                or
              </Text>
              <View style={styles.divider} />
            </View>
            <Button
              mode="outlined"
              icon="google"
              onPress={handleGoogleRegister}
              disabled={busy}
              contentStyle={styles.buttonContent}
            >
              Continue with Google
            </Button>
          </>
        ) : null}

        <View style={styles.loginRow}>
          <Text>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <Button mode="text" compact>
              Log in
            </Button>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 28,
    opacity: 0.7,
  },
  input: {
    marginBottom: 12,
  },
  buttonContent: {
    minHeight: 50,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#9CA3AF',
  },
  dividerText: {
    marginHorizontal: 12,
    opacity: 0.65,
  },
  loginRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
});
