import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import 'firebase/compat/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnvironment: RulesTestEnvironment;

const projectId = 'babysteps-rules-test';

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(
        path.resolve(process.cwd(), 'firestore.rules'),
        'utf8',
      ),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

const seedBaby = async (caregivers = ['owner']) => {
  await testEnvironment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'babies/baby-1'), {
      info: {
        name: 'Leo',
        dateOfBirth: new Date('2026-04-01'),
        isActive: true,
      },
      authorizedCaregivers: caregivers,
    });
  });
};

describe('user profiles', () => {
  it('allows a user to create and read their own profile', async () => {
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const profile = doc(db, 'users/owner');

    await assertSucceeds(
      setDoc(profile, {
        displayName: 'Owner',
        email: 'owner@example.com',
        babyIds: [],
        activeBabyId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(profile));
  });

  it('does not allow access to another user profile', async () => {
    const db = testEnvironment.authenticatedContext('other').firestore();
    await assertFails(getDoc(doc(db, 'users/owner')));
  });

  it('does not let a user add a self-granted entitlement to profile creation', async () => {
    const db = testEnvironment.authenticatedContext('owner').firestore();
    await assertFails(
      setDoc(doc(db, 'users/owner'), {
        displayName: 'Owner',
        email: 'owner@example.com',
        babyIds: [],
        activeBabyId: null,
        accessLevel: 'premium',
        adFree: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows the owner to save their Home action layout', async () => {
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const profile = doc(db, 'users/owner');
    await setDoc(profile, {
      displayName: 'Owner', email: 'owner@example.com', babyIds: [], activeBabyId: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    await assertSucceeds(updateDoc(profile, {
      homeActions: ['nursing', 'bottle', 'sleep', 'diaper', 'temperature'],
      updatedAt: serverTimestamp(),
    }));
  });

  it('allows the owner to save quick-care preferences', async () => {
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const profile = doc(db, 'users/owner');
    await setDoc(profile, {
      displayName: 'Owner', email: 'owner@example.com', babyIds: [], activeBabyId: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    await assertSucceeds(updateDoc(profile, {
      quickCarePreferences: {
        bottle: { mode: 'specific', bottleAmount: 120, bottleUnit: 'ml' },
        sleep: { mode: 'auto' },
      },
      updatedAt: serverTimestamp(),
    }));
  });
});

describe('monetization records', () => {
  beforeEach(async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'entitlements/owner'), {
        accessLevel: 'premium',
        adFree: true,
        source: 'google_play_subscription',
      });
      await setDoc(doc(context.firestore(), 'playPurchases/purchase-token-hash'), {
        uid: 'owner',
        entitled: true,
      });
    });
  });

  it('allows only the account owner to read their entitlement', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    const otherDb = testEnvironment.authenticatedContext('other').firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'entitlements/owner')));
    await assertFails(getDoc(doc(otherDb, 'entitlements/owner')));
  });

  it('blocks all client writes to entitlements', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    const entitlement = doc(ownerDb, 'entitlements/owner');

    await assertFails(updateDoc(entitlement, { adFree: false }));
    await assertFails(deleteDoc(entitlement));
    await assertFails(
      setDoc(doc(ownerDb, 'entitlements/new-owner'), {
        accessLevel: 'legacy',
        adFree: true,
      }),
    );
  });

  it('blocks clients from reading or writing raw Play purchase records', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    const purchase = doc(ownerDb, 'playPurchases/purchase-token-hash');

    await assertFails(getDoc(purchase));
    await assertFails(updateDoc(purchase, { entitled: false }));
  });
});

describe('AI server records', () => {
  beforeEach(async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const database = context.firestore();
      await setDoc(doc(database, 'aiConsents/owner'), {
        accepted: true,
        policyVersion: '2026-08-ai-v1',
      });
      await setDoc(doc(database, 'aiUsage/owner'), { freeUsed: 1 });
      await setDoc(doc(database, 'aiRequests/request-1'), {
        uid: 'owner',
        status: 'completed',
      });
      await setDoc(doc(database, 'aiSummaryCache/cache-1'), {
        uid: 'owner',
        content: { title: 'Private summary' },
      });
      await setDoc(doc(database, 'aiOperations/budget-2026-08'), {
        estimatedUsd: 1,
      });
    });
  });

  it('blocks every client from direct AI record access', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    for (const path of [
      'aiConsents/owner',
      'aiUsage/owner',
      'aiRequests/request-1',
      'aiSummaryCache/cache-1',
      'aiOperations/budget-2026-08',
    ]) {
      await assertFails(getDoc(doc(ownerDb, path)));
      await assertFails(setDoc(doc(ownerDb, path), { forged: true }));
      await assertFails(deleteDoc(doc(ownerDb, path)));
    }
  });
});

