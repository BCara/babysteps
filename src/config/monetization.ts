export const ANDROID_PACKAGE_NAME = 'com.cbcreations.babysteps';
export const PREMIUM_SUBSCRIPTION_PRODUCT_ID =
  process.env.EXPO_PUBLIC_PLAY_PREMIUM_PRODUCT_ID || 'babysteps_premium';
export const MONETIZATION_FUNCTIONS_REGION = 'australia-southeast1';
export const PLAY_BILLING_ENABLED =
  !__DEV__ || process.env.EXPO_PUBLIC_ENABLE_PLAY_BILLING_IN_DEV === 'true';

// Google-provided test inventory is deliberately the fallback. app.config.js
// prevents a production EAS build until the real AdMob app ID is supplied too.
export const GOOGLE_TEST_BANNER_AD_UNIT_ID =
  'ca-app-pub-3940256099942544/9214589741';
export const GOOGLE_TEST_INTERSTITIAL_AD_UNIT_ID =
  'ca-app-pub-3940256099942544/1033173712';
export const ADMOB_BANNER_AD_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ||
  GOOGLE_TEST_BANNER_AD_UNIT_ID;
export const ADMOB_INTERSTITIAL_AD_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ||
  GOOGLE_TEST_INTERSTITIAL_AD_UNIT_ID;
export const USING_TEST_ADS =
  ADMOB_BANNER_AD_UNIT_ID === GOOGLE_TEST_BANNER_AD_UNIT_ID ||
  ADMOB_INTERSTITIAL_AD_UNIT_ID === GOOGLE_TEST_INTERSTITIAL_AD_UNIT_ID;

export const PLAY_SUBSCRIPTIONS_URL =
  `https://play.google.com/store/account/subscriptions` +
  `?sku=${encodeURIComponent(PREMIUM_SUBSCRIPTION_PRODUCT_ID)}` +
  `&package=${encodeURIComponent(ANDROID_PACKAGE_NAME)}`;
