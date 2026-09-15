import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const REGION = 'australia-southeast1';
const MAX_COMMAND_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const TIMER_LIMIT_MINUTES = {
  feed: 180,
  sleep: 1_080,
} as const;

type WatchAction =
  | 'nursing'
  | 'nursing_left'
  | 'nursing_right'
  | 'nursing_pause'
  | 'nursing_stop'
  | 'bottle'
  | 'sleep'
  | 'diaper'
  | 'diaper_wet'
  | 'diaper_dirty'
  | 'diaper_both';
type BreastSide = 'left' | 'right';

interface WatchCommandRequest {
  commandId?: unknown;
  action?: unknown;
  occurredAtMillis?: unknown;
}

interface EventMetadata {
  feedType?: 'breast' | 'bottle';
  breastSide?: 'left' | 'right' | 'both';
  breastSidesUsed?: BreastSide[];
  lastBreastSide?: BreastSide;
  breastSideStartedAtMs?: number;
  leftBreastDurationSeconds?: number;
  rightBreastDurationSeconds?: number;
  amount?: number;
  unit?: 'ml' | 'oz';
  sleepType?: 'nap' | 'contactNap' | 'night';
  diaperCondition?: 'wet' | 'dirty' | 'both';
}

interface ActiveEvent {
  id: string;
  type: 'feed' | 'sleep';
  startTime: admin.firestore.Timestamp;
  metadata: EventMetadata;
}

interface WatchResult {
  message: string;
  babyName: string;
  activeType: 'nursing' | 'bottle' | 'sleep' | null;
  activeSinceMillis: number | null;
  activeSide: BreastSide | null;
  activeSideStartedAtMillis: number | null;
  nursingLastAtMillis: number | null;
  nursingLeftSeconds: number;
  nursingRightSeconds: number;
}

const db = () => admin.firestore();

const cleanObject = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );

const requireCommand = (data: WatchCommandRequest) => {
  if (
    typeof data.commandId !== 'string'
    || !/^[A-Za-z0-9-]{12,80}$/.test(data.commandId)
  ) {
    throw new HttpsError('invalid-argument', 'Invalid watch command ID.');
  }
  const supportedActions: WatchAction[] = [
    'nursing',
    'nursing_left',
    'nursing_right',
    'nursing_pause',
    'nursing_stop',
    'bottle',
    'sleep',
    'diaper',
    'diaper_wet',
    'diaper_dirty',
    'diaper_both',
  ];
  if (!supportedActions.includes(data.action as WatchAction)) {
    throw new HttpsError('invalid-argument', 'Unknown watch care action.');
  }
  if (
    typeof data.occurredAtMillis !== 'number'
    || !Number.isFinite(data.occurredAtMillis)
  ) {
    throw new HttpsError('invalid-argument', 'Invalid watch action time.');
  }

  const now = Date.now();
  if (
    data.occurredAtMillis < now - MAX_COMMAND_AGE_MS
    || data.occurredAtMillis > now + MAX_FUTURE_SKEW_MS
  ) {
    throw new HttpsError(
      'invalid-argument',
      'The queued watch action is outside the supported time window.',
    );
  }

  return {
    commandId: data.commandId,
    action: data.action as WatchAction,
    occurredAtMillis: Math.min(data.occurredAtMillis, now),
  };
};

const finishBreastTiming = (metadata: EventMetadata, endMillis: number) => {
  const side = metadata.lastBreastSide
    || (metadata.breastSide === 'left' || metadata.breastSide === 'right'
      ? metadata.breastSide
      : undefined);
  const startedAt = metadata.breastSideStartedAtMs;
  const elapsed = side && startedAt
    ? Math.max(0, Math.floor((endMillis - startedAt) / 1000))
    : 0;

  return cleanObject({
    ...metadata,
    leftBreastDurationSeconds:
      (metadata.leftBreastDurationSeconds || 0)
      + (side === 'left' ? elapsed : 0),
    rightBreastDurationSeconds:
      (metadata.rightBreastDurationSeconds || 0)
      + (side === 'right' ? elapsed : 0),
    breastSideStartedAtMs: undefined,
  }) as EventMetadata;
};

