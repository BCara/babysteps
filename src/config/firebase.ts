import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Initialize Firebase if not already initialized
// In React Native with @react-native-firebase, initialization is typically handled natively
// via GoogleService-Info.plist and google-services.json.
// We just export the modules here for convenience.

export { auth, firestore, firebase };
