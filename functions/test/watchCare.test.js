const assert = require('node:assert/strict');
const test = require('node:test');
const { watchCareTestables } = require('../lib/watchCare');

test('accepts a current, supported watch command', () => {
  const command = watchCareTestables.requireCommand({
    commandId: '12345678-1234-1234-1234-123456789012',
    action: 'diaper',
    occurredAtMillis: Date.now(),
  });
  assert.equal(command.action, 'diaper');
});

test('accepts explicit nursing-side, pause, stop and nappy commands', () => {
  for (const action of [
    'nursing_left',
    'nursing_right',
    'nursing_pause',
    'nursing_stop',
    'diaper_both',
  ]) {
    const command = watchCareTestables.requireCommand({
      commandId: '12345678-1234-1234-1234-123456789012',
      action,
      occurredAtMillis: Date.now(),
    });
    assert.equal(command.action, action);
  }
});

test('rejects unsupported watch actions', () => {
  assert.throws(() => watchCareTestables.requireCommand({
    commandId: '12345678-1234-1234-1234-123456789012',
    action: 'medicine',
    occurredAtMillis: Date.now(),
  }));
});

test('finishes nursing timing on the active side', () => {
  const result = watchCareTestables.finishBreastTiming({
    feedType: 'breast',
    breastSide: 'left',
    lastBreastSide: 'left',
    breastSideStartedAtMs: 1_000,
    leftBreastDurationSeconds: 10,
    rightBreastDurationSeconds: 5,
  }, 31_000);
  assert.equal(result.leftBreastDurationSeconds, 40);
  assert.equal(result.rightBreastDurationSeconds, 5);
  assert.equal(result.breastSideStartedAtMs, undefined);
});

test('caps watch-stopped timers at the phone safety limits', () => {
  assert.equal(
    watchCareTestables.cappedEndMillis('feed', 0, 10 * 60 * 60 * 1000),
    180 * 60 * 1000,
  );
  assert.equal(
    watchCareTestables.cappedEndMillis('sleep', 0, 24 * 60 * 60 * 1000),
    1_080 * 60 * 1000,
  );
});
