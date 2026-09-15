export const INTERSTITIAL_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const canShowInterstitial = (
  lastShownAt: string | null,
  now = Date.now(),
) => {
  if (!lastShownAt) return true;

  const previous = Number(lastShownAt);
  if (!Number.isFinite(previous)) return true;

  return now - previous >= INTERSTITIAL_MIN_INTERVAL_MS;
};

export const interstitialStorageKey = (uid: string) =>
  `babysteps.interstitial.lastShown.${uid}`;
