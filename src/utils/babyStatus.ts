import type { BabyEvent, BabyEventType } from '../services/firebase/events';
import { formatTimeSinceEventStart } from './feedTiming';

export type BabyStatusPose =
  | 'sleep'
  | 'breastfeed'
  | 'bottle'
  | 'pumping'
  | 'awake'
  | 'hello'
  | 'nappy'
  | 'solids'
  | 'measurement'
  | 'potty'
  | 'temperature'
  | 'medicine'
  | 'tummyTime'
  | 'bath'
  | 'milestone'
  | 'observation'
  | 'appointment'
  | 'immunisation'
  | 'teething';

export interface BabyStatus {
  pose: BabyStatusPose;
  title: string;
  detail: string;
}

interface BabyStatusInput {
  name: string;
  events: BabyEvent[];
  activeFeed?: BabyEvent | null;
  activeSleep?: BabyEvent | null;
  activePumping?: BabyEvent | null;
  now?: Date;
}

/** How long a finished entry keeps the koala before it settles back to awake. */
export const RECENT_STATUS_MS = 45 * 60_000;

const clock = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const since = (start: Date, now: Date) => {
  const elapsed = formatTimeSinceEventStart(start, now);
  return `Since ${clock(start)} · ${elapsed === 'Just now' ? 'just now' : elapsed}`;
};

const ago = (date: Date, now: Date) => {
  const elapsed = formatTimeSinceEventStart(date, now);
  return elapsed === 'Just now' ? 'just now' : `${elapsed} ago`;
};

const finishedAt = (event: BabyEvent) => event.endTime || event.startTime;

const latest = (events: BabyEvent[], now: Date, match: (event: BabyEvent) => boolean) =>
  events.reduce<BabyEvent | null>((found, event) => {
    const time = finishedAt(event).getTime();
    if (!match(event) || !Number.isFinite(time) || time > now.getTime()) return found;
    return !found || time > finishedAt(found).getTime() ? event : found;
  }, null);

const join = (...parts: Array<string | null | undefined | false>) =>
  parts.filter(Boolean).join(' · ');

const measurement = (event: BabyEvent) => {
  const m = event.metadata;
  return join(
    m?.weightKg != null && `${m.weightKg} kg`,
    m?.heightCm != null && `${m.heightCm} cm`,
    m?.headCircumferenceCm != null && `head ${m.headCircumferenceCm} cm`,
  );
};

type RecentCopy = (name: string, event: BabyEvent) => { pose: BabyStatusPose; title: string; note?: string };

const recentCopy: Record<Exclude<BabyEventType, 'sleep'>, RecentCopy> = {
  feed: (name, event) => ({
    pose: event.metadata?.feedType === 'bottle' ? 'bottle' : 'breastfeed',
    title: `${name} has just fed`,
    note: event.metadata?.feedType === 'bottle' && event.metadata.amount
      ? `${event.metadata.amount} ${event.metadata.unit || 'ml'}`
      : undefined,
  }),
  pumping: (_name, event) => ({
    pose: 'pumping',
    title: 'Pumping done',
    note: event.metadata?.amount ? `${event.metadata.amount} ${event.metadata.unit || 'ml'}` : undefined,
  }),
  diaper: () => ({ pose: 'nappy', title: 'Fresh nappy' }),
  solids: (name, event) => ({ pose: 'solids', title: `${name} had solids`, note: event.metadata?.food }),
  growth: (name, event) => ({ pose: 'measurement', title: `${name} was measured`, note: measurement(event) }),
  potty: () => ({ pose: 'potty', title: 'Potty time' }),
  temperature: (_name, event) => ({
    pose: 'temperature',
    title: 'Temperature taken',
    note: event.metadata?.temperature != null
      ? `${event.metadata.temperature}°${event.metadata.temperatureUnit || 'C'}`
      : undefined,
  }),
  medication: (_name, event) => ({ pose: 'medicine', title: 'Medicine given', note: event.metadata?.medicineName }),
  tummyTime: () => ({ pose: 'tummyTime', title: 'Tummy time done' }),
  bath: (name) => ({ pose: 'bath', title: `${name} is fresh from the bath` }),
  milestone: (name, event) => ({ pose: 'milestone', title: 'A new milestone!', note: event.metadata?.milestone || name }),
  symptom: (_name, event) => ({ pose: 'observation', title: 'Observation noted', note: event.metadata?.observation }),
  appointment: (_name, event) => ({ pose: 'appointment', title: 'Appointment', note: event.metadata?.appointmentType }),
  immunization: (name, event) => ({ pose: 'immunisation', title: `${name} had an immunisation`, note: event.metadata?.immunization }),
  teething: (name) => ({ pose: 'teething', title: `${name} is teething` }),
};

/**
 * What the baby is doing right now, for the koala at the top of Home. A
 * running timer is the truth. Otherwise anything logged in the last
 * 45 minutes takes the koala, so a measurement or a bath shows straight after
 * it is saved; once that passes the baby is awake, counted from the end of
 * the last sleep, with the last feed alongside.
 */
export function babyStatus({
  name,
  events,
  activeFeed,
  activeSleep,
  activePumping,
  now = new Date(),
}: BabyStatusInput): BabyStatus {
  if (activeSleep) {
    return { pose: 'sleep', title: `${name} is asleep`, detail: since(activeSleep.startTime, now) };
  }
  if (activeFeed) {
    const bottle = activeFeed.metadata?.feedType === 'bottle';
    return {
      pose: bottle ? 'bottle' : 'breastfeed',
      title: bottle ? `${name} is having a bottle` : `${name} is feeding`,
      detail: since(activeFeed.startTime, now),
    };
  }
  if (activePumping) {
    return { pose: 'pumping', title: 'Pumping', detail: since(activePumping.startTime, now) };
  }

  const lastSleep = latest(events, now, event => event.type === 'sleep');
  const lastFeed = latest(events, now, event => event.type === 'feed');
  // Entries dated in the future (an appointment booked ahead) never count.
  const lastCare = latest(events, now, event => event.type !== 'sleep');
  if (
    lastCare &&
    now.getTime() - finishedAt(lastCare).getTime() <= RECENT_STATUS_MS &&
    (!lastSleep || finishedAt(lastCare) >= finishedAt(lastSleep))
  ) {
    const copy = recentCopy[lastCare.type as keyof typeof recentCopy](name, lastCare);
    return {
      pose: copy.pose,
      title: copy.title,
      detail: join(copy.note, ago(finishedAt(lastCare), now)),
    };
  }

  if (!lastSleep && !lastFeed && !lastCare) {
    return {
      pose: 'hello',
      title: `Say hello to ${name}`,
      detail: 'Log a feed, sleep or nappy below to get started',
    };
  }

  const fed = lastFeed ? `Fed ${ago(finishedAt(lastFeed), now)}` : null;
  const wokeAt = lastSleep?.endTime && lastSleep.endTime <= now ? lastSleep.endTime : null;
  const awakeFor = wokeAt ? formatTimeSinceEventStart(wokeAt, now) : null;
  const awake = awakeFor
    ? `Awake ${awakeFor === 'Just now' ? 'just now' : `for ${awakeFor}`}`
    : null;
  return {
    pose: 'awake',
    title: `${name} is awake`,
    detail: join(awake, fed),
  };
}
