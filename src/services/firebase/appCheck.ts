import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  ReactNativeFirebaseAppCheckProvider,
  initializeAppCheck,
} from '@react-native-firebase/app-check';

let initialization: Promise<void> | null = null;

export const ensureAppCheckReady = () => {
  if (Platform.OS === 'web') {
    return Promise.reject(
      new Error('The PitterPatter Assistant is available in the Android app.'),
    );
  }
  if (initialization) return initialization;

  const provider = new ReactNativeFirebaseAppCheckProvider();
  const debugToken = process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN;
  provider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      ...(__DEV__ && debugToken ? { debugToken } : {}),
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      ...(__DEV__ && debugToken ? { debugToken } : {}),
    },
  });
  initialization = initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  })
    .then(() => undefined)
    .catch(error => {
      initialization = null;
      throw error;
    });
  return initialization;
};
