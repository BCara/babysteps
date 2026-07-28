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

  it('blocks unsupported event types and forged caregiver identity', async () => {
    await seedBaby();
    const db = testEnvironment.authenticatedContext('owner').firestore();

    await assertFails(
      setDoc(doc(db, 'babies/baby-1/events/event-1'), {
        type: 'medication',
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
      setDoc(doc(db, 'babies/baby-1/events/event-2'), {
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
});