const getActiveEvents = async (babyId: string) => {
  const snapshot = await db()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .orderBy('startTime', 'desc')
    .limit(50)
    .get();

  return snapshot.docs.flatMap(document => {
    const data = document.data();
    if (
      data.deletedAt
      || data.endTime
      || (data.type !== 'feed' && data.type !== 'sleep')
    ) {
      return [];
    }
    return [{
      id: document.id,
      type: data.type,
      startTime: data.startTime as admin.firestore.Timestamp,
      metadata: (data.metadata || {}) as EventMetadata,
    } satisfies ActiveEvent];
  });
};

const getLastEvent = async (
  babyId: string,
  predicate: (data: admin.firestore.DocumentData) => boolean,
) => {
  const snapshot = await db()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .orderBy('startTime', 'desc')
    .limit(50)
    .get();
  return snapshot.docs.find(document => {
    const data = document.data();
    return !data.deletedAt && predicate(data);
  })?.data();
};

const eventData = (
  uid: string,
  type: 'feed' | 'sleep' | 'diaper',
  startTime: admin.firestore.Timestamp,
  endTime: admin.firestore.Timestamp | null,
  metadata: EventMetadata,
  durationMinutes?: number,
) => {
  const now = admin.firestore.Timestamp.now();
  return cleanObject({
    type,
    startTime,
    endTime,
    durationMinutes,
    source: 'watch',
    loggedBy: uid,
    metadata: cleanObject(metadata as Record<string, unknown>),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
};

const stopEvent = async (
  babyId: string,
  event: ActiveEvent,
  occurredAtMillis: number,
) => {
  const startMillis = event.startTime.toMillis();
  const safeEndMillis = cappedEndMillis(
    event.type,
    startMillis,
    occurredAtMillis,
  );
  const endTime = admin.firestore.Timestamp.fromMillis(safeEndMillis);
  let metadata = event.metadata;
  let durationMinutes = Math.max(
    1,
    Math.round((safeEndMillis - startMillis) / 60_000),
  );

  if (event.type === 'feed' && event.metadata.feedType === 'breast') {
    metadata = finishBreastTiming(event.metadata, safeEndMillis);
    const trackedSeconds =
      (metadata.leftBreastDurationSeconds || 0)
      + (metadata.rightBreastDurationSeconds || 0);
    if (trackedSeconds > 0) {
      durationMinutes = Math.max(1, Math.round(trackedSeconds / 60));
    }
  }

  await db()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(event.id)
    .update({
      endTime,
      durationMinutes,
      metadata,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

const cappedEndMillis = (
  type: 'feed' | 'sleep',
  startMillis: number,
  requestedEndMillis: number,
) => Math.min(
  Math.max(startMillis, requestedEndMillis),
  startMillis + TIMER_LIMIT_MINUTES[type] * 60_000,
);

const startFeed = async (
  uid: string,
  babyId: string,
  occurredAtMillis: number,
  feedType: 'breast' | 'bottle',
  breastSide?: BreastSide,
) => {
  const startTime = admin.firestore.Timestamp.fromMillis(occurredAtMillis);
  const metadata: EventMetadata = feedType === 'breast' && breastSide
    ? {
      feedType,
      breastSide,
      breastSidesUsed: [breastSide],
      lastBreastSide: breastSide,
      breastSideStartedAtMs: occurredAtMillis,
      leftBreastDurationSeconds: 0,
      rightBreastDurationSeconds: 0,
    }
    : { feedType };
  await db().collection('babies').doc(babyId).collection('events').add(
    eventData(uid, 'feed', startTime, null, metadata),
  );
};

const switchFeed = async (
  uid: string,
  babyId: string,
  activeFeed: ActiveEvent,
  occurredAtMillis: number,
  feedType: 'breast' | 'bottle',
  breastSide?: BreastSide,
) => {
  await stopEvent(babyId, activeFeed, occurredAtMillis);
  await startFeed(uid, babyId, occurredAtMillis, feedType, breastSide);
};

const switchBreastSide = async (
  babyId: string,
  activeFeed: ActiveEvent,
  occurredAtMillis: number,
  nextSide: BreastSide,
) => {
  const completed = finishBreastTiming(activeFeed.metadata, occurredAtMillis);
  const sidesUsed = Array.from(new Set([
    ...(completed.breastSidesUsed || []),
    nextSide,
  ]));
  const metadata: EventMetadata = {
    ...completed,
    breastSide: sidesUsed.length > 1 ? 'both' : nextSide,
    breastSidesUsed: sidesUsed,
    lastBreastSide: nextSide,
    breastSideStartedAtMs: occurredAtMillis,
  };
  await db()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(activeFeed.id)
    .update({
      metadata,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  return metadata;
};

const pauseBreastSide = async (
  babyId: string,
  activeFeed: ActiveEvent,
  occurredAtMillis: number,
) => {
  const metadata = finishBreastTiming(activeFeed.metadata, occurredAtMillis);
  await db()
    .collection('babies')
    .doc(babyId)
    .collection('events')
    .doc(activeFeed.id)
    .update({
      metadata,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  return metadata;
};

const currentState = async (
  babyId: string,
  message: string,
  babyName: string,
): Promise<WatchResult> => {
  const active = (await getActiveEvents(babyId))[0];
  const activeNursing = active?.type === 'feed' && active.metadata.feedType !== 'bottle'
    ? active
    : undefined;
  const lastNursing = activeNursing ? undefined : await getLastEvent(
    babyId,
    data => data.type === 'feed' && data.metadata?.feedType !== 'bottle',
  );
  const nursingMetadata = activeNursing?.metadata
    || (lastNursing?.metadata as EventMetadata | undefined)
    || {};
  const nursingLastTimestamp = lastNursing?.endTime || lastNursing?.startTime;
  const nursingState = {
    activeSideStartedAtMillis: activeNursing?.metadata.breastSideStartedAtMs || null,
    nursingLastAtMillis: nursingLastTimestamp instanceof admin.firestore.Timestamp
      ? nursingLastTimestamp.toMillis()
      : null,
    nursingLeftSeconds: nursingMetadata.leftBreastDurationSeconds || 0,
    nursingRightSeconds: nursingMetadata.rightBreastDurationSeconds || 0,
  };
  if (!active) {
    return {
      message,
      babyName,
      activeType: null,
      activeSinceMillis: null,
      activeSide: null,
      ...nursingState,
    };
  }
  return {
    message,
    babyName,
    activeType: active.type === 'sleep'
      ? 'sleep'
      : active.metadata.feedType === 'bottle'
        ? 'bottle'
        : 'nursing',
    activeSinceMillis: active.startTime.toMillis(),
    activeSide: active.metadata.feedType === 'breast'
      && active.metadata.breastSideStartedAtMs
      ? active.metadata.lastBreastSide
        || (active.metadata.breastSide === 'left'
          || active.metadata.breastSide === 'right'
          ? active.metadata.breastSide
          : null)
      : null,
    ...nursingState,
  };
};

const executeAction = async (
  uid: string,
  babyId: string,
  babyName: string,
  preferences: admin.firestore.DocumentData,
  action: WatchAction,
  occurredAtMillis: number,
) => {
  const events = await getActiveEvents(babyId);
  const activeFeed = events.find(event => event.type === 'feed');
  const activeSleep = events.find(event => event.type === 'sleep');
  const eventCollection = db()
    .collection('babies')
    .doc(babyId)
    .collection('events');
  const occurredAt = admin.firestore.Timestamp.fromMillis(occurredAtMillis);

  if (
    action === 'nursing'
    || action === 'nursing_left'
    || action === 'nursing_right'
    || action === 'nursing_pause'
    || action === 'nursing_stop'
  ) {
    const preference = preferences.nursing || {};
    const lastNursing = await getLastEvent(
      babyId,
      data => data.type === 'feed' && data.metadata?.feedType !== 'bottle',
    );
    const lastSide = lastNursing?.metadata?.lastBreastSide
      || lastNursing?.metadata?.breastSide;
    const explicitSide: BreastSide | undefined = action === 'nursing_left'
      ? 'left'
      : action === 'nursing_right' ? 'right' : undefined;
    const side: BreastSide = explicitSide
      || (preference.mode === 'specific'
        && (preference.breastSide === 'left' || preference.breastSide === 'right')
        ? preference.breastSide
        : lastSide === 'right' ? 'right' : 'left');

    if (action === 'nursing_stop') {
      if (!activeFeed || activeFeed.metadata.feedType === 'bottle') {
        throw new HttpsError('failed-precondition', 'No nursing timer is running.');
      }
      await stopEvent(babyId, activeFeed, occurredAtMillis);
      return currentState(babyId, 'Nursing stopped', babyName);
    }

    if (action === 'nursing_pause') {
      if (!activeFeed || activeFeed.metadata.feedType === 'bottle') {
        throw new HttpsError('failed-precondition', 'No nursing timer is running.');
      }
      if (!activeFeed.metadata.breastSideStartedAtMs) {
        return currentState(babyId, 'Nursing is already paused', babyName);
      }
      await pauseBreastSide(babyId, activeFeed, occurredAtMillis);
      return currentState(babyId, 'Nursing paused', babyName);
    }

    if (activeFeed) {
      if (activeFeed.metadata.feedType === 'bottle') {
        await switchFeed(uid, babyId, activeFeed, occurredAtMillis, 'breast', side);
        return currentState(babyId, `Switched to ${side} nursing`, babyName);
      }
      if (explicitSide) {
        const currentSide = activeFeed.metadata.lastBreastSide
          || (activeFeed.metadata.breastSide === 'left'
            || activeFeed.metadata.breastSide === 'right'
            ? activeFeed.metadata.breastSide
            : undefined);
        if (currentSide === explicitSide && activeFeed.metadata.breastSideStartedAtMs) {
          return currentState(
            babyId,
            `${explicitSide.replace(/^./, value => value.toUpperCase())} nursing already active`,
            babyName,
          );
        }
        await switchBreastSide(babyId, activeFeed, occurredAtMillis, explicitSide);
        return currentState(babyId, `Switched to ${explicitSide} nursing`, babyName);
      }
      await stopEvent(babyId, activeFeed, occurredAtMillis);
      return currentState(babyId, 'Nursing stopped', babyName);
    }
    if (activeSleep) {
      throw new HttpsError(
        'failed-precondition',
        'Stop the sleep timer before starting nursing.',
      );
    }
    await startFeed(uid, babyId, occurredAtMillis, 'breast', side);
    return currentState(babyId, `Nursing started on the ${side}`, babyName);
  }

  if (action === 'bottle') {
    const preference = preferences.bottle || {};
    if (activeFeed) {
      if (activeFeed.metadata.feedType !== 'bottle') {
        await switchFeed(uid, babyId, activeFeed, occurredAtMillis, 'bottle');
        return currentState(babyId, 'Switched to a bottle feed', babyName);
      }
      await stopEvent(babyId, activeFeed, occurredAtMillis);
      return currentState(babyId, 'Bottle feed stopped', babyName);
    }
    if (activeSleep) {
      throw new HttpsError(
        'failed-precondition',
        'Stop the sleep timer before logging a bottle.',
      );
    }
    if (
      preference.mode === 'specific'
      && typeof preference.bottleAmount === 'number'
      && preference.bottleAmount > 0
    ) {
      const unit = preference.bottleUnit === 'oz' ? 'oz' : 'ml';
      await eventCollection.add(eventData(
        uid,
        'feed',
        occurredAt,
        occurredAt,
        {
          feedType: 'bottle',
          amount: preference.bottleAmount,
          unit,
        },
      ));
      return currentState(
        babyId,
        `${preference.bottleAmount} ${unit} bottle logged`,
        babyName,
      );
    }
    await startFeed(uid, babyId, occurredAtMillis, 'bottle');
    return currentState(babyId, 'Bottle timer started', babyName);
  }

  if (action === 'sleep') {
    if (activeSleep) {
      await stopEvent(babyId, activeSleep, occurredAtMillis);
      return currentState(babyId, 'Sleep stopped', babyName);
    }
    if (activeFeed) {
      throw new HttpsError(
        'failed-precondition',
        'Stop the feed timer before starting sleep.',
      );
    }
    const preference = preferences.sleep || {};
    const lastSleep = await getLastEvent(babyId, data => data.type === 'sleep');
    const preferredType = preference.mode === 'specific'
      ? preference.sleepType
      : lastSleep?.metadata?.sleepType;
    const sleepType = preferredType === 'contactNap' || preferredType === 'night'
      ? preferredType
      : 'nap';
    await eventCollection.add(
      eventData(uid, 'sleep', occurredAt, null, { sleepType }),
    );
    return currentState(babyId, 'Sleep timer started', babyName);
  }

  const preference = preferences.diaper || {};
  const lastDiaper = await getLastEvent(babyId, data => data.type === 'diaper');
  const explicitCondition = action === 'diaper_dirty'
    ? 'dirty'
    : action === 'diaper_both'
      ? 'both'
      : action === 'diaper_wet' ? 'wet' : undefined;
  const preferredCondition = explicitCondition || (preference.mode === 'specific'
    ? preference.diaperCondition
    : lastDiaper?.metadata?.diaperCondition);
  const condition = preferredCondition === 'dirty' || preferredCondition === 'both'
    ? preferredCondition
    : 'wet';
  await eventCollection.add(
    eventData(
      uid,
      'diaper',
      occurredAt,
      occurredAt,
      { diaperCondition: condition },
    ),
  );
  const label = condition === 'both'
    ? 'Wet and dirty'
    : condition === 'dirty' ? 'Dirty' : 'Wet';
  return currentState(babyId, `${label} nappy logged`, babyName);
};

export const executeCareCommand = onCall(
  { region: REGION, enforceAppCheck: false },
  async request => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'Open PitterPatter on your phone and sign in first.',
      );
    }
    const command = requireCommand(request.data as WatchCommandRequest);
    const uid = request.auth.uid;
    const commandRef = db()
      .collection('watchCareCommands')
      .doc(`${uid}_${command.commandId}`);

    const existing = await commandRef.get();
    if (existing.exists) {
      const priorResult = existing.data()?.result as WatchResult | undefined;
      if (priorResult) return priorResult;
      if (existing.data()?.status === 'failed') {
        // The watch retains the same command ID while offline. Let that exact
        // idempotent command try again once the phone/cloud path recovers.
        await commandRef.delete();
      } else {
        throw new HttpsError(
          'aborted',
          'That watch action is already being processed.',
        );
      }
    }

    try {
      await commandRef.create({
        uid,
        action: command.action,
        occurredAtMillis: command.occurredAtMillis,
        status: 'processing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const duplicate = await commandRef.get();
      const priorResult = duplicate.data()?.result as WatchResult | undefined;
      if (priorResult) return priorResult;
      logger.warn('Duplicate watch command is still processing', {
        uid,
        commandId: command.commandId,
      });
      throw new HttpsError(
        'aborted',
        'That watch action is already being processed.',
      );
    }

    try {
      const profile = await db().collection('users').doc(uid).get();
      const profileData = profile.data();
      const babyId = profileData?.activeBabyId;
      if (typeof babyId !== 'string' || !babyId) {
        throw new HttpsError(
          'failed-precondition',
          'Select a baby in PitterPatter on your phone first.',
        );
      }
      const baby = await db().collection('babies').doc(babyId).get();
      const babyData = baby.data();
      if (
        !baby.exists
        || !Array.isArray(babyData?.authorizedCaregivers)
        || !babyData.authorizedCaregivers.includes(uid)
      ) {
        throw new HttpsError(
          'permission-denied',
          'The selected baby is not available to this caregiver.',
        );
      }

      const result = await executeAction(
        uid,
        babyId,
        typeof babyData?.info?.name === 'string' ? babyData.info.name : 'Baby',
        profileData?.quickCarePreferences || {},
        command.action,
        command.occurredAtMillis,
      );
      await commandRef.update({
        status: 'complete',
        result,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return result;
    } catch (error) {
      const message = error instanceof HttpsError
        ? error.message
        : 'Unable to update care from the watch.';
      await commandRef.update({
        status: 'failed',
        error: message,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.error('Watch care command failed', {
        uid,
        commandId: command.commandId,
        action: command.action,
        error,
      });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', message);
    }
  },
);

export const watchCareTestables = {
  requireCommand,
  finishBreastTiming,
  switchBreastSide,
  pauseBreastSide,
  cappedEndMillis,
};
