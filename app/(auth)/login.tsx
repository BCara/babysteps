import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { Link } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, signInWithGoogle, resetPassword, errorMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
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
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text variant="headlineLarge" style={styles.title}>
          Welcome back
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Keep everyday care in one calm place.
        </Text>

        <TextInput
          label="Email"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          style={styles.input}
        />
        <TextInput
          label="Password"
          mode="outlined"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          style={styles.input}
        />

        <HelperText type="error" visible={Boolean(error)}>
          {error}
        </HelperText>
        <HelperText type="info" visible={resetSent}>
          Password reset email sent. Check your inbox.
        </HelperText>

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={busy}
          disabled={busy}
          contentStyle={styles.buttonContent}
        >
          Log in
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
              onPress={handleGoogleLogin}
              disabled={busy}
              contentStyle={styles.buttonContent}
            >
              Continue with Google
            </Button>
          </>
        ) : null}

        <Button mode="text" onPress={handleReset} disabled={busy}>
          Forgot password?
        </Button>

        <View style={styles.signupRow}>
          <Text>New to PitterPatter?</Text>
          <Link href="/(auth)/register" asChild>
            <Button mode="text" compact>
              Create account
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
  logo: {
    width: 104,
    height: 104,
    borderRadius: 26,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
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
  signupRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
});
