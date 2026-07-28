import firestore from '@react-native-firebase/firestore';

export interface Baby {
  id?: string;
  name: string;
  dateOfBirth: Date;
  gender?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createBaby = async (userId: string, babyData: Omit<Baby, 'id'>) => {
  const babyRef = firestore().collection('babies').doc();
  const batch = firestore().batch();

  batch.set(babyRef, {
    info: {
      ...babyData,
      dateOfBirth: firestore.Timestamp.fromDate(babyData.dateOfBirth),
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    },
    authorizedCaregivers: [userId],
  });

  batch.set(
    firestore().collection('users').doc(userId),
    {
      babyIds: firestore.FieldValue.arrayUnion(babyRef.id),
      activeBabyId: babyRef.id,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  return babyRef.id;
};

export const updateBaby = (
  babyId: string,
  updates: Partial<Pick<Baby, 'name' | 'dateOfBirth' | 'gender' | 'isActive'>>,
) => {
  const infoUpdates: Record<string, unknown> = {
    'info.updatedAt': firestore.FieldValue.serverTimestamp(),
  };

  if (updates.name !== undefined) infoUpdates['info.name'] = updates.name.trim();
  if (updates.gender !== undefined) infoUpdates['info.gender'] = updates.gender;
  if (updates.isActive !== undefined) infoUpdates['info.isActive'] = updates.isActive;
  if (updates.dateOfBirth !== undefined) {
    infoUpdates['info.dateOfBirth'] = firestore.Timestamp.fromDate(updates.dateOfBirth);
  }

  return firestore().collection('babies').doc(babyId).update(infoUpdates);
};

export const subscribeToBabies = (
  userId: string,
  callback: (babies: Baby[]) => void,
  onError?: (error: Error) => void,
) =>
  firestore()
    .collection('babies')
    .where('authorizedCaregivers', 'array-contains', userId)
    .onSnapshot(
      snapshot => {
        const babies = snapshot.docs
          .map(document => {
            const data = document.data().info;
            return {
              id: document.id,
              ...data,
              dateOfBirth: data.dateOfBirth.toDate(),
              createdAt: data.createdAt?.toDate?.(),
              updatedAt: data.updatedAt?.toDate?.(),
            } as Baby;
          })
          .filter(baby => baby.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name));
        callback(babies);
      },
      error => onError?.(error),
    );
