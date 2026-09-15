import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BabyEvent,
  BabyEventMetadata,
  BabyEventType,
  DiaperAmount,
  logEvent,
  mergeEventGroup,
  reopenTimedEvent,
  softDeleteEvent,
  startFeed as createFeedEvent,
  startSleep as createSleepEvent,
  switchFeed as switchFeedEvent,
  stopFeed as finishFeedEvent,
  stopSleep as finishSleepEvent,
  stopTimedEventAtLimit,
  subscribeToRecentEvents,
  subscribeToReferenceEvents,
  updateEvent,
} from '../services/firebase/events';
import { isLimitedTimer, timerDeadline } from '../utils/timerLimits';
import { buildMergePlan } from '../utils/mergeEvents';
import { mergeEventStreams } from '../utils/mergeEventStreams';
import { careEventTimes } from '../utils/eventEditing';
import type { SleepType } from '../utils/sleepLocation';
import { buildQuickCareWidgetSnapshots } from '../utils/widgetSnapshots';
import { syncQuickCareWidgetSnapshots } from '../services/widgetSettings';
import { useAuth } from './AuthProvider';
import { useBabies } from './BabyProvider';

interface FeedInput {
  feedType: 'breast' | 'bottle';
  startTime?: Date;
  breastSide?: 'left' | 'right' | 'both';
  breastSidesUsed?: Array<'left' | 'right'>;
  lastBreastSide?: 'left' | 'right';
  leftBreastDurationSeconds?: number;
  rightBreastDurationSeconds?: number;
  amount?: number;
  unit?: 'ml' | 'oz';
  durationMinutes?: number;
  notes?: string;
}

type StartFeedInput = Omit<FeedInput, 'durationMinutes'>;

interface EventContextValue {
  events: BabyEvent[];
  todayEvents: BabyEvent[];
  activeFeed: BabyEvent | null;
  activeSleep: BabyEvent | null;
  activePumping: BabyEvent | null;
  loading: boolean;
  error: string | null;
  logFeed: (input: FeedInput) => Promise<string>;
  logSleep: (
    durationMinutes: number,
    notes?: string,
    sleepType?: SleepType,
    /** Manual entries supply their own times; voice and widget logs end now. */
    times?: { startTime?: Date; endTime?: Date },
  ) => Promise<string>;
  startFeed: (input: StartFeedInput) => Promise<string>;
  stopFeed: (eventOverride?: BabyEvent) => Promise<void>;
  cancelFeed: () => Promise<void>;
  switchFeed: (
    input: Omit<FeedInput, 'durationMinutes' | 'startTime'>,
  ) => Promise<void>;
  logDiaper: (
    condition: 'wet' | 'dirty' | 'both',
    notes?: string,
    startTime?: Date,
    diaperAmount?: DiaperAmount,
    wetDiaperAmount?: DiaperAmount,
    dirtyDiaperAmount?: DiaperAmount,
  ) => Promise<string>;
  logCareEvent: (input: {
    type: Exclude<BabyEventType, 'feed' | 'sleep' | 'diaper'>;
    startTime?: Date;
    durationMinutes?: number;
    notes?: string;
    metadata: BabyEventMetadata;
  }) => Promise<string>;
  startPumping: (side?: 'left' | 'right' | 'both') => Promise<string>;
  stopPumping: () => Promise<void>;
  cancelPumping: () => Promise<void>;
  startSleep: (sleepType?: SleepType, startTime?: Date) => Promise<string>;
  stopSleep: () => Promise<void>;
  cancelSleep: () => Promise<void>;
  editEvent: (
    eventId: string,
    updates: Partial<
      Pick<BabyEvent, 'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'>
    >,
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  deleteEvents: (eventIds: string[]) => Promise<void>;
  mergeEvents: (eventIds: string[]) => Promise<void>;
  reopenEvent: (
    eventId: string,
    metadata?: BabyEventMetadata,
  ) => Promise<void>;
}

const EventContext = createContext<EventContextValue | null>(null);

const RECENT_EVENT_LIMIT = 250;
const REFERENCE_EVENT_LIMIT = 500;

export function EventProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { selectedBaby, customSleepLocations } = useBabies();
  const [recentEvents, setRecentEvents] = useState<BabyEvent[]>([]);
  const [referenceEvents, setReferenceEvents] = useState<BabyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStoppingIds = useRef(new Set<string>());

