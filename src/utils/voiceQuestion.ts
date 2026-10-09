import type { BabyEvent } from '../services/firebase/events';
import {
  ageInWeeks,
  ageWakeWindow,
  observedWakeWindows,
} from './sleepRecommendation';

export type VoiceQuestion = 'wake-window';

/** Recognises a spoken question the app can answer from the care log. */
export const parseVoiceQuestion = (transcript: string): VoiceQuestion | null => {
  const text = transcript.trim().toLowerCase();
  if (/\b(wake|awake)\s*(window|windows|time|times|period|periods)\b/.test(text)) {
    return 'wake-window';
  }
  return null;
};

export const formatMinutes = (minutes: number) => {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const WINDOW_DAYS = 7;

/** "Ivy's average wake window…", from this week's sleeps plus the age norm. */
export const answerWakeWindowQuestion = ({
  babyName,
  dateOfBirth,
  events,
  now,
}: {
  babyName: string;
  dateOfBirth: Date;
  events: BabyEvent[];
  now: Date;
}) => {
  const band = ageWakeWindow(ageInWeeks(dateOfBirth, now));
  const typical = `Typical at this age is ${formatMinutes(band.min)}–${formatMinutes(band.max)}.`;
  const windows = observedWakeWindows(events, now, WINDOW_DAYS);

  if (windows.length < 2) {
    return `There are not enough logged sleeps this week to work out ${babyName}’s wake windows yet. ${typical}`;
  }

  const average = windows.reduce((sum, minutes) => sum + minutes, 0) / windows.length;
  return `${babyName}’s average wake window over the last ${WINDOW_DAYS} days is ${formatMinutes(
    average,
  )}, from ${windows.length} gaps between sleeps. ${typical}`;
};
