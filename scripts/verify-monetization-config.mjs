const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const production =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.argv.includes('--production');

const appId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || TEST_APP_ID;
const bannerId = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TEST_BANNER_ID;
const interstitialId =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || TEST_INTERSTITIAL_ID;
const productId =
  process.env.EXPO_PUBLIC_PLAY_PREMIUM_PRODUCT_ID || 'babysteps_premium';

const requireMatch = (label, value, pattern) => {
  if (!pattern.test(value)) {
    throw new Error(`${label} has an invalid format.`);
  }
};

requireMatch(
  'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
  appId,
  /^ca-app-pub-\d{16}~\d{10}$/,
);
requireMatch(
  'EXPO_PUBLIC_ADMOB_BANNER_ID',
  bannerId,
  /^ca-app-pub-\d{16}\/\d{10}$/,
);
requireMatch(
  'EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID',
  interstitialId,
  /^ca-app-pub-\d{16}\/\d{10}$/,
);
requireMatch(
  'EXPO_PUBLIC_PLAY_PREMIUM_PRODUCT_ID',
  productId,
  /^[a-z][a-z0-9_.]{2,49}$/,
);

if (
  production &&
  (appId === TEST_APP_ID ||
    bannerId === TEST_BANNER_ID ||
    interstitialId === TEST_INTERSTITIAL_ID)
) {
  throw new Error(
    'Production monetisation configuration is incomplete. Set the real AdMob app, banner and interstitial IDs in the EAS production environment.',
  );
}

console.log(
  production
    ? 'Production monetisation identifiers are configured.'
    : 'Monetisation configuration is valid; Google test ads are allowed for this non-production build.',
);
