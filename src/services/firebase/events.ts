import firestore from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { withoutUndefined } from '../../utils/withoutUndefined';
import {
  finishBreastTiming,
  startBreastTiming,
  switchBreastSide,
} from '../../utils/breastFeed';
import { cappedTimerEnd, timerDeadline } from '../../utils/timerLimits';
import type { SleepType } from '../../utils/sleepLocation';

export type BabyEventType =
  | 'feed'
  | 'sleep'
  | 'diaper'
  | 'pumping'
  | 'solids'
  | 'growth'
  | 'potty'
  | 'temperature'
  | 'medication'
  | 'tummyTime'
  | 'bath'
  | 'milestone'
  | 'symptom'
  | 'appointment'
  | 'immunization'
  | 'teething';

export type DiaperAmount = 'light' | 'medium' | 'heavy';

export interface BabyEventMetadata {
  feedType?: 'breast' | 'bottle';
  breastSide?: 'left' | 'right' | 'both';
  breastSidesUsed?: Array<'left' | 'right'>;
  lastBreastSide?: 'left' | 'right';
  breastSideStartedAtMs?: number;
  leftBreastDurationSeconds?: number;
  rightBreastDurationSeconds?: number;
  amount?: number;
  unit?: 'ml' | 'oz';
  sleepType?: SleepType;
  diaperCondition?: 'wet' | 'dirty' | 'both';
  diaperAmount?: DiaperAmount;
  wetDiaperAmount?: DiaperAmount;
  dirtyDiaperAmount?: DiaperAmount;
  pumpingSide?: 'left' | 'right' | 'both';
  storageLocation?: 'usedNow' | 'fridge' | 'freezer' | 'discarded';
  food?: string;
  foodAmount?: string;
  texture?: 'puree' | 'mashed' | 'fingerFood' | 'mixed';
  firstExposure?: boolean;
  allergen?: boolean;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  measuredBy?: string;
  pottyType?: 'wee' | 'poo' | 'both';
  pottyOutcome?: 'success' | 'attempt' | 'accident';
  temperature?: number;
  temperatureUnit?: 'C' | 'F';
  temperatureMethod?: 'armpit' | 'ear' | 'forehead' | 'oral' | 'rectal' | 'other';
  medicineName?: string;
  doseAmount?: number;
  doseUnit?: string;
  administeredBy?: string;
  milestone?: string;
  observation?: string;
  appointmentType?: string;
  provider?: string;
  appointmentLocation?: string;
  appointmentAddress?: string;
  appointmentPhone?: string;
  appointmentReference?: string;
  immunization?: string;
  immunizationLocation?: string;
  tooth?: string;
}

export interface BabyEvent {
  id?: string;
  type: BabyEventType;
  startTime: Date;
  endTime: Date | null;
  durationMinutes?: number;
  source: 'app' | 'alexa' | 'watch' | 'assistant';
  loggedBy: string;
  notes?: string;
  metadata?: BabyEventMetadata;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

type NewEvent = Omit<BabyEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export const logEvent = async (
  babyId: string,
  event: NewEvent,
  sleepToStop?: BabyEvent | null,
) => {
  const collection = firestore().collection('babies').doc(babyId).collection('events');
  const data = withoutUndefined({
    ...event,
    startTime: firestore.Timestamp.fromDate(event.startTime),
    endTime: event.endTime ? firestore.Timestamp.fromDate(event.endTime) : null,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
    deletedAt: null,
  }) as FirebaseFirestoreTypes.DocumentData;
  if (event.type !== 'feed' || !sleepToStop?.id) {
    const reference = await collection.add(data);
    return reference.id;
  }

  // Save the sleep and feed together: a failed feed must not stop sleep.
  // Read the current record so another caregiver's stop is never overwritten.
  const reference = collection.doc();
  const sleepReference = collection.doc(sleepToStop.id);
  await firestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(sleepReference);
    const sleep = snapshot.data();
    if (sleep && sleep.type === 'sleep' && !sleep.endTime && !sleep.deletedAt) {
      const startTime = sleep.startTime.toDate() as Date;
      if (event.startTime < startTime) {
        throw new Error('The feed starts before this sleep began. Adjust the feed start time or save it as a manual entry.');
      }
      const endTime = cappedTimerEnd({ ...sleepToStop, startTime }, event.startTime);
      transaction.update(sleepReference, {
        endTime: firestore.Timestamp.fromDate(endTime),
        durationMinutes: Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60_000)),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }
    transaction.set(reference, data);
  });
  return reference.id;
};

