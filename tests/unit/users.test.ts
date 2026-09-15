import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn();
  const update = vi.fn();
  const documentDelete = vi.fn();
  const onSnapshot = vi.fn();
  const doc = vi.fn(() => ({ get, set, update, delete: documentDelete, onSnapshot }));
  const queryGet = vi.fn();
  const where = vi.fn(() => ({ get: queryGet }));
  const collection = vi.fn((name: string) =>
    name === 'babies' ? { where } : { doc },
  );
  const batchDelete = vi.fn();
  const batchCommit = vi.fn();
  const batch = vi.fn(() => ({ delete: batchDelete, commit: batchCommit }));
  const arrayRemove = vi.fn((value: string) => `array-remove:${value}`);
  const serverTimestamp = vi.fn(() => 'server-timestamp');

  return {
    arrayRemove,
    batch,
    batchCommit,
    batchDelete,
    collection,
    doc,
    documentDelete,
    get,
    onSnapshot,
    queryGet,
    serverTimestamp,
    set,
    update,
    where,
  };
});

vi.mock('@react-native-firebase/firestore', () => ({
  default: Object.assign(
    () => ({
      batch: firestoreMocks.batch,
      collection: firestoreMocks.collection,
    }),
    {
      FieldValue: {
        arrayRemove: firestoreMocks.arrayRemove,
        serverTimestamp: firestoreMocks.serverTimestamp,
      },
    },
  ),
}));

import {
  deleteUserData,
  ensureUserProfile,
  subscribeToUserProfile,
} from '../../src/services/firebase/users';

describe('user profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a profile when the document does not exist', async () => {
    firestoreMocks.get.mockResolvedValue({
      exists: () => false,
    });

    await ensureUserProfile('user-1', 'owner@example.com', 'Owner');

    expect(firestoreMocks.set).toHaveBeenCalledWith({
      displayName: 'Owner',
      email: 'owner@example.com',
      babyIds: [],
      activeBabyId: null,
      createdAt: 'server-timestamp',
      updatedAt: 'server-timestamp',
    });
    expect(firestoreMocks.update).not.toHaveBeenCalled();
  });

  it('reports a missing profile without reading undefined data', () => {
    const callback = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation(success => {
      success({
        exists: () => false,
        data: vi.fn(() => undefined),
      });
      return vi.fn();
    });

    subscribeToUserProfile('user-1', callback);

    expect(callback).toHaveBeenCalledWith(null);
  });

  it('removes only the departing caregiver from a shared baby profile', async () => {
    const babyUpdate = vi.fn();
    const babyDelete = vi.fn();
    firestoreMocks.queryGet.mockResolvedValue({
      docs: [
        {
          data: () => ({ authorizedCaregivers: ['owner', 'other'] }),
          ref: {
            update: babyUpdate,
            delete: babyDelete,
          },
        },
      ],
    });

    await deleteUserData('owner');

    expect(babyUpdate).toHaveBeenCalledWith({
      authorizedCaregivers: 'array-remove:owner',
      updatedAt: 'server-timestamp',
    });
    expect(babyDelete).not.toHaveBeenCalled();
    expect(firestoreMocks.batchDelete).not.toHaveBeenCalled();
    expect(firestoreMocks.documentDelete).toHaveBeenCalledOnce();
  });

  it('deletes a baby and its events when the account is the last caregiver', async () => {
    const firstEvent = { id: 'event-1' };
    const secondEvent = { id: 'event-2' };
    const babyDelete = vi.fn();
    const eventsGet = vi.fn().mockResolvedValue({
      docs: [{ ref: firstEvent }, { ref: secondEvent }],
    });
    firestoreMocks.queryGet.mockResolvedValue({
      docs: [
        {
          data: () => ({ authorizedCaregivers: ['owner'] }),
          ref: {
            collection: vi.fn(() => ({ get: eventsGet })),
            delete: babyDelete,
          },
        },
      ],
    });

    await deleteUserData('owner');

    expect(firestoreMocks.batchDelete).toHaveBeenNthCalledWith(1, firstEvent);
    expect(firestoreMocks.batchDelete).toHaveBeenNthCalledWith(2, secondEvent);
    expect(firestoreMocks.batchCommit).toHaveBeenCalledOnce();
    expect(babyDelete).toHaveBeenCalledOnce();
    expect(firestoreMocks.documentDelete).toHaveBeenCalledOnce();
  });
});
