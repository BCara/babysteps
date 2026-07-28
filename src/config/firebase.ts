import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

let emulatorsConfigured = false;

export const configureFirebaseEmulators = () => {
  if (
    emulatorsConfigured ||
    !__DEV__ ||
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS !== 'true'
  ) {
    return;
  }

  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '10.0.2.2';
  auth().useEmulator(`http://${host}:9099`);
  firestore().useEmulator(host, 8080);
  emulatorsConfigured = true;
};

export { auth, firestore, firebase };
