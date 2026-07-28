import firestore from '@react-native-firebase/firestore';

export interface UserProfile {
  displayName: string;
  email: string;
  babyIds: string[];
  activeBabyId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ensureUserProfile = async (
  userId: string,
  email: string,
  displayName = '',
) => {
  const ref = firestore().collection('users').doc(userId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    await ref.set({
      displayName: displayName.trim(),
      email,
      babyIds: [],
      activeBabyId: null,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } else if (displayName.trim() && !snapshot.data()?.displayName) {
    await ref.update({
      displayName: displayName.trim(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  }
};

export const subscribeToUserProfile = (
  userId: string,
  callback: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
) =>
  firestore()
    .collection('users')
    .doc(userId)
    .onSnapshot(
      snapshot => {
        if (!snapshot.exists) {
          callback(null);
          return;
        }

        const data = snapshot.data()!;
        callback({
          displayName: data.displayName || '',
          email: data.email || '',
          babyIds: data.babyIds || [],
          activeBabyId: data.activeBabyId || null,
          createdAt: data.createdAt?.toDate?.(),
          updatedAt: data.updatedAt?.toDate?.(),
        });
      },
      error => onError?.(error),
    );

export const updateProfile = (
  userId: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'activeBabyId'>>,
) =>
  firestore()
    .collection('users')
    .doc(userId)
    .update({
      ...updates,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

const commitDeletes = async (
  documents: Array<FirebaseFirestoreTypes.DocumentReference>,
) => {
  for (let offset = 0; offset < documents.length; offset += 400) {
    const batch = firestore().batch();
    documents.slice(offset, offset + 400).forEach(document => batch.delete(document));
    await batch.commit();
  }
};

import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export const deleteUserData = async (userId: string) => {
  const babiesSnapshot = await firestore()
    .collection('babies')
    .where('authorizedCaregivers', 'array-contains', userId)
    .get();

  for (const babyDocument of babiesSnapshot.docs) {
    const caregivers = babyDocument.data().authorizedCaregivers || [];

    if (caregivers.length === 1 && caregivers[0] === userId) {
      const events = await babyDocument.ref.collection('events').get();
      await commitDeletes(events.docs.map(event => event.ref));
      await babyDocument.ref.delete();
    } else {
      await babyDocument.ref.update({
        authorizedCaregivers: firestore.FieldValue.arrayRemove(userId),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  await firestore().collection('users').doc(userId).delete();
};
