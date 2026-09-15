import { createHash } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { defineString } from 'firebase-functions/params';
import {
  HttpsError,
  onCall,
} from 'firebase-functions/v2/https';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import * as functionsV1 from 'firebase-functions/v1';
import { GoogleAuth } from 'google-auth-library';

const REGION = 'australia-southeast1';
const DEFAULT_PACKAGE_NAME = 'com.cbcreations.babysteps';
const DEFAULT_PREMIUM_PRODUCT_ID = 'babysteps_premium';
const DEFAULT_LEGACY_SIGNUP_CUTOFF = '2026-07-30T23:59:59+10:00';
const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';

const packageNameParameter = defineString('PLAY_PACKAGE_NAME', {
  default: DEFAULT_PACKAGE_NAME,
});
const premiumProductIdsParameter = defineString(
  'PLAY_SUBSCRIPTION_PRODUCT_IDS',
  {
    default: DEFAULT_PREMIUM_PRODUCT_ID,
  },
);
const legacyAccountEmailsParameter = defineString('LEGACY_ACCOUNT_EMAILS', {
  default: '',
});
const legacySignupCutoffParameter = defineString(
  'LEGACY_SIGNUP_CUTOFF_ISO',
  {
    default: DEFAULT_LEGACY_SIGNUP_CUTOFF,
  },
);

type SubscriptionState =
  | 'SUBSCRIPTION_STATE_PENDING'
  | 'SUBSCRIPTION_STATE_ACTIVE'
  | 'SUBSCRIPTION_STATE_PAUSED'
  | 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_STATE_ON_HOLD'
  | 'SUBSCRIPTION_STATE_CANCELED'
  | 'SUBSCRIPTION_STATE_EXPIRED'
  | 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'
  | 'SUBSCRIPTION_STATE_UNSPECIFIED';

interface GoogleSubscriptionPurchase {
  acknowledgementState?: string;
  subscriptionState?: SubscriptionState;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: string;
  };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: {
      autoRenewEnabled?: boolean;
    };
    offerDetails?: {
      basePlanId?: string;
      offerId?: string;
    };
  }>;
}

interface RtdnPayload {
  packageName?: string;
  subscriptionNotification?: {
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  testNotification?: {
    version?: string;
  };
}

interface PurchaseRecord {
  uid: string;
  productId: string;
  basePlanId: string | null;
  purchaseToken: string;
  subscriptionState: SubscriptionState;
  entitled: boolean;
  expiresAt: admin.firestore.Timestamp | null;
}

const db = () => admin.firestore();
const tokenHash = (purchaseToken: string) =>
  createHash('sha256').update(purchaseToken).digest('hex');
const accountHash = (uid: string) =>
  createHash('sha256').update(uid).digest('hex');

const commaSeparatedValues = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const allowedProductIds = () =>
  commaSeparatedValues(premiumProductIdsParameter.value());

const qualifiesForLegacyAccess = async (uid: string, email: string) => {
  const legacyEmails = commaSeparatedValues(
    legacyAccountEmailsParameter.value(),
  ).map(value => value.toLowerCase());
  if (email && legacyEmails.includes(email)) {
    return true;
  }

  const cutoffMillis = Date.parse(legacySignupCutoffParameter.value());
  if (!Number.isFinite(cutoffMillis)) {
    return false;
  }

  const authUser = await admin.auth().getUser(uid);
  const createdMillis = Date.parse(authUser.metadata.creationTime);
  return Number.isFinite(createdMillis) && createdMillis <= cutoffMillis;
};

const getAccessToken = async () => {
  const auth = new GoogleAuth({ scopes: [ANDROID_PUBLISHER_SCOPE] });
  const client = await auth.getClient();
  const result = await client.getAccessToken();
  const accessToken =
    typeof result === 'string' ? result : result?.token;
  if (!accessToken) {
    throw new Error('Android Publisher access token was not available.');
  }
  return accessToken;
};

const publisherRequest = async <T>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Android Publisher API returned ${response.status}: ${body.slice(0, 400)}`,
    );
  }
  return (body ? JSON.parse(body) : {}) as T;
};

const getGoogleSubscription = (purchaseToken: string) => {
  const packageName = encodeURIComponent(packageNameParameter.value());
  const token = encodeURIComponent(purchaseToken);
  return publisherRequest<GoogleSubscriptionPurchase>(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${token}`,
  );
};

