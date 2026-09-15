import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import {
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import * as Crypto from 'expo-crypto';
import {
  finishTransaction,
  getAvailablePurchases,
  Purchase,
  ProductSubscription,
  useIAP,
} from 'expo-iap';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import { useAuth } from './AuthProvider';
import {
  Entitlement,
  FREE_ENTITLEMENT,
  subscribeToEntitlement,
} from '../services/firebase/entitlements';
import {
  ADMOB_INTERSTITIAL_AD_UNIT_ID,
  MONETIZATION_FUNCTIONS_REGION,
  PLAY_BILLING_ENABLED,
  PLAY_SUBSCRIPTIONS_URL,
  PREMIUM_SUBSCRIPTION_PRODUCT_ID,
} from '../config/monetization';
import {
  canShowInterstitial,
  interstitialStorageKey,
} from '../utils/interstitialFrequency';

export interface PremiumPlan {
  basePlanId: string;
  label: string;
  price: string;
  period: string;
  offerToken: string;
}

interface MonetizationContextValue {
  entitlement: Entitlement;
  entitlementLoading: boolean;
  isAdFree: boolean;
  adsReady: boolean;
  privacyOptionsRequired: boolean;
  storeConnected: boolean;
  plans: PremiumPlan[];
  purchaseBusy: boolean;
  notice: string;
  purchasePlan: (basePlanId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  manageSubscription: () => Promise<void>;
  maybeShowInterstitial: () => Promise<boolean>;
  showAdPrivacyOptions: () => Promise<void>;
  clearNotice: () => void;
}

interface VerifyPurchaseResponse {
  entitlement: Pick<Entitlement, 'accessLevel' | 'adFree'>;
}

const MonetizationContext =
  createContext<MonetizationContextValue | null>(null);

const callableFunctions = getFunctions(
  getApp(),
  MONETIZATION_FUNCTIONS_REGION,
);

const friendlyPeriod = (period: string) => {
  if (period === 'P1W') return 'week';
  if (period === 'P1M') return 'month';
  if (period === 'P3M') return '3 months';
  if (period === 'P6M') return '6 months';
  if (period === 'P1Y') return 'year';
  return period;
};

const planLabel = (basePlanId: string, period: string) => {
  if (period === 'P1Y' || basePlanId.toLowerCase().includes('annual')) {
    return 'Annual';
  }
  if (period === 'P1M' || basePlanId.toLowerCase().includes('month')) {
    return 'Monthly';
  }
  return basePlanId
    .replaceAll('-', ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
};

const plansFromSubscriptions = (subscriptions: ProductSubscription[]) =>
  subscriptions
    .filter(subscription => subscription.id === PREMIUM_SUBSCRIPTION_PRODUCT_ID)
    .flatMap(subscription => {
      if (subscription.platform !== 'android') return [];

      return subscription.subscriptionOfferDetailsAndroid.map(offer => {
        const phases = offer.pricingPhases.pricingPhaseList;
        const recurringPhase = phases[phases.length - 1];
        if (!recurringPhase) return null;

        return {
          basePlanId: offer.basePlanId,
          label: planLabel(offer.basePlanId, recurringPhase.billingPeriod),
          price: recurringPhase.formattedPrice,
          period: friendlyPeriod(recurringPhase.billingPeriod),
          offerToken: offer.offerToken,
        };
      });
    })
    .filter((plan): plan is PremiumPlan => Boolean(plan))
    .sort((left, right) =>
      left.period === 'month' && right.period !== 'month' ? -1 : 1,
    );

export function MonetizationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [entitlement, setEntitlement] =
    useState<Entitlement>(FREE_ENTITLEMENT);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [adsReady, setAdsReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const interstitialShowingRef = useRef(false);

  const verifyPurchase = useCallback(
    async (purchase: Purchase) => {
      if (!user || purchase.productId !== PREMIUM_SUBSCRIPTION_PRODUCT_ID) {
        return;
      }
      if (purchase.purchaseState !== 'purchased' || !purchase.purchaseToken) {
        setNotice('The purchase is still pending in Google Play.');
        return;
      }

      const verify = httpsCallable<
        { productId: string; purchaseToken: string },
        VerifyPurchaseResponse
      >(callableFunctions, 'entitlements_verifyPlaySubscription');

      await verify({
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
      });

      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // The backend normally acknowledges first. A second acknowledgement can
        // be rejected by Play even though the entitlement is already secured.
      }
      setNotice('Premium is active. PitterPatter is now ad-free.');
    },
    [user],
  );

  const {
    connected: billingClientConnected,
    subscriptions,
    fetchProducts,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess: purchase => {
      setPurchaseBusy(true);
      verifyPurchase(purchase)
        .catch(error =>
          setNotice(
            error instanceof Error
              ? error.message
              : 'The purchase could not be verified.',
          ),
        )
        .finally(() => setPurchaseBusy(false));
    },
    onPurchaseError: error => {
      setPurchaseBusy(false);
      if (error.code !== 'user-cancelled') {
        setNotice(error.message || 'The purchase did not complete.');
      }
    },
    onError: error => {
      if (PLAY_BILLING_ENABLED) setNotice(error.message);
    },
  });

  const storeConnected = PLAY_BILLING_ENABLED && billingClientConnected;

  useEffect(() => {
    setEntitlement(FREE_ENTITLEMENT);
    setEntitlementLoading(Boolean(user));
    if (!user) return;

    const unsubscribe = subscribeToEntitlement(
      user.uid,
      nextEntitlement => {
        setEntitlement(nextEntitlement);
        setEntitlementLoading(false);
      },
      error => {
        setNotice(error.message);
        setEntitlementLoading(false);
      },
    );

    const sync = httpsCallable<undefined, VerifyPurchaseResponse>(
      callableFunctions,
      'entitlements_syncCurrentUser',
    );
    sync().catch(error =>
      setNotice(
        error instanceof Error
          ? error.message
          : 'Unable to refresh account access.',
      ),
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!storeConnected || !user || Platform.OS !== 'android') return;
    fetchProducts({
      skus: [PREMIUM_SUBSCRIPTION_PRODUCT_ID],
      type: 'subs',
    }).catch(error =>
      setNotice(
        error instanceof Error
          ? error.message
          : 'Google Play plans are unavailable.',
      ),
    );
  }, [fetchProducts, storeConnected, user]);

  useEffect(() => {
    setAdsReady(false);
    if (
      Platform.OS !== 'android' ||
      entitlementLoading ||
      entitlement.adFree ||
      !user
    ) {
      return;
    }

    let active = true;
    const prepareAds = async () => {
      try {
        const consent = await AdsConsent.gatherConsent({
          tagForUnderAgeOfConsent: false,
        });
        if (!active) return;

        setPrivacyOptionsRequired(
          consent.privacyOptionsRequirementStatus ===
            AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        );
        if (!consent.canRequestAds) return;

        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
        if (active) setAdsReady(true);
      } catch (error) {
        if (active) {
          setNotice(
            error instanceof Error
              ? `Ads are unavailable: ${error.message}`
              : 'Ads are currently unavailable.',
          );
        }
      }
    };

    prepareAds();
    return () => {
      active = false;
    };
  }, [entitlement.adFree, entitlementLoading, user]);

  useEffect(() => {
    interstitialRef.current?.removeAllListeners();
    interstitialRef.current = null;

    if (!adsReady || entitlement.adFree || !user) return;

    let active = true;
    let removeLoadedListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;

    const preload = async () => {
      const lastShownAt = await AsyncStorage.getItem(
        interstitialStorageKey(user.uid),
      );
      if (!active || !canShowInterstitial(lastShownAt)) return;

      const interstitial = InterstitialAd.createForAdRequest(
        ADMOB_INTERSTITIAL_AD_UNIT_ID,
        { requestNonPersonalizedAdsOnly: true },
      );
      interstitialRef.current = interstitial;
      removeLoadedListener = interstitial.addAdEventListener(
        AdEventType.LOADED,
        () => {
          // Keep the ad preloaded until the next natural break.
        },
      );
      removeErrorListener = interstitial.addAdEventListener(
        AdEventType.ERROR,
        () => {
          if (interstitialRef.current === interstitial) {
            interstitialRef.current = null;
          }
        },
      );
      interstitial.load();
    };

    preload().catch(() => {
      // Ads are optional. A storage or load failure must never interrupt care
      // logging or display an error to the caregiver.
    });

    return () => {
      active = false;
      removeLoadedListener?.();
      removeErrorListener?.();
      interstitialRef.current?.removeAllListeners();
      interstitialRef.current = null;
    };
  }, [adsReady, entitlement.adFree, user]);

  const maybeShowInterstitial = useCallback(async () => {
    if (
      !adsReady ||
      entitlement.adFree ||
      !user ||
      interstitialShowingRef.current
    ) {
      return false;
    }

    const storageKey = interstitialStorageKey(user.uid);
    const lastShownAt = await AsyncStorage.getItem(storageKey);
    if (!canShowInterstitial(lastShownAt)) return false;

    const interstitial = interstitialRef.current;
    if (!interstitial?.loaded) return false;

    interstitialShowingRef.current = true;
    try {
      await interstitial.show();
      await AsyncStorage.setItem(storageKey, String(Date.now()));
      interstitial.removeAllListeners();
      interstitialRef.current = null;
      return true;
    } catch {
      interstitial.removeAllListeners();
      interstitialRef.current = null;
      return false;
    } finally {
      interstitialShowingRef.current = false;
    }
  }, [adsReady, entitlement.adFree, user]);

  const plans = useMemo(
    () => plansFromSubscriptions(subscriptions),
    [subscriptions],
  );

  const purchasePlan = useCallback(
    async (basePlanId: string) => {
      if (!user) throw new Error('Sign in before purchasing Premium.');
      if (!storeConnected) {
        throw new Error(
          'Google Play Billing is not connected. Install the app from a Play test track and try again.',
        );
      }

      const plan = plans.find(candidate => candidate.basePlanId === basePlanId);
      if (!plan) {
        throw new Error(
          'That Premium plan is not available to this Google Play account.',
        );
      }

      setPurchaseBusy(true);
      setNotice('');
      const obfuscatedAccountId = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        user.uid,
      );
      try {
        await requestPurchase({
          request: {
            google: {
              skus: [PREMIUM_SUBSCRIPTION_PRODUCT_ID],
              subscriptionOffers: [
                {
                  sku: PREMIUM_SUBSCRIPTION_PRODUCT_ID,
                  offerToken: plan.offerToken,
                },
              ],
              obfuscatedAccountId,
            },
          },
          type: 'subs',
        });
      } catch (error) {
        setPurchaseBusy(false);
        throw error;
      }
    },
    [plans, requestPurchase, storeConnected, user],
  );

  const restore = useCallback(async () => {
    if (!user) throw new Error('Sign in before restoring purchases.');
    if (!storeConnected) {
      throw new Error(
        'Google Play Billing is not connected. Install the app from a Play test track and try again.',
      );
    }

    setPurchaseBusy(true);
    setNotice('');
    try {
      const purchases = await getAvailablePurchases({
        includeSuspendedAndroid: true,
      });
      const premiumPurchases = purchases.filter(
        purchase =>
          purchase.productId === PREMIUM_SUBSCRIPTION_PRODUCT_ID &&
          purchase.purchaseState === 'purchased' &&
          !(
            'isSuspendedAndroid' in purchase &&
            purchase.isSuspendedAndroid
          ),
      );
      if (!premiumPurchases.length) {
      setNotice('No active PitterPatter Premium purchase was found.');
        return;
      }
      for (const purchase of premiumPurchases) {
        await verifyPurchase(purchase);
      }
    } finally {
      setPurchaseBusy(false);
    }
  }, [storeConnected, user, verifyPurchase]);

  const showAdPrivacyOptions = useCallback(async () => {
    const info = await AdsConsent.showPrivacyOptionsForm();
    setPrivacyOptionsRequired(
      info.privacyOptionsRequirementStatus ===
        AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    );
  }, []);

  const value = useMemo<MonetizationContextValue>(
    () => ({
      entitlement,
      entitlementLoading,
      isAdFree: entitlement.adFree,
      adsReady,
      privacyOptionsRequired,
      storeConnected,
      plans,
      purchaseBusy,
      notice,
      purchasePlan: async basePlanId => {
        try {
          await purchasePlan(basePlanId);
        } catch (error) {
          setNotice(
            error instanceof Error ? error.message : 'Unable to start purchase.',
          );
        }
      },
      restorePurchases: async () => {
        try {
          await restore();
        } catch (error) {
          setNotice(
            error instanceof Error
              ? error.message
              : 'Unable to restore purchases.',
          );
        }
      },
      manageSubscription: () => Linking.openURL(PLAY_SUBSCRIPTIONS_URL),
      maybeShowInterstitial,
      showAdPrivacyOptions,
      clearNotice: () => setNotice(''),
    }),
    [
      adsReady,
      entitlement,
      entitlementLoading,
      maybeShowInterstitial,
      notice,
      plans,
      privacyOptionsRequired,
      purchaseBusy,
      purchasePlan,
      restore,
      showAdPrivacyOptions,
      storeConnected,
    ],
  );

  return (
    <MonetizationContext.Provider value={value}>
      {children}
    </MonetizationContext.Provider>
  );
}

export const useMonetization = () => {
  const context = useContext(MonetizationContext);
  if (!context) {
    throw new Error(
      'useMonetization must be used inside MonetizationProvider.',
    );
  }
  return context;
};
