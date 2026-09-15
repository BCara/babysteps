import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSchema, normalizeEvent, canonical } from '../build/care.js';
const startTime = '2026-09-01T10:00:00+10:00';

test('nappy uses current app metadata and assistant attribution', () => {
  const event = normalizeEvent({ type: 'diaper', startTime, diaperCondition: 'both', diaperAmount: 'heavy' }, 'uid');
  assert.equal(event.metadata.diaperCondition, 'both');
  assert.equal(event.metadata.diaperAmount, 'heavy');
  assert.equal(event.source, 'assistant');
  assert.equal(event.loggedBy, 'uid');
  assert.equal(event.deletedAt, null);
  assert.equal(event.startTime.toMillis(), event.endTime.toMillis());
});
test('nursing and sleep are completed records compatible with timers and summaries', () => {
  const nursing = normalizeEvent({ type: 'feed', feedType: 'breast', breastSide: 'right', durationMinutes: 12, startTime }, 'uid');
  assert.equal(nursing.metadata.rightBreastDurationSeconds, 720);
  assert.equal(nursing.metadata.leftBreastDurationSeconds, 0);
  assert.equal(nursing.endTime.toMillis() - nursing.startTime.toMillis(), 720_000);
  const sleep = normalizeEvent({ type: 'sleep', durationMinutes: 60, startTime }, 'uid');
  assert.ok(sleep.endTime);
  assert.equal(sleep.durationMinutes, 60);
});
test('reject missing details, ambiguous timezone, future finish and unsupported writes', () => {
  for (const event of [{ type: 'feed', feedType: 'bottle', startTime },
    { type: 'sleep', startTime }, { type: 'diaper', startTime },
    { type: 'medication', startTime },
    { type: 'bath', startTime: '2026-09-01T10:00:00' },
    { type: 'bath', startTime, userId: 'other-user' },
    { type: 'feed', feedType: 'bottle', startTime, amount: -5, unit: 'ml' }]) {
    assert.equal(eventSchema.safeParse(event).success, false);
  }
  assert.throws(() => normalizeEvent({ type: 'sleep', startTime, durationMinutes: 60 }, 'uid', Date.parse(startTime)), /finish in the past/);
});
test('retry fingerprints are stable when property order changes', () => {
  assert.equal(canonical({ type: 'bath', startTime }), canonical({ startTime, type: 'bath' }));
});
