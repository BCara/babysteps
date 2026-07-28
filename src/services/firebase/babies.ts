import firestore from '@react-native-firebase/firestore';

export interface Baby {
  id?: string;
  name: string;
  dateOfBirth: Date;
  gender: string;
  photoURL?: string;
  isActive: boolean;
}

export const createBaby = async (userId: string, babyData: Omit<Baby, 'id'>) => {
  const babyRef = await firestore().collection('babies').add({
    info: {
      ...babyData,
      dateOfBirth: firestore.Timestamp.fromDate(babyData.dateOfBirth),
      createdAt: firestore.FieldValue.serverTimestamp(),
    },
    authorizedCaregivers: [userId]
  });

  // Update user profile with baby reference
  await firestore().collection('users').doc(userId).set({
    babyIds: firestore.FieldValue.arrayUnion(babyRef.id)
  }, { merge: true });

  return babyRef.id;
};

export const subscribeToBabies = (userId: string, callback: (babies: Baby[]) => void) => {
  return firestore()
    .collection('babies')
    .where('authorizedCaregivers', 'array-contains', userId)
    .onSnapshot(snapshot => {
      const babies = snapshot.docs.map(doc => {
        const data = doc.data().info;
        return {
          id: doc.id,
          ...data,
          dateOfBirth: data.dateOfBirth.toDate()
        } as Baby;
      });
      callback(babies);
    });
};
