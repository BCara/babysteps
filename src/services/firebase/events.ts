import firestore from '@react-native-firebase/firestore';

export interface BabyEvent {
  id?: string;
  type: 'feed' | 'sleep' | 'diaper' | 'medication' | 'tummytime' | 'bath' | 'pumping';
  startTime: Date;
  endTime: Date | null;
  duration?: number;
  source: 'app' | 'alexa' | 'gemini' | 'widget';
  loggedBy: string;
  notes?: string;
  metadata?: any;
}

export const logEvent = async (babyId: string, event: Omit<BabyEvent, 'id'>) => {
  return firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .add({
      ...event,
      startTime: firestore.Timestamp.fromDate(event.startTime),
      endTime: event.endTime ? firestore.Timestamp.fromDate(event.endTime) : null,
    });
};

export const updateEvent = async (babyId: string, eventId: string, updates: Partial<BabyEvent>) => {
  const dataToUpdate: any = { ...updates };
  if (updates.startTime) dataToUpdate.startTime = firestore.Timestamp.fromDate(updates.startTime);
  if (updates.endTime) dataToUpdate.endTime = firestore.Timestamp.fromDate(updates.endTime);

  return firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(eventId)
    .update(dataToUpdate);
};

export const subscribeToRecentEvents = (babyId: string, limit: number, callback: (events: BabyEvent[]) => void) => {
  return firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .orderBy('startTime', 'desc')
    .limit(limit)
    .onSnapshot(snapshot => {
      const events = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime.toDate(),
          endTime: data.endTime ? data.endTime.toDate() : null,
        } as BabyEvent;
      });
      callback(events);
    });
};
