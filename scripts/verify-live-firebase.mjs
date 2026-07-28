import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const projectId = 'babysteps-cbert';
const configuration = JSON.parse(
  await readFile(new URL('../google-services.json', import.meta.url), 'utf8'),
);
const apiKey =
  configuration.client?.[0]?.api_key?.[0]?.current_key;

if (!apiKey) {
  throw new Error('No Firebase API key was found in google-services.json.');
}

const authEndpoint = operation =>
  `https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${apiKey}`;
const documentEndpoint = path =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;

const postJson = async (url, body, token) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const firestoreRequest = async (method, path, token, body, query = '') => {
  const response = await fetch(`${documentEndpoint(path)}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const requireStatus = (label, result, expected) => {
  if (result.response.status !== expected) {
    throw new Error(
      `${label} returned ${result.response.status}: ${JSON.stringify(result.payload)}`,
    );
  }
  console.log(`${label}: ${result.response.status}`);
};

const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
const password = `Bs!${randomUUID()}A9`;
const ownerEmail = `babysteps-live-owner-${suffix}@example.com`;
const otherEmail = `babysteps-live-other-${suffix}@example.com`;
const babyId = `live-test-${suffix}`;
const eventId = `event-${suffix}`;
const now = new Date().toISOString();

let owner;
let other;

try {
  const ownerSignup = await postJson(authEndpoint('signUp'), {
    email: ownerEmail,
    password,
    returnSecureToken: true,
  });
  requireStatus('Create owner auth account', ownerSignup, 200);
  owner = ownerSignup.payload;

  const profile = await firestoreRequest(
    'PATCH',
    `users/${owner.localId}`,
    owner.idToken,
    {
      fields: {
        displayName: { stringValue: 'Live verification owner' },
        email: { stringValue: ownerEmail },
        babyIds: { arrayValue: { values: [] } },
        activeBabyId: { nullValue: null },
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
    },
  );
  requireStatus('Create owner profile', profile, 200);

  const baby = await firestoreRequest(
    'PATCH',
    `babies/${babyId}`,
    owner.idToken,
    {
      fields: {
        info: {
          mapValue: {
            fields: {
              name: { stringValue: 'Test Baby' },
              dateOfBirth: { timestampValue: '2026-04-01T00:00:00.000Z' },
              isActive: { booleanValue: true },
              createdAt: { timestampValue: now },
              updatedAt: { timestampValue: now },
            },
          },
        },
        authorizedCaregivers: {
          arrayValue: { values: [{ stringValue: owner.localId }] },
        },
      },
    },
  );
  requireStatus('Create baby profile', baby, 200);

  const profileUpdate = await firestoreRequest(
    'PATCH',
    `users/${owner.localId}`,
    owner.idToken,
    {
      fields: {
        babyIds: {
          arrayValue: { values: [{ stringValue: babyId }] },
        },
        activeBabyId: { stringValue: babyId },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    },
    '?updateMask.fieldPaths=babyIds&updateMask.fieldPaths=activeBabyId&updateMask.fieldPaths=updatedAt',
  );
  requireStatus('Select baby on owner profile', profileUpdate, 200);

  const event = await firestoreRequest(
    'PATCH',
    `babies/${babyId}/events/${eventId}`,
    owner.idToken,
    {
      fields: {
        type: { stringValue: 'diaper' },
        startTime: { timestampValue: now },
        endTime: { timestampValue: now },
        source: { stringValue: 'app' },
        loggedBy: { stringValue: owner.localId },
        metadata: {
          mapValue: {
            fields: {
              diaperCondition: { stringValue: 'wet' },
            },
          },
        },
        createdAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
        deletedAt: { nullValue: null },
      },
    },
  );
  requireStatus('Create authorised event', event, 200);

  const ownerRead = await firestoreRequest(
    'GET',
    `babies/${babyId}/events/${eventId}`,
    owner.idToken,
  );
  requireStatus('Read own event', ownerRead, 200);

  const otherSignup = await postJson(authEndpoint('signUp'), {
    email: otherEmail,
    password,
    returnSecureToken: true,
  });
  requireStatus('Create second auth account', otherSignup, 200);
  other = otherSignup.payload;

  const deniedRead = await firestoreRequest(
    'GET',
    `babies/${babyId}`,
    other.idToken,
  );
  requireStatus('Deny cross-account baby read', deniedRead, 403);

  console.log('Live Firebase verification passed.');
} finally {
  if (owner?.idToken) {
    await firestoreRequest(
      'DELETE',
      `babies/${babyId}/events/${eventId}`,
      owner.idToken,
    ).catch(() => undefined);
    await firestoreRequest(
      'DELETE',
      `babies/${babyId}`,
      owner.idToken,
    ).catch(() => undefined);
    await firestoreRequest(
      'DELETE',
      `users/${owner.localId}`,
      owner.idToken,
    ).catch(() => undefined);
    await postJson(authEndpoint('delete'), { idToken: owner.idToken }).catch(
      () => undefined,
    );
  }
  if (other?.idToken) {
    await postJson(authEndpoint('delete'), { idToken: other.idToken }).catch(
      () => undefined,
    );
  }
  console.log('Disposable live-test accounts and documents cleaned up.');
}
