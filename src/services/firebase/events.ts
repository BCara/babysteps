import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { withoutUndefined } from '../../utils/withoutUndefined';

export interface BabyEvent {
  id?: string;
  type: 'feed' | 'sleep' | 'diaper';
  startTime: Date;
  endTime: Date | null;
  durationMinutes?: number;
  source: 'app';
  loggedBy: string;
  notes?: string;
  metadata?: {
    feedType?: 'breast' | 'bottle';
    amount?: number;
    unit?: 'ml' | 'oz';
    diaperCondition?: 'wet' | 'dirty' | 'both';
  };
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

type NewEvent = Omit<BabyEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export const logEvent = (babyId: string, event: NewEvent) =>
  firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .add(
      withoutUndefined({
        ...event,
        startTime: firestore.Timestamp.fromDate(event.startTime),
        endTime: event.endTime
          ? firestore.Timestamp.fromDate(event.endTime)
          : null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        deletedAt: null,
      }) as FirebaseFirestoreTypes.DocumentData,
    );

export const updateEvent = (
  babyId: string,
  eventId: string,
  updates: Partial<Pick<BabyEvent, 'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'>>,
) => {
  const dataToUpdate: Record<string, unknown> = {
    ...updates,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };
  if (updates.startTime) dataToUpdate.startTime = firestore.Timestamp.fromDate(updates.startTime);
  if (updates.endTime !== undefined) {
    dataToUpdate.endTime = updates.endTime
      ? firestore.Timestamp.fromDate(updates.endTime)
      : null;
  }

  return firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(eventId)
    .update(
      withoutUndefined(dataToUpdate) as FirebaseFirestoreTypes.DocumentData,
    );
};

export const softDeleteEvent = (babyId: string, eventId: string) =>
  firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(eventId)
    .update({
      deletedAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

export const subscribeToRecentEvents = (
  babyId: string,
  maxCount: number,
  callback: (events: BabyEvent[]) => void,
  onError?: (error: Error) => void,
) =>
  firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .orderBy('startTime', 'desc')
    .limit(maxCount)
    .onSnapshot(
      snapshot => {
        const events = snapshot.docs
          .map(document => {
            const data = document.data();
            return {
              id: document.id,
              ...data,
              startTime: data.startTime.toDate(),
              endTime: data.endTime ? data.endTime.toDate() : null,
              createdAt: data.createdAt?.toDate?.(),
              updatedAt: data.updatedAt?.toDate?.(),
              deletedAt: data.deletedAt?.toDate?.() || null,
            } as BabyEvent;
          })
          .filter(event => !event.deletedAt);
        callback(events);
      },
      error => onError?.(error),
    );

export const startSleep = (babyId: string, userId: string) =>
  logEvent(babyId, {
    type: 'sleep',
    startTime: new Date(),
    endTime: null,
    source: 'app',
    loggedBy: userId,
  });

export const stopSleep = (
  babyId: string,
  event: BabyEvent,
) => {
  if (!event.id) throw new Error('Sleep event is missing its ID.');
  const endTime = new Date();
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.getTime() - event.startTime.getTime()) / 60000),
  );
  return updateEvent(babyId, event.id, { endTime, durationMinutes });
};
