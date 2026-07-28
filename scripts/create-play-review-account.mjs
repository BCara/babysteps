import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectId = 'babysteps-cbert';
const email = 'babysteps.play.review@example.com';
const password = `Bs${randomUUID().replaceAll('-', '')}A9`;
const babyId = 'play-review-demo';
const credentialsFile = new URL(
  '../.release-credentials/PLAY_REVIEW_ACCOUNT.txt',
  import.meta.url,
);

const configuration = JSON.parse(
  await readFile(new URL('../google-services.json', import.meta.url), 'utf8'),
);
const apiKey = configuration.client?.[0]?.api_key?.[0]?.current_key;
if (!apiKey) throw new Error('Firebase API key not found.');

try {
  await readFile(credentialsFile);
  throw new Error(
    'A local Play review credential record already exists. No account was created.',
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const authUrl = operation =>
  `https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${apiKey}`;
const documentUrl = path =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;

const requestJson = async (url, method, body, token) => {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
};

const timestamp = value => ({ timestampValue: value.toISOString() });
const string = value => ({ stringValue: value });
const number = value => ({ integerValue: String(value) });
const map = fields => ({ mapValue: { fields } });

const createdAt = new Date();
const account = await requestJson(authUrl('signUp'), 'POST', {
  email,
  password,
  returnSecureToken: true,
});
const token = account.idToken;
const uid = account.localId;

await requestJson(
  documentUrl(`users/${uid}`),
  'PATCH',
  {
    fields: {
      displayName: string('Play Reviewer'),
      email: string(email),
      babyIds: { arrayValue: { values: [] } },
      activeBabyId: { nullValue: null },
      createdAt: timestamp(createdAt),
      updatedAt: timestamp(createdAt),
    },
  },
  token,
);

await requestJson(
  documentUrl(`babies/${babyId}`),
  'PATCH',
  {
    fields: {
      info: map({
        name: string('Avery'),
        dateOfBirth: timestamp(new Date('2026-04-10T00:00:00.000Z')),
        isActive: { booleanValue: true },
        createdAt: timestamp(createdAt),
        updatedAt: timestamp(createdAt),
      }),
      authorizedCaregivers: { arrayValue: { values: [string(uid)] } },
    },
  },
  token,
);

await requestJson(
  `${documentUrl(`users/${uid}`)}?updateMask.fieldPaths=babyIds&updateMask.fieldPaths=activeBabyId&updateMask.fieldPaths=updatedAt`,
  'PATCH',
  {
    fields: {
      babyIds: { arrayValue: { values: [string(babyId)] } },
      activeBabyId: string(babyId),
      updatedAt: timestamp(new Date()),
    },
  },
  token,
);

const eventTime = minutesAgo =>
  new Date(createdAt.getTime() - minutesAgo * 60_000);
const events = [
  {
    id: 'review-feed',
    type: 'feed',
    start: eventTime(45),
    end: eventTime(30),
    duration: 15,
    metadata: map({
      feedType: string('bottle'),
      amount: number(120),
      unit: string('ml'),
    }),
    notes: 'Fictional review data',
  },
  {
    id: 'review-diaper',
    type: 'diaper',
    start: eventTime(120),
    end: eventTime(120),
    metadata: map({ diaperCondition: string('wet') }),
  },
  {
    id: 'review-sleep',
    type: 'sleep',
    start: eventTime(240),
    end: eventTime(150),
    duration: 90,
  },
];

for (const event of events) {
  await requestJson(
    documentUrl(`babies/${babyId}/events/${event.id}`),
    'PATCH',
    {
      fields: {
        type: string(event.type),
        startTime: timestamp(event.start),
        endTime: timestamp(event.end),
        ...(event.duration
          ? { durationMinutes: number(event.duration) }
          : {}),
        source: string('app'),
        loggedBy: string(uid),
        ...(event.metadata ? { metadata: event.metadata } : {}),
        ...(event.notes ? { notes: string(event.notes) } : {}),
        createdAt: timestamp(createdAt),
        updatedAt: timestamp(createdAt),
        deletedAt: { nullValue: null },
      },
    },
    token,
  );
}

const recovery = `BabySteps Google Play review account

Created: ${createdAt.toISOString()}
Firebase project: ${projectId}
Email: ${email}
Password: ${password}
Fictional baby: Avery

Keep this account available while a Play release is under review. Store these
credentials in Play Console's App access section and a secure password manager.
Do not commit this file.
`;

await writeFile(credentialsFile, recovery, 'utf8');

console.log(`Created the fictional Play review account for ${email}.`);
console.log(
  `Credentials were written to ${fileURLToPath(credentialsFile)} and were not printed.`,
);
