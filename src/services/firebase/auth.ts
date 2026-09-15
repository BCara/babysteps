import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import googleServices from '../../../google-services.json';

interface GoogleServicesClient {
  oauth_client?: Array<{
    client_id?: string;
    client_type?: number;
  }>;
}

const googleWebClientId = (
  (googleServices.client as GoogleServicesClient[] | undefined) || []
)
  .flatMap(client => client.oauth_client || [])
  .find(client => client.client_type === 3)?.client_id;

GoogleSignin.configure({
  webClientId: googleWebClientId,
});

const googleAuthError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

const getGoogleTokens = async (cancelIsError = false) => {
  if (!googleWebClientId) {
    throw googleAuthError(
      'google-sign-in/not-configured',
      'Google sign-in is not configured for this build yet.',
    );
  }

  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  const result = await GoogleSignin.signIn();
  if (result.type === 'cancelled') {
    if (cancelIsError) {
      throw googleAuthError(
        'google-sign-in/cancelled',
        'Google sign-in was cancelled.',
      );
    }
    return null;
  }

  const tokens = await GoogleSignin.getTokens();

  if (!tokens.idToken) {
    throw googleAuthError(
      'google-sign-in/no-id-token',
      'Google did not return a sign-in token. Try again.',
    );
  }

  if (!tokens.accessToken) {
    throw googleAuthError(
      'google-sign-in/no-access-token',
      'Google did not return an access token. Try again.',
    );
  }

  return tokens;
};

export const signInWithEmail = (email: string, password: string) =>
  auth().signInWithEmailAndPassword(email.trim(), password);

export const signInWithGoogle = async () => {
  const tokens = await getGoogleTokens();
  if (!tokens) return null;

  const credential = auth.GoogleAuthProvider.credential(
    tokens.idToken,
    tokens.accessToken,
  );
  return auth().signInWithCredential(credential);
};

export const registerWithEmail = (email: string, password: string) =>
  auth().createUserWithEmailAndPassword(email.trim(), password);

export const sendPasswordReset = (email: string) =>
  auth().sendPasswordResetEmail(email.trim());

export const signOut = async () => {
  await auth().signOut();

  if (GoogleSignin.hasPreviousSignIn()) {
    await GoogleSignin.signOut().catch(() => null);
  }
};

export const subscribeToAuthChanges = (
  callback: (user: FirebaseAuthTypes.User | null) => void,
) => auth().onAuthStateChanged(callback);

export const reauthenticateWithPassword = async (
  user: FirebaseAuthTypes.User,
  password: string,
) => {
  if (!user.email) {
    throw new Error('This account does not have an email address.');
  }

  const credential = auth.EmailAuthProvider.credential(user.email, password);
  await user.reauthenticateWithCredential(credential);
};

export const reauthenticateWithGoogle = async (
  user: FirebaseAuthTypes.User,
) => {
  const tokens = await getGoogleTokens(true);
  const credential = auth.GoogleAuthProvider.credential(
    tokens!.idToken,
    tokens!.accessToken,
  );
  await user.reauthenticateWithCredential(credential);
};

export const getAuthErrorMessage = (error: unknown) => {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists for this email. Log in with email and password first.';
    case 'auth/network-request-failed':
      return 'Unable to connect. Check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/weak-password':
      return 'Use a password with at least 8 characters.';
    case 'auth/requires-recent-login':
      return 'For security, sign in again before deleting your account.';
    case 'google-sign-in/not-configured':
    case 'google-sign-in/cancelled':
    case 'google-sign-in/no-id-token':
    case 'google-sign-in/no-access-token':
      return error instanceof Error
        ? error.message
        : 'Google sign-in did not complete. Try again.';
    default:
      if (
        isErrorWithCode(error) &&
        error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
      ) {
        return 'Google Play services is unavailable or needs an update.';
      }
      return error instanceof Error ? error.message : 'Something went wrong. Try again.';
  }
};
