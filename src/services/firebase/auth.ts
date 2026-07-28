import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export const signInWithEmail = (email: string, password: string) =>
  auth().signInWithEmailAndPassword(email.trim(), password);

export const registerWithEmail = (email: string, password: string) =>
  auth().createUserWithEmailAndPassword(email.trim(), password);

export const sendPasswordReset = (email: string) =>
  auth().sendPasswordResetEmail(email.trim());

export const signOut = () => auth().signOut();

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
    case 'auth/network-request-failed':
      return 'Unable to connect. Check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/weak-password':
      return 'Use a password with at least 8 characters.';
    case 'auth/requires-recent-login':
      return 'For security, sign in again before deleting your account.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong. Try again.';
  }
};
