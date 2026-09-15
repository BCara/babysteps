import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { FirestoreCareRepository } from '../build/care.js';
import { FirestoreStore } from '../build/store.js';
import { OAuthService, opaque } from '../build/oauth.js';

test('Firestore: caregiver isolation, event schema, duplicate protection and paginated reads', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):/);
  const app = initializeApp({ projectId: 'demo-pitterpatter-mcp' }, randomUUID());
  const db = getFirestore(app); t.after(async () => { await db.terminate(); await deleteApp(app); });
  const repo = new FirestoreCareRepository(db), babyId = randomUUID();
  await db.collection('babies').doc(babyId).set({ authorizedCaregivers: ['alice'], info: { name: 'Test baby', isActive: true, dateOfBirth: Timestamp.fromDate(new Date('2026-01-01')) } });
  const event = { type: 'diaper', startTime: '2026-09-01T10:00:00+10:00', diaperCondition: 'both', diaperAmount: 'heavy' };
  assert.equal((await repo.listBabies('alice')).some(baby => baby.id === babyId), true);
  assert.equal((await repo.listBabies('bob')).some(baby => baby.id === babyId), false);
  await assert.rejects(repo.queryEvents('bob', { babyId, limit: 10 }), /not available/);
  await assert.rejects(repo.logEvent('bob', babyId, randomUUID(), event), /not available/);
  const request = randomUUID();
  const results = await Promise.all([repo.logEvent('alice', babyId, request, event), repo.logEvent('alice', babyId, request, event)]);
  assert.equal(results[0].eventId, results[1].eventId);
  assert.equal(results.filter(result => result.duplicate).length, 1);
  assert.equal((await db.collection('babies').doc(babyId).collection('events').get()).size, 1);
  await assert.rejects(repo.logEvent('alice', babyId, request, { ...event, diaperCondition: 'wet' }), /different activity/);
  const saved = (await db.collection('babies').doc(babyId).collection('events').doc(results[0].eventId).get()).data();
  assert.equal(saved.source, 'assistant'); assert.equal(saved.loggedBy, 'alice');
  assert.equal(saved.metadata.diaperCondition, 'both'); assert.equal(saved.deletedAt, null);
  const second = await repo.logEvent('alice', babyId, randomUUID(), { ...event, startTime: '2026-09-01T11:00:00+10:00' });
  await db.collection('babies').doc(babyId).collection('events').doc(second.eventId).update({ deletedAt: Timestamp.now() });
  const firstPage = await repo.queryEvents('alice', { babyId, limit: 1 });
  assert.equal(firstPage.events.length, 0); assert.ok(firstPage.nextCursor);
  const nextPage = await repo.queryEvents('alice', { babyId, limit: 2, cursor: firstPage.nextCursor });
  assert.equal(nextPage.events.length, 1); assert.equal(nextPage.nextCursor, null);
  await db.collection('babies').doc(babyId).update({ authorizedCaregivers: [] });
  await assert.rejects(repo.logEvent('alice', babyId, request, event), /not available/);
});
test('Firestore: only one concurrent OAuth code exchange succeeds', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  const app = initializeApp({ projectId: 'demo-pitterpatter-mcp' }, randomUUID());
  const db = getFirestore(app); t.after(async () => { await db.terminate(); await deleteApp(app); });
  const oauth = new OAuthService({ origin: 'https://test.example' }, new FirestoreStore(db));
  const redirect = 'https://claude.ai/api/mcp/auth_callback';
  const client = await oauth.register({ redirect_uris: [redirect] });
  const verifier = opaque(), nonce = opaque();
  const requestId = await oauth.authorize({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', state: 's',
    resource: oauth.resource, scope: 'care:read offline_access', code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url') }, nonce);
  const callback = new URL(await oauth.approve(requestId, nonce, 'alice', true));
  const body = { grant_type: 'authorization_code', code: callback.searchParams.get('code'), code_verifier: verifier,
    client_id: client.client_id, redirect_uri: redirect, resource: oauth.resource };
  const results = await Promise.allSettled([oauth.token(body), oauth.token(body)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
});
