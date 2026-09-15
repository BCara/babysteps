const GOOGLE_TEST_ADMOB_ANDROID_APP_ID =
  'ca-app-pub-3940256099942544~3347511713';
const GOOGLE_TEST_ADMOB_IOS_APP_ID =
  'ca-app-pub-3940256099942544~1458002511';
const admobAndroidAppId =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ||
  GOOGLE_TEST_ADMOB_ANDROID_APP_ID;

if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  admobAndroidAppId === GOOGLE_TEST_ADMOB_ANDROID_APP_ID
) {
  throw new Error(
    'Production builds require EXPO_PUBLIC_ADMOB_ANDROID_APP_ID to be set to the real PitterPatter AdMob app ID.',
  );
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    'expo-speech-recognition',
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: admobAndroidAppId,
        iosAppId:
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
          GOOGLE_TEST_ADMOB_IOS_APP_ID,
        delayAppMeasurementInit: true,
        optimizeInitialization: true,
        optimizeAdLoading: true,
      },
    ],
  ],
});