describe('baby and event access', () => {
  it('allows the caregiver to read a baby and blocks another user', async () => {
    await seedBaby();
    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    const otherDb = testEnvironment.authenticatedContext('other').firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'babies/baby-1')));
    await assertFails(getDoc(doc(otherDb, 'babies/baby-1')));
  });

  it('allows valid app events from an authorized caregiver', async () => {
    await seedBaby();
    const db = testEnvironment.authenticatedContext('owner').firestore();

    await assertSucceeds(
      setDoc(doc(db, 'babies/baby-1/events/event-1'), {
        type: 'diaper',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'owner',
        metadata: { diaperCondition: 'wet' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      }),
    );
  });

  it('allows an authorized caregiver to start and stop a feed timer', async () => {
    await seedBaby();
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const event = doc(db, 'babies/baby-1/events/feed-timer');

    await assertSucceeds(
      setDoc(event, {
        type: 'feed',
        startTime: new Date(),
        endTime: null,
        source: 'app',
        loggedBy: 'owner',
        metadata: { feedType: 'breast', breastSide: 'left' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      }),
    );

    await assertSucceeds(
      updateDoc(event, {
        endTime: new Date(),
        durationMinutes: 12,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows a feed timer to switch type in one atomic batch', async () => {
    await seedBaby();
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const currentEvent = doc(db, 'babies/baby-1/events/feed-left');
    const nextEvent = doc(db, 'babies/baby-1/events/feed-bottle');

    await assertSucceeds(
      setDoc(currentEvent, {
        type: 'feed',
        startTime: new Date(),
        endTime: null,
        source: 'app',
        loggedBy: 'owner',
        metadata: { feedType: 'breast', breastSide: 'left' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      }),
    );

    const batch = writeBatch(db);
    batch.update(currentEvent, {
      endTime: new Date(),
      durationMinutes: 4,
      updatedAt: serverTimestamp(),
    });
    batch.set(nextEvent, {
      type: 'feed',
      startTime: new Date(),
      endTime: null,
      source: 'app',
      loggedBy: 'owner',
      metadata: { feedType: 'bottle' },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
    });

    await assertSucceeds(batch.commit());
  });

  it('allows an additional care record and blocks unsupported types and forged identity', async () => {
    await seedBaby();
    const db = testEnvironment.authenticatedContext('owner').firestore();

    await assertSucceeds(
      setDoc(doc(db, 'babies/baby-1/events/event-1'), {
        type: 'medication',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'owner',
        metadata: { medicineName: 'Prescribed medicine', doseAmount: 2, doseUnit: 'mL' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'babies/baby-1/events/event-2'), {
        type: 'unsupported',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'owner',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'babies/baby-1/events/event-3'), {
        type: 'feed',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'other',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      }),
    );
  });

  it('allows soft deletion but prevents changing immutable ownership fields', async () => {
    await seedBaby();
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'babies/baby-1/events/event-1'), {
        type: 'feed',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    });

    const db = testEnvironment.authenticatedContext('owner').firestore();
    const event = doc(db, 'babies/baby-1/events/event-1');
    await assertSucceeds(updateDoc(event, { deletedAt: serverTimestamp() }));
    await assertFails(updateDoc(event, { loggedBy: 'other' }));
  });

  it('allows full deletion only when the account is the sole caregiver', async () => {
    await seedBaby();
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'babies/baby-1/events/event-1'), {
        type: 'feed',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    });
    const db = testEnvironment.authenticatedContext('owner').firestore();
    await assertSucceeds(
      deleteDoc(doc(db, 'babies/baby-1/events/event-1')),
    );
    await assertSucceeds(deleteDoc(doc(db, 'babies/baby-1')));
  });

  it('allows a caregiver to leave a shared profile without deleting its history', async () => {
    await seedBaby(['owner', 'other']);
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'babies/baby-1/events/event-1'), {
        type: 'feed',
        startTime: new Date(),
        endTime: new Date(),
        source: 'app',
        loggedBy: 'owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    });

    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    const otherDb = testEnvironment.authenticatedContext('other').firestore();
    const ownerBaby = doc(ownerDb, 'babies/baby-1');

    await assertFails(
      updateDoc(ownerBaby, {
        authorizedCaregivers: ['owner'],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(ownerBaby, {
        authorizedCaregivers: ['other'],
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(getDoc(ownerBaby));
    await assertSucceeds(getDoc(doc(otherDb, 'babies/baby-1')));
    await assertSucceeds(
      getDoc(doc(otherDb, 'babies/baby-1/events/event-1')),
    );
  });
});

describe('custom sleep places', () => {
  it('allows owner add, rename and remove, but blocks other users and malformed places', async () => {
    const db = testEnvironment.authenticatedContext('owner').firestore();
    const profile = doc(db, 'users/owner');
    await setDoc(profile, { displayName: 'Owner', email: 'owner@example.com', babyIds: [], activeBabyId: null });
    await assertSucceeds(updateDoc(profile, { customSleepLocations: [{ id: 'custom:carrier', label: 'Carrier' }] }));
    await assertSucceeds(updateDoc(profile, { customSleepLocations: [{ id: 'custom:carrier', label: 'Baby carrier' }] }));
    const other = testEnvironment.authenticatedContext('other').firestore();
    await assertFails(updateDoc(doc(other, 'users/owner'), { customSleepLocations: [] }));
    await assertFails(updateDoc(profile, { customSleepLocations: 'Carrier' }));
    await assertFails(updateDoc(profile, { customSleepLocations: [{ id: 'car', label: 'Car' }] }));
    await assertFails(updateDoc(profile, { customSleepLocations: [{ id: 'custom:carrier', label: 'x'.repeat(25) }] }));
    await assertFails(updateDoc(profile, { customSleepLocations: Array.from({length: 6}, (_, i) => ({id: `custom:place-${i}`, label: 'Place'})) }));
    await assertSucceeds(updateDoc(profile, { customSleepLocations: [] }));
  });
});

describe('caregiver sharing', () => {
  beforeEach(async () => {
    await seedBaby(['owner', 'partner']);
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const database = context.firestore();
      await setDoc(doc(database, 'babies/baby-1/caregivers/owner'), {
        displayName: 'Owner',
        email: 'owner@example.com',
      });
      await setDoc(doc(database, 'babies/baby-1/caregivers/partner'), {
        displayName: 'Partner',
        email: 'partner@example.com',
      });
      await setDoc(doc(database, 'babyInvites/K7QM3XPD'), {
        babyId: 'baby-1',
        createdBy: 'owner',
        acceptedBy: null,
        revoked: false,
      });
    });
  });

  it('lets caregivers see who else has access, but not outsiders', async () => {
    const partnerDb = testEnvironment.authenticatedContext('partner').firestore();
    const otherDb = testEnvironment.authenticatedContext('other').firestore();

    await assertSucceeds(getDoc(doc(partnerDb, 'babies/baby-1/caregivers/owner')));
    await assertFails(getDoc(doc(otherDb, 'babies/baby-1/caregivers/owner')));
  });

  it('only lets a caregiver delete their own caregiver entry', async () => {
    const partnerDb = testEnvironment.authenticatedContext('partner').firestore();

    await assertFails(
      setDoc(doc(partnerDb, 'babies/baby-1/caregivers/partner'), {
        displayName: 'Renamed',
      }),
    );
    await assertFails(deleteDoc(doc(partnerDb, 'babies/baby-1/caregivers/owner')));
    await assertSucceeds(deleteDoc(doc(partnerDb, 'babies/baby-1/caregivers/partner')));
  });

  it('keeps invite codes server-only', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner').firestore();
    const otherDb = testEnvironment.authenticatedContext('other').firestore();

    await assertFails(getDoc(doc(ownerDb, 'babyInvites/K7QM3XPD')));
    await assertFails(getDoc(doc(otherDb, 'babyInvites/K7QM3XPD')));
    await assertFails(
      updateDoc(doc(otherDb, 'babyInvites/K7QM3XPD'), { acceptedBy: 'other' }),
    );
  });

  it('does not let an outsider add themselves to a baby profile', async () => {
    const otherDb = testEnvironment.authenticatedContext('other').firestore();
    await assertFails(
      updateDoc(doc(otherDb, 'babies/baby-1'), {
        authorizedCaregivers: ['owner', 'partner', 'other'],
      }),
    );
  });
});
