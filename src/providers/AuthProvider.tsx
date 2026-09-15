import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  getAuthErrorMessage,
  reauthenticateWithGoogle,
  reauthenticateWithPassword,
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  subscribeToAuthChanges,
} from '../services/firebase/auth';
import {
  deleteUserData,
  ensureUserProfile,
} from '../services/firebase/users';
import { configureFirebaseEmulators } from '../config/firebase';

interface AuthContextValue {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  register: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  errorMessage: (error: unknown) => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    configureFirebaseEmulators();
    return subscribeToAuthChanges(nextUser => {
      setUser(nextUser);
      setInitializing(false);

      if (nextUser?.email) {
        ensureUserProfile(
          nextUser.uid,
          nextUser.email,
          nextUser.displayName || '',
        ).catch(error => console.warn('Unable to ensure user profile', error));
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signIn: async (email, password) => {
        await signInWithEmail(email, password);
      },
      signInWithGoogle: async () => {
        const credential = await firebaseSignInWithGoogle();
        return Boolean(credential);
      },
      register: async (displayName, email, password) => {
        const credential = await registerWithEmail(email, password);
        await credential.user.updateProfile({ displayName: displayName.trim() });
        await ensureUserProfile(
          credential.user.uid,
          credential.user.email || email.trim(),
          displayName,
        );
      },
      resetPassword: async email => {
        await sendPasswordReset(email);
      },
      signOut: firebaseSignOut,
      deleteAccount: async password => {
        if (!user) throw new Error('You are not signed in.');

        const usesPassword = user.providerData.some(
          provider => provider.providerId === 'password',
        );
        const usesGoogle = user.providerData.some(
          provider => provider.providerId === 'google.com',
        );

        if (usesPassword) {
          if (!password) throw new Error('Enter your password to continue.');
          await reauthenticateWithPassword(user, password);
        } else if (usesGoogle) {
          await reauthenticateWithGoogle(user);
        } else {
          throw new Error(
            'This sign-in method cannot be verified in the app. Log out, sign in again, then retry.',
          );
        }

        await deleteUserData(user.uid);
        await user.delete();
      },
      errorMessage: getAuthErrorMessage,
    }),
    [initializing, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
