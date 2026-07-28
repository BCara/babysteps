import auth from '@react-native-firebase/auth';

export const signInWithGoogle = async () => {
  // Google sign in logic will go here
  // Requires GoogleSignin.configure() setup which is platform specific
  throw new Error("Not implemented yet");
};

export const signOut = async () => {
  return auth().signOut();
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
  return auth().onAuthStateChanged(callback);
};