  useEffect(() => {
    setRecentEvents([]);
    setReferenceEvents([]);
    setError(null);

    if (!selectedBaby?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const reportError = (nextError: Error) => {
      setError(nextError.message);
      setLoading(false);
    };

    // Recent activity is capped because feeds, sleeps and nappies are logged
    // dozens of times a day. Growth measurements, appointments and the other
    // reference records are subscribed separately so that routine logging can
    // never push them out of view.
    const unsubscribeRecent = subscribeToRecentEvents(
      selectedBaby.id,
      RECENT_EVENT_LIMIT,
      nextEvents => {
        setRecentEvents(nextEvents);
        setLoading(false);
      },
      reportError,
    );
    // Reference records are an enhancement on top of the recent window, so a
    // failure here (a Firestore index still building, for example) must leave
    // routine logging working rather than blocking the whole screen.
    const unsubscribeReference = subscribeToReferenceEvents(
      selectedBaby.id,
      REFERENCE_EVENT_LIMIT,
      setReferenceEvents,
      () => setReferenceEvents([]),
    );

    return () => {
      unsubscribeRecent();
      unsubscribeReference();
    };
  }, [selectedBaby?.id]);

  const events = useMemo(
    () => mergeEventStreams(recentEvents, referenceEvents),
    [recentEvents, referenceEvents],
  );

  const activeSleep =
    events.find(event => event.type === 'sleep' && !event.endTime) || null;
  const activeFeed =
    events.find(event => event.type === 'feed' && !event.endTime) || null;
  const activePumping =
    events.find(event => event.type === 'pumping' && !event.endTime) || null;

  useEffect(() => {
    void syncQuickCareWidgetSnapshots(
      selectedBaby?.id
        ? buildQuickCareWidgetSnapshots(events, new Date(), customSleepLocations)
        : [],
    ).catch(() => {
      // Widget syncing is best-effort and must never block care logging.
    });
  }, [customSleepLocations, events, selectedBaby?.id]);

  useEffect(() => {
    if (!selectedBaby?.id) return;
    const activeTimers = events.filter(
      event => event.id && !event.endTime && isLimitedTimer(event),
    );
    if (!activeTimers.length) return;

    const stopOverdueTimers = async () => {
      const now = new Date();
      const overdue = activeTimers.filter(event => {
        const deadline = timerDeadline(event);
        return deadline && deadline <= now;
      });
      await Promise.all(
        overdue.map(async event => {
          if (!event.id || autoStoppingIds.current.has(event.id)) return;
          autoStoppingIds.current.add(event.id);
          try {
            await stopTimedEventAtLimit(selectedBaby.id!, event);
          } catch (nextError) {
            setError(
              nextError instanceof Error
                ? nextError.message
                : 'Unable to apply the timer safety limit.',
            );
          } finally {
            autoStoppingIds.current.delete(event.id);
          }
        }),
      );
    };

    void stopOverdueTimers();
    const nearestDeadline = Math.min(
      ...activeTimers.map(event => timerDeadline(event)!.getTime()),
    );
    const timeout = setTimeout(
      () => void stopOverdueTimers(),
      Math.max(0, nearestDeadline - Date.now()) + 100,
    );
    return () => clearTimeout(timeout);
  }, [customSleepLocations, events, selectedBaby?.id]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter(event => event.startTime >= todayStart);

  const requireContext = () => {
    if (!user) throw new Error('You are not signed in.');
    if (!selectedBaby?.id) throw new Error('Select a baby first.');
    return { userId: user.uid, babyId: selectedBaby.id };
  };

  const value = useMemo<EventContextValue>(
    () => ({
      events,
      todayEvents,
      activeFeed,
      activeSleep,
      activePumping,
      loading,
      error,
      logFeed: async input => {
        const { userId, babyId } = requireContext();
        const { startTime, endTime } = careEventTimes(input);
        return logEvent(babyId, {
          type: 'feed',
          startTime,
          endTime,
          durationMinutes: input.durationMinutes,
          source: 'app',
          loggedBy: userId,
          notes: input.notes?.trim() || undefined,
          metadata: {
            feedType: input.feedType,
            breastSide: input.breastSide,
            breastSidesUsed:
              input.feedType === 'breast' && input.breastSidesUsed
                ? input.breastSidesUsed
                : input.feedType === 'breast' && input.breastSide === 'both'
                  ? ['left', 'right']
                : input.feedType === 'breast' &&
                    (input.breastSide === 'left' || input.breastSide === 'right')
                  ? [input.breastSide]
                  : undefined,
            lastBreastSide:
              input.feedType === 'breast'
                ? input.lastBreastSide ||
                  (input.breastSide === 'left' || input.breastSide === 'right'
                    ? input.breastSide
                    : undefined)
                : undefined,
            leftBreastDurationSeconds:
              input.feedType === 'breast'
                ? input.leftBreastDurationSeconds
                : undefined,
            rightBreastDurationSeconds:
              input.feedType === 'breast'
                ? input.rightBreastDurationSeconds
                : undefined,
            amount: input.amount,
            unit: input.unit,
          },
        }, input.startTime ? undefined : activeSleep);
      },
      logSleep: async (durationMinutes, notes, sleepType, times) => {
        const { userId, babyId } = requireContext();
        const endTime = times?.endTime || new Date();
        const startTime =
          times?.startTime ||
          new Date(endTime.getTime() - durationMinutes * 60_000);
        return logEvent(babyId, {
          type: 'sleep',
          startTime,
          endTime,
          durationMinutes,
          source: 'app',
          loggedBy: userId,
          notes: notes?.trim() || undefined,
          metadata: { sleepType },
        });
      },
      startFeed: async input => {
        const { userId, babyId } = requireContext();
        if (activeFeed) throw new Error('A feed timer is already running.');
        return createFeedEvent(babyId, userId, {
          ...input,
          notes: input.notes?.trim() || undefined,
        }, activeSleep);
      },
      stopFeed: async eventOverride => {
        const { babyId } = requireContext();
        const feedToStop = eventOverride || activeFeed;
        if (!feedToStop) throw new Error('There is no active feed timer.');
        await finishFeedEvent(babyId, feedToStop);
      },
      cancelFeed: async () => {
        const { babyId } = requireContext();
        if (!activeFeed?.id) throw new Error('There is no active feed timer.');
        await softDeleteEvent(babyId, activeFeed.id);
      },
      switchFeed: async input => {
        const { userId, babyId } = requireContext();
        if (!activeFeed) throw new Error('There is no active feed timer.');
        await switchFeedEvent(babyId, activeFeed, userId, input);
      },
      logDiaper: async (
        condition,
        notes,
        startTime,
        diaperAmount,
        wetDiaperAmount,
        dirtyDiaperAmount,
      ) => {
        const { userId, babyId } = requireContext();
        const eventTime = startTime || new Date();
        return logEvent(babyId, {
          type: 'diaper',
          startTime: eventTime,
          endTime: eventTime,
          source: 'app',
          loggedBy: userId,
          notes: notes?.trim() || undefined,
          metadata: {
            diaperCondition: condition,
            diaperAmount,
            wetDiaperAmount,
            dirtyDiaperAmount,
          },
        });
      },
      logCareEvent: async input => {
        const { userId, babyId } = requireContext();
        const { startTime, endTime } = careEventTimes(input, new Date());
        return logEvent(babyId, {
          type: input.type,
          startTime,
          endTime,
          durationMinutes: input.durationMinutes,
          source: 'app',
          loggedBy: userId,
          notes: input.notes?.trim() || undefined,
          metadata: input.metadata,
        });
      },
      startPumping: async side => {
        const { userId, babyId } = requireContext();
        if (activePumping) throw new Error('A pumping timer is already running.');
        return logEvent(babyId, {
          type: 'pumping',
          startTime: new Date(),
          endTime: null,
          source: 'app',
          loggedBy: userId,
          metadata: { pumpingSide: side || 'both' },
        });
      },
      stopPumping: async () => {
        const { babyId } = requireContext();
        if (!activePumping) throw new Error('There is no pumping timer running.');
        await finishFeedEvent(babyId, activePumping);
      },
      cancelPumping: async () => {
        const { babyId } = requireContext();
        if (!activePumping?.id) throw new Error('There is no pumping timer running.');
        await softDeleteEvent(babyId, activePumping.id);
      },
      startSleep: async (sleepType, startTime) => {
        const { userId, babyId } = requireContext();
        if (activeSleep) throw new Error('A sleep timer is already running.');
        return createSleepEvent(babyId, userId, sleepType, startTime);
      },
      stopSleep: async () => {
        const { babyId } = requireContext();
        if (!activeSleep) throw new Error('There is no active sleep timer.');
        await finishSleepEvent(babyId, activeSleep);
      },
      cancelSleep: async () => {
        const { babyId } = requireContext();
        if (!activeSleep?.id) throw new Error('There is no active sleep timer.');
        await softDeleteEvent(babyId, activeSleep.id);
      },
      editEvent: async (eventId, updates) => {
        const { babyId } = requireContext();
        await updateEvent(babyId, eventId, updates);
      },
      deleteEvent: async eventId => {
        const { babyId } = requireContext();
        await softDeleteEvent(babyId, eventId);
      },
      deleteEvents: async eventIds => {
        const { babyId } = requireContext();
        await Promise.all(
          eventIds.map(eventId => softDeleteEvent(babyId, eventId)),
        );
      },
      mergeEvents: async eventIds => {
        const { babyId } = requireContext();
        const selected = events.filter(
          event => event.id && eventIds.includes(event.id),
        );
        const plan = buildMergePlan(selected);
        await mergeEventGroup(
          babyId,
          plan.targetId,
          plan.updates,
          plan.removedIds,
        );
      },
      reopenEvent: async (eventId, metadata) => {
        const { babyId } = requireContext();
        await reopenTimedEvent(babyId, eventId, metadata);
      },
    }),
    [
      activeFeed,
      activeSleep,
      activePumping,
      error,
      events,
      loading,
      selectedBaby?.id,
      todayEvents,
      user,
    ],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvents must be used inside EventProvider.');
  return context;
};
