import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BabyEvent,
  logEvent,
  softDeleteEvent,
  startSleep as createSleepEvent,
  stopSleep as finishSleepEvent,
  subscribeToRecentEvents,
  updateEvent,
} from '../services/firebase/events';
import { useAuth } from './AuthProvider';
import { useBabies } from './BabyProvider';

interface FeedInput {
  feedType: 'breast' | 'bottle';
  amount?: number;
  unit?: 'ml' | 'oz';
  durationMinutes?: number;
  notes?: string;
}

interface EventContextValue {
  events: BabyEvent[];
  todayEvents: BabyEvent[];
  activeSleep: BabyEvent | null;
  loading: boolean;
  error: string | null;
  logFeed: (input: FeedInput) => Promise<void>;
  logDiaper: (
    condition: 'wet' | 'dirty' | 'both',
    notes?: string,
  ) => Promise<void>;
  startSleep: () => Promise<void>;
  stopSleep: () => Promise<void>;
  editEvent: (
    eventId: string,
    updates: Partial<
      Pick<BabyEvent, 'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'>
    >,
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { selectedBaby } = useBabies();
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents([]);
    setError(null);

    if (!selectedBaby?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    return subscribeToRecentEvents(
      selectedBaby.id,
      250,
      nextEvents => {
        setEvents(nextEvents);
        setLoading(false);
      },
      nextError => {
        setError(nextError.message);
        setLoading(false);
      },
    );
  }, [selectedBaby?.id]);

  const activeSleep =
    events.find(event => event.type === 'sleep' && !event.endTime) || null;

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
      activeSleep,
      loading,
      error,
      logFeed: async input => {
        const { userId, babyId } = requireContext();
        await logEvent(babyId, {
          type: 'feed',
          startTime: new Date(),
          endTime: new Date(),
          durationMinutes: input.durationMinutes,
          source: 'app',
          loggedBy: userId,
          notes: input.notes?.trim() || undefined,
          metadata: {
            feedType: input.feedType,
            amount: input.amount,
            unit: input.unit,
          },
        });
      },
      logDiaper: async (condition, notes) => {
        const { userId, babyId } = requireContext();
        const now = new Date();
        await logEvent(babyId, {
          type: 'diaper',
          startTime: now,
          endTime: now,
          source: 'app',
          loggedBy: userId,
          notes: notes?.trim() || undefined,
          metadata: { diaperCondition: condition },
        });
      },
      startSleep: async () => {
        const { userId, babyId } = requireContext();
        if (activeSleep) throw new Error('A sleep timer is already running.');
        await createSleepEvent(babyId, userId);
      },
      stopSleep: async () => {
        const { babyId } = requireContext();
        if (!activeSleep) throw new Error('There is no active sleep timer.');
        await finishSleepEvent(babyId, activeSleep);
      },
      editEvent: async (eventId, updates) => {
        const { babyId } = requireContext();
        await updateEvent(babyId, eventId, updates);
      },
      deleteEvent: async eventId => {
        const { babyId } = requireContext();
        await softDeleteEvent(babyId, eventId);
      },
    }),
    [activeSleep, error, events, loading, selectedBaby?.id, todayEvents, user],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEvents must be used inside EventProvider.');
  return context;
};