const acknowledgeGoogleSubscription = async (
  productId: string,
  purchaseToken: string,
) => {
  const packageName = encodeURIComponent(packageNameParameter.value());
  const subscriptionId = encodeURIComponent(productId);
  const token = encodeURIComponent(purchaseToken);
  await publisherRequest<Record<string, never>>(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${token}:acknowledge`,
    {
      method: 'POST',
      body: '{}',
    },
  );
};

const latestLineItem = (subscription: GoogleSubscriptionPurchase) =>
  [...(subscription.lineItems || [])]
    .filter(item => item.productId && item.expiryTime)
    .sort(
      (left, right) =>
        Date.parse(right.expiryTime || '') - Date.parse(left.expiryTime || ''),
    )[0];

const hasCurrentEntitlement = (
  state: SubscriptionState,
  expiryTime?: string,
) => {
  const expiresInFuture =
    Boolean(expiryTime) && Date.parse(expiryTime || '') > Date.now();
  return (
    expiresInFuture &&
    (state === 'SUBSCRIPTION_STATE_ACTIVE' ||
      state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
      state === 'SUBSCRIPTION_STATE_CANCELED')
  );
};

const normalisePurchase = (
  uid: string,
  purchaseToken: string,
  subscription: GoogleSubscriptionPurchase,
): PurchaseRecord => {
  const item = latestLineItem(subscription);
  const state =
    subscription.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED';
  const expiryDate = item?.expiryTime ? new Date(item.expiryTime) : null;

  if (!item?.productId || !allowedProductIds().includes(item.productId)) {
    throw new HttpsError(
      'permission-denied',
      'This Google Play purchase does not grant PitterPatter Premium.',
    );
  }

  return {
    uid,
    productId: item.productId,
    basePlanId: item.offerDetails?.basePlanId || null,
    purchaseToken,
    subscriptionState: state,
    entitled: hasCurrentEntitlement(state, item.expiryTime),
    expiresAt:
      expiryDate && Number.isFinite(expiryDate.getTime())
        ? admin.firestore.Timestamp.fromDate(expiryDate)
        : null,
  };
};

const savePurchaseRecord = async (record: PurchaseRecord) => {
  const reference = db().collection('playPurchases').doc(
    tokenHash(record.purchaseToken),
  );

  await db().runTransaction(async transaction => {
    const existing = await transaction.get(reference);
    const existingUid = existing.data()?.uid;
    if (existing.exists && existingUid && existingUid !== record.uid) {
      throw new HttpsError(
        'already-exists',
        'This Google Play purchase is already linked to another PitterPatter account.',
      );
    }

    transaction.set(
      reference,
      {
        ...record,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
};

const entitlementPayload = (
  accessLevel: 'free' | 'premium' | 'legacy',
  source: 'default' | 'google_play_subscription' | 'legacy_account',
  details?: {
    status?: string;
    productId?: string | null;
    basePlanId?: string | null;
    expiresAt?: admin.firestore.Timestamp | null;
  },
) => ({
  accessLevel,
  adFree: accessLevel !== 'free',
  source,
  status: details?.status || 'active',
  productId: details?.productId || null,
  basePlanId: details?.basePlanId || null,
  expiresAt: details?.expiresAt || null,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const entitlementSummary = (
  entitlement:
    | admin.firestore.DocumentData
    | Record<string, unknown>
    | undefined,
) => ({
  accessLevel:
    entitlement?.accessLevel === 'premium' ||
    entitlement?.accessLevel === 'legacy'
      ? entitlement.accessLevel
      : 'free',
  adFree: entitlement?.adFree === true,
});

const recomputeEntitlement = async (uid: string) => {
  const entitlementReference = db().collection('entitlements').doc(uid);
  const currentEntitlement = await entitlementReference.get();
  if (currentEntitlement.data()?.accessLevel === 'legacy') {
    return currentEntitlement.data();
  }

  const purchases = await db()
    .collection('playPurchases')
    .where('uid', '==', uid)
    .where('entitled', '==', true)
    .get();

  const active = purchases.docs
    .map(document => document.data() as PurchaseRecord)
    .filter(
      purchase =>
        purchase.expiresAt && purchase.expiresAt.toMillis() > Date.now(),
    )
    .sort(
      (left, right) =>
        (right.expiresAt?.toMillis() || 0) -
        (left.expiresAt?.toMillis() || 0),
    )[0];

  const payload = active
    ? entitlementPayload('premium', 'google_play_subscription', {
        status: active.subscriptionState,
        productId: active.productId,
        basePlanId: active.basePlanId,
        expiresAt: active.expiresAt,
      })
    : entitlementPayload('free', 'default');

  await entitlementReference.set(payload);
  return payload;
};

const requireAuthenticatedUid = (auth: { uid: string } | undefined) => {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to continue.');
  }
  return auth.uid;
};

export const syncCurrentUser = onCall(
  { region: REGION },
  async request => {
    const uid = requireAuthenticatedUid(request.auth);
    const reference = db().collection('entitlements').doc(uid);
    const existing = await reference.get();
    if (existing.data()?.accessLevel === 'legacy') {
      return { entitlement: entitlementSummary(existing.data()) };
    }

    const email =
      typeof request.auth?.token.email === 'string'
        ? request.auth.token.email.toLowerCase()
        : '';
    if (await qualifiesForLegacyAccess(uid, email)) {
      const payload = {
        ...entitlementPayload('legacy', 'legacy_account'),
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await reference.set(payload);
      return { entitlement: entitlementSummary(payload) };
    }

    const entitlement = await recomputeEntitlement(uid);
    return { entitlement: entitlementSummary(entitlement) };
  },
);

export const verifyPlaySubscription = onCall(
  { region: REGION },
  async request => {
    const uid = requireAuthenticatedUid(request.auth);
    const productId =
      typeof request.data?.productId === 'string'
        ? request.data.productId
        : '';
    const purchaseToken =
      typeof request.data?.purchaseToken === 'string'
        ? request.data.purchaseToken
        : '';

    if (
      !productId ||
      !allowedProductIds().includes(productId) ||
      purchaseToken.length < 20 ||
      purchaseToken.length > 4096
    ) {
      throw new HttpsError(
        'invalid-argument',
      'A valid PitterPatter Premium purchase is required.',
      );
    }

    const subscription = await getGoogleSubscription(purchaseToken);
    const verifiedProductIds = (subscription.lineItems || [])
      .map(item => item.productId)
      .filter(Boolean);
    if (!verifiedProductIds.includes(productId)) {
      throw new HttpsError(
        'permission-denied',
        'The Google Play purchase does not match this Premium product.',
      );
    }

    const obfuscatedAccountId =
      subscription.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (obfuscatedAccountId && obfuscatedAccountId !== accountHash(uid)) {
      throw new HttpsError(
        'permission-denied',
      'This purchase belongs to a different PitterPatter account.',
      );
    }

    const purchase = normalisePurchase(uid, purchaseToken, subscription);
    await savePurchaseRecord(purchase);

    if (
      purchase.entitled &&
      subscription.acknowledgementState ===
        'ACKNOWLEDGEMENT_STATE_PENDING'
    ) {
      await acknowledgeGoogleSubscription(purchase.productId, purchaseToken);
    }

    const entitlement = await recomputeEntitlement(uid);
    return { entitlement: entitlementSummary(entitlement) };
  },
);

const refreshKnownPurchase = async (purchaseToken: string) => {
  const reference = db().collection('playPurchases').doc(
    tokenHash(purchaseToken),
  );
  const existing = await reference.get();
  const uid = existing.data()?.uid;
  if (!existing.exists || typeof uid !== 'string') {
    logger.warn('Ignoring RTDN for an unlinked purchase token.');
    return;
  }

  const subscription = await getGoogleSubscription(purchaseToken);
  const purchase = normalisePurchase(uid, purchaseToken, subscription);
  await savePurchaseRecord(purchase);
  await recomputeEntitlement(uid);
};

export const handlePlayBillingNotification = onMessagePublished(
  {
    topic: 'play-billing-notifications',
    region: REGION,
    retry: true,
  },
  async event => {
    const messageId = event.data.message.messageId;
    const eventReference = db().collection('playRtdnEvents').doc(messageId);
    const claimed = await db().runTransaction(async transaction => {
      const existing = await transaction.get(eventReference);
      if (existing.exists) return false;
      transaction.create(eventReference, {
        status: 'processing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ),
      });
      return true;
    });
    if (!claimed) return;

    try {
      const payload = event.data.message.json as RtdnPayload;
      if (payload.testNotification) {
        await eventReference.update({
          status: 'test_received',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }
      if (
        payload.packageName !== packageNameParameter.value() ||
        !payload.subscriptionNotification?.purchaseToken
      ) {
        await eventReference.update({
          status: 'ignored',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      await refreshKnownPurchase(
        payload.subscriptionNotification.purchaseToken,
      );
      await eventReference.update({
        status: 'processed',
        notificationType:
          payload.subscriptionNotification.notificationType || null,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      await eventReference.delete();
      logger.error('Play Billing RTDN processing failed.', error);
      throw error;
    }
  },
);

export const cleanupDeletedUserMonetization = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete(async user => {
    const purchases = await db()
      .collection('playPurchases')
      .where('uid', '==', user.uid)
      .get();
    const references = [
      ...purchases.docs.map(document => document.ref),
      db().collection('entitlements').doc(user.uid),
    ];

    for (let offset = 0; offset < references.length; offset += 400) {
      const batch = db().batch();
      references
        .slice(offset, offset + 400)
        .forEach(reference => batch.delete(reference));
      await batch.commit();
    }
  });
