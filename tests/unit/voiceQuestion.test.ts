import { describe, expect, it } from 'vitest';
import type { BabyEvent } from '../../src/services/firebase/events';
import {
  answerWakeWindowQuestion,
  parseVoiceQuestion,
} from '../../src/utils/voiceQuestion';

const now = new Date('2026-10-09T12:00:00Z');
const minutesBefore = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const sleep = (start: number, end: number): BabyEvent => ({
  type: 'sleep',
  startTime: minutesBefore(start),
  endTime: minutesBefore(end),
  source: 'app',
  loggedBy: 'test',
});
// Nine weeks old: the age band is 60–90 minutes.
const dateOfBirth = new Date(now.getTime() - 9 * 7 * 24 * 60 * 60_000);

describe('parseVoiceQuestion', () => {
  it.each([
    'can you tell me average wake window',
    'what is her average wake window',
    'what are the wake windows',
    'average awake time',
  ])('recognises “%s”', phrase => {
    expect(parseVoiceQuestion(phrase)).toBe('wake-window');
  });

  it.each(['wet nappy', 'start a feed', 'slept for 45 minutes'])(
    'leaves “%s” to the care commands',
    phrase => {
      expect(parseVoiceQuestion(phrase)).toBeNull();
    },
  );
});

describe('answerWakeWindowQuestion', () => {
  it('averages the gaps between this week’s sleeps', () => {
    // Gaps of 60 and 90 minutes between three naps.
    const events = [sleep(400, 360), sleep(300, 260), sleep(170, 130)];
    const answer = answerWakeWindowQuestion({ babyName: 'Ivy', dateOfBirth, events, now });
    expect(answer).toContain('Ivy’s average wake window over the last 7 days is 1h 15m');
    expect(answer).toContain('from 2 gaps');
    expect(answer).toContain('Typical at this age is 1h–1h 30m');
  });

  it('falls back to the age norm without enough sleeps', () => {
    const answer = answerWakeWindowQuestion({
      babyName: 'Ivy',
      dateOfBirth,
      events: [sleep(100, 60)],
      now,
    });
    expect(answer).toContain('not enough logged sleeps');
    expect(answer).toContain('1h–1h 30m');
  });
});
