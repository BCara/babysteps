import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const update = vi.fn();
  const set = vi.fn();
  const get = vi.fn();
  const add = vi.fn(async () => ({ id: 'feed-new' }));
  const doc = vi.fn((id?: string) => ({ id: id || 'feed-new' }));
  const collection = { doc, add };
  const runTransaction = vi.fn(async (operation: Function) => operation({ get, update, set }));
  const firestore = Object.assign(() => ({
    collection: () => ({ doc: () => ({ collection: () => collection }) }),
    runTransaction,
  }), {
    Timestamp: { fromDate: (value: Date) => value },
    FieldValue: { serverTimestamp: () => 'server-time' },
  });
  return { firestore, get, update, set, add, runTransaction };
});
vi.mock('@react-native-firebase/firestore', () => ({ default: db.firestore }));

import { logEvent, startFeed, type BabyEvent } from '../../src/services/firebase/events';

const start = new Date('2026-09-13T01:00:00Z');
const feedTime = new Date('2026-09-13T02:30:00Z');
const sleep: BabyEvent = {
  id: 'sleep-1', type: 'sleep', startTime: start, endTime: null,
  source: 'app', loggedBy: 'parent',
};
const liveSleep = { type: 'sleep', startTime: { toDate: () => start }, endTime: null };
const beginFeed = () => startFeed('baby', 'parent', {
  feedType: 'breast', breastSide: 'left', startTime: feedTime,
}, sleep);

beforeEach(() => {
  vi.clearAllMocks();
  db.get.mockResolvedValue({ data: () => liveSleep });
});

describe('starting a feed during sleep', () => {
  it('saves sleep at the feed start and creates nursing in the same transaction', async () => {
    await expect(beginFeed()).resolves.toBe('feed-new');
    expect(db.runTransaction).toHaveBeenCalledOnce();
    expect(db.update).toHaveBeenCalledWith({ id: 'sleep-1' }, expect.objectContaining({
      endTime: feedTime, durationMinutes: 90,
    }));
    expect(db.set).toHaveBeenCalledWith({ id: 'feed-new' }, expect.objectContaining({
      type: 'feed', startTime: feedTime, endTime: null,
      metadata: expect.objectContaining({ feedType: 'breast', breastSide: 'left' }),
    }));
    expect(db.add).not.toHaveBeenCalled();
  });

  it('also transitions sleep when logging an immediate bottle', async () => {
    await logEvent('baby', {
      type: 'feed', startTime: feedTime, endTime: feedTime,
      source: 'app', loggedBy: 'parent', metadata: { feedType: 'bottle', amount: 120, unit: 'ml' },
    }, sleep);
    expect(db.update).toHaveBeenCalledOnce();
    expect(db.set).toHaveBeenCalledOnce();
  });

  it('preserves a sleep already stopped by another caregiver', async () => {
    db.get.mockResolvedValue({ data: () => ({ ...liveSleep, endTime: feedTime }) });
    await beginFeed();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledOnce();
  });

  it('rejects an earlier feed time before staging either write', async () => {
    await expect(startFeed('baby', 'parent', {
      feedType: 'breast', startTime: new Date(start.getTime() - 60_000),
    }, sleep)).rejects.toThrow('before this sleep began');
    expect(db.update).not.toHaveBeenCalled();
    expect(db.set).not.toHaveBeenCalled();
  });

  it('does not create a feed if the sleep record cannot be read', async () => {
    db.get.mockRejectedValueOnce(new Error('Connection lost'));
    await expect(beginFeed()).rejects.toThrow('Connection lost');
    expect(db.update).not.toHaveBeenCalled();
    expect(db.set).not.toHaveBeenCalled();
  });

  it('keeps the ordinary feed path when no sleep is supplied', async () => {
    await startFeed('baby', 'parent', { feedType: 'bottle', startTime: feedTime });
    expect(db.add).toHaveBeenCalledOnce();
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