type EventUpdates = Partial<
  Pick<BabyEvent, 'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'>
>;

const timestampedUpdates = (updates: EventUpdates) => {
  const dataToUpdate: Record<string, unknown> = {
    ...updates,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };
  if (updates.startTime) {
    dataToUpdate.startTime = firestore.Timestamp.fromDate(updates.startTime);
  }
  if (updates.endTime !== undefined) {
    dataToUpdate.endTime = updates.endTime
      ? firestore.Timestamp.fromDate(updates.endTime)
      : null;
  }
  return withoutUndefined(dataToUpdate) as FirebaseFirestoreTypes.DocumentData;
};

export const updateEvent = (
  babyId: string,
  eventId: string,
  updates: EventUpdates,
) =>
  firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(eventId)
    .update(timestampedUpdates(updates));

/**
 * Writes the combined activity and removes the ones folded into it in a single
 * batch, so the timeline never shows a half-merged pair.
 */
export const mergeEventGroup = (
  babyId: string,
  targetId: string,
  updates: EventUpdates,
  removedIds: string[],
) => {
  const eventsCollection = firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events');
  const batch = firestore().batch();

  batch.update(eventsCollection.doc(targetId), timestampedUpdates(updates));
  removedIds.forEach(eventId => {
    batch.update(eventsCollection.doc(eventId), {
      deletedAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  });

  return batch.commit();
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

export const reopenTimedEvent = (
  babyId: string,
  eventId: string,
  metadata?: BabyEventMetadata,
) =>
  firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(eventId)
    .update({
      endTime: null,
      durationMinutes: firestore.FieldValue.delete(),
      ...(metadata ? { metadata: withoutUndefined(metadata) } : {}),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

// Low-volume records that a caregiver expects to keep referring back to long
// after they were logged. Feeds, sleeps and nappies can push hundreds of rows
// into a single week, so these are subscribed separately to stop routine
// logging from evicting a growth measurement or an upcoming appointment.
export const REFERENCE_EVENT_TYPES: BabyEventType[] = [
  'growth',
  'appointment',
  'immunization',
  'milestone',
  'medication',
  'temperature',
  'symptom',
  'teething',
];

const liveEvents = (
  query: FirebaseFirestoreTypes.Query,
  callback: (events: BabyEvent[]) => void,
  onError?: (error: Error) => void,
) =>
  query.onSnapshot(
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

export const subscribeToRecentEvents = (
  babyId: string,
  maxCount: number,
  callback: (events: BabyEvent[]) => void,
  onError?: (error: Error) => void,
) =>
  liveEvents(
    firestore()
      .collection('babies')
      .doc(babyId)
      .collection('events')
      .orderBy('startTime', 'desc')
      .limit(maxCount),
    callback,
    onError,
  );

export const subscribeToReferenceEvents = (
  babyId: string,
  maxCount: number,
  callback: (events: BabyEvent[]) => void,
  onError?: (error: Error) => void,
) =>
  liveEvents(
    firestore()
      .collection('babies')
      .doc(babyId)
      .collection('events')
      .where('type', 'in', REFERENCE_EVENT_TYPES)
      .orderBy('startTime', 'desc')
      .limit(maxCount),
    callback,
    onError,
  );

export const startSleep = (
  babyId: string,
  userId: string,
  sleepType?: SleepType,
  /** Set when the caregiver corrected the time the baby actually went down. */
  startTime = new Date(),
) =>
  logEvent(babyId, {
    type: 'sleep',
    startTime,
    endTime: null,
    source: 'app',
    loggedBy: userId,
    metadata: { sleepType },
  });

const stopTimedEvent = (
  babyId: string,
  event: BabyEvent,
  requestedEnd = new Date(),
) => {
  if (!event.id) throw new Error('Timed event is missing its ID.');
  const endTime = cappedTimerEnd(event, requestedEnd);
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.getTime() - event.startTime.getTime()) / 60000),
  );
  return updateEvent(babyId, event.id, { endTime, durationMinutes });
};

export const stopSleep = (babyId: string, event: BabyEvent) =>
  stopTimedEvent(babyId, event);

export const startFeed = (
  babyId: string,
  userId: string,
  input: {
    feedType: 'breast' | 'bottle';
    breastSide?: 'left' | 'right' | 'both';
    amount?: number;
    unit?: 'ml' | 'oz';
    notes?: string;
    startTime?: Date;
  },
  sleepToStop?: BabyEvent | null,
) => {
  const startTime = input.startTime || new Date();
  const sideTiming =
    input.feedType === 'breast' &&
    (input.breastSide === 'left' || input.breastSide === 'right')
      ? startBreastTiming(input.breastSide, startTime.getTime())
      : {};

  return logEvent(babyId, {
    type: 'feed',
    startTime,
    endTime: null,
    source: 'app',
    loggedBy: userId,
    notes: input.notes,
    metadata: {
      ...sideTiming,
      feedType: input.feedType,
      breastSide: input.breastSide,
      breastSidesUsed:
        input.feedType === 'breast' && input.breastSide === 'both'
          ? ['left', 'right']
          : input.feedType === 'breast' &&
              (input.breastSide === 'left' || input.breastSide === 'right')
            ? [input.breastSide]
            : undefined,
      lastBreastSide:
        input.feedType === 'breast' &&
        (input.breastSide === 'left' || input.breastSide === 'right')
          ? input.breastSide
          : undefined,
      amount: input.amount,
      unit: input.unit,
    },
  }, sleepToStop);
};

export const stopFeed = (babyId: string, event: BabyEvent) => {
  if (event.metadata?.feedType !== 'breast') {
    return stopTimedEvent(babyId, event);
  }
  if (!event.id) throw new Error('Timed event is missing its ID.');

  const endTime = cappedTimerEnd(event);
  const finishedMetadata = finishBreastTiming(
    event.metadata,
    endTime.getTime(),
  );
  const trackedSeconds =
    (finishedMetadata.leftBreastDurationSeconds || 0) +
    (finishedMetadata.rightBreastDurationSeconds || 0);
  const durationMinutes = Math.max(
    1,
    Math.round(
      trackedSeconds > 0
        ? trackedSeconds / 60
        : (endTime.getTime() - event.startTime.getTime()) / 60_000,
    ),
  );
  return updateEvent(babyId, event.id, {
    endTime,
    durationMinutes,
    metadata: finishedMetadata,
  });
};

export const stopTimedEventAtLimit = (babyId: string, event: BabyEvent) => {
  const deadline = timerDeadline(event);
  if (!deadline) return Promise.resolve();
  if (event.type === 'feed') {
    if (event.metadata?.feedType !== 'breast') {
      return stopTimedEvent(babyId, event, deadline);
    }
    if (!event.id) throw new Error('Timed event is missing its ID.');
    const finishedMetadata = finishBreastTiming(event.metadata, deadline.getTime());
    return updateEvent(babyId, event.id, {
      endTime: deadline,
      durationMinutes: Math.max(
        1,
        Math.round((deadline.getTime() - event.startTime.getTime()) / 60_000),
      ),
      metadata: finishedMetadata,
    });
  }
  return stopTimedEvent(babyId, event, deadline);
};

export const switchFeed = (
  babyId: string,
  event: BabyEvent,
  userId: string,
  input: {
    feedType: 'breast' | 'bottle';
    breastSide?: 'left' | 'right' | 'both';
  },
) => {
  if (!event.id) throw new Error('Feed event is missing its ID.');

  if (
    event.metadata?.feedType === 'breast' &&
    input.feedType === 'breast'
  ) {
    return updateEvent(babyId, event.id, {
      metadata: {
        ...event.metadata,
        feedType: 'breast',
        ...switchBreastSide(
          event.metadata,
          input.breastSide === 'right' ? 'right' : 'left',
          Date.now(),
        ),
      },
    });
  }

  const endTime = new Date();
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.getTime() - event.startTime.getTime()) / 60_000),
  );
  const eventsCollection = firestore()
    .collection('babies')
    .doc(babyId)
    .collection('events');
  const currentEvent = eventsCollection.doc(event.id);
  const nextEvent = eventsCollection.doc();
  const batch = firestore().batch();

  batch.update(currentEvent, {
    endTime: firestore.Timestamp.fromDate(endTime),
    durationMinutes,
    ...(event.metadata?.feedType === 'breast'
      ? { metadata: finishBreastTiming(event.metadata, endTime.getTime()) }
      : {}),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  batch.set(
    nextEvent,
    withoutUndefined({
      type: 'feed',
      startTime: firestore.Timestamp.fromDate(endTime),
      endTime: null,
      source: 'app',
      loggedBy: userId,
      metadata: {
        feedType: input.feedType,
        breastSide: input.breastSide,
      },
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      deletedAt: null,
    }) as FirebaseFirestoreTypes.DocumentData,
  );

  return batch.commit();
};
