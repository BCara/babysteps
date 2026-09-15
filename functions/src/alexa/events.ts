import * as admin from 'firebase-admin';
import { AlexaUserError, LinkedBabyContext } from './account';

type EventType = 'feed' | 'sleep' | 'diaper';

interface EventMetadata {
  feedType?: 'breast' | 'bottle';
  breastSide?: 'left' | 'right' | 'both';
  diaperCondition?: 'wet' | 'dirty' | 'both';
  sleepType?: 'nap' | 'contactNap' | 'night';
}

const eventCollection = (babyId: string) =>
  admin.firestore().collection('babies').doc(babyId).collection('events');

const eventData = (
  context: LinkedBabyContext,
  type: EventType,
  startTime: admin.firestore.Timestamp,
  endTime: admin.firestore.Timestamp | null,
  metadata?: EventMetadata,
  durationMinutes?: number,
) => {
  const now = admin.firestore.Timestamp.now();
  const cleanMetadata = metadata
    ? Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined),
    )
    : undefined;
  return {
    type,
    startTime,
    endTime,
    ...(durationMinutes ? { durationMinutes } : {}),
    source: 'alexa',
    loggedBy: context.userId,
    ...(cleanMetadata && Object.keys(cleanMetadata).length
      ? { metadata: cleanMetadata }
      : {}),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
};

const getActiveEvents = async (babyId: string) => {
  const snapshot = await eventCollection(babyId)
    .orderBy('startTime', 'desc')
    .limit(50)
    .get();

  return snapshot.docs.filter(document => {
    const data = document.data();
    return (
      (data.type === 'feed' || data.type === 'sleep')
      && !data.endTime
      && !data.deletedAt
    );
  });
};

export const startTimedEvent = async (
  context: LinkedBabyContext,
  type: 'feed' | 'sleep',
  metadata?: EventMetadata,
) => {
  const activeEvents = await getActiveEvents(context.babyId);
  if (activeEvents.length) {
    const activeType = activeEvents[0].data().type === 'feed' ? 'feed' : 'sleep';
    throw new AlexaUserError(
      `A ${activeType} timer is already running. Stop it before starting ${type}.`,
    );
  }

  await eventCollection(context.babyId).add(
    eventData(
      context,
      type,
      admin.firestore.Timestamp.now(),
      null,
      metadata,
    ),
  );
};

export const stopTimedEvent = async (
  context: LinkedBabyContext,
  type: 'feed' | 'sleep',
) => {
  const activeEvents = await getActiveEvents(context.babyId);
  const active = activeEvents.find(document => document.data().type === type);

  if (!active) {
    throw new AlexaUserError(`There is no ${type} timer running.`);
  }

  const endTime = admin.firestore.Timestamp.now();
  const startTime = active.data().startTime as admin.firestore.Timestamp;
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.toMillis() - startTime.toMillis()) / 60_000),
  );

  await active.ref.update({
    endTime,
    durationMinutes,
    updatedAt: endTime,
  });

  return durationMinutes;
};

export const logCompletedEvent = (
  context: LinkedBabyContext,
  type: 'feed' | 'sleep',
  durationMinutes: number,
  metadata?: EventMetadata,
) => {
  const endTime = admin.firestore.Timestamp.now();
  const startTime = admin.firestore.Timestamp.fromMillis(
    endTime.toMillis() - durationMinutes * 60_000,
  );
  return eventCollection(context.babyId).add(
    eventData(
      context,
      type,
      startTime,
      endTime,
      metadata,
      durationMinutes,
    ),
  );
};

export const logDiaper = (
  context: LinkedBabyContext,
  condition: 'wet' | 'dirty' | 'both',
) => {
  const now = admin.firestore.Timestamp.now();
  return eventCollection(context.babyId).add(
    eventData(
      context,
      'diaper',
      now,
      now,
      { diaperCondition: condition },
    ),
  );
};
