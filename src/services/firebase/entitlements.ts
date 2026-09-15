import firestore from '@react-native-firebase/firestore';

export type AccessLevel = 'free' | 'premium' | 'legacy';
export type EntitlementSource =
  | 'default'
  | 'google_play_subscription'
  | 'legacy_account';

export interface Entitlement {
  accessLevel: AccessLevel;
  adFree: boolean;
  source: EntitlementSource;
  status: string;
  productId: string | null;
  basePlanId: string | null;
  expiresAt: Date | null;
  updatedAt: Date | null;
}

export const FREE_ENTITLEMENT: Entitlement = {
  accessLevel: 'free',
  adFree: false,
  source: 'default',
  status: 'active',
  productId: null,
  basePlanId: null,
  expiresAt: null,
  updatedAt: null,
};

export const subscribeToEntitlement = (
  userId: string,
  callback: (entitlement: Entitlement) => void,
  onError?: (error: Error) => void,
) =>
  firestore()
    .collection('entitlements')
    .doc(userId)
    .onSnapshot(
      snapshot => {
        const data = snapshot.data();
        if (!snapshot.exists() || !data) {
          callback(FREE_ENTITLEMENT);
          return;
        }

        callback({
          accessLevel:
            data.accessLevel === 'legacy' || data.accessLevel === 'premium'
              ? data.accessLevel
              : 'free',
          adFree: data.adFree === true,
          source:
            data.source === 'legacy_account' ||
            data.source === 'google_play_subscription'
              ? data.source
              : 'default',
          status: typeof data.status === 'string' ? data.status : 'unknown',
          productId:
            typeof data.productId === 'string' ? data.productId : null,
          basePlanId:
            typeof data.basePlanId === 'string' ? data.basePlanId : null,
          expiresAt: data.expiresAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
        });
      },
      error => onError?.(error),
    );
