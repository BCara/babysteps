import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app.js';
import { FirestoreStore } from './store.js';
import { FirestoreCareRepository } from './care.js';

const origin = process.env.MCP_PUBLIC_URL;
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!origin || !projectId || !process.env.FIREBASE_WEB_CONFIG) {
  throw new Error('Set MCP_PUBLIC_URL, GOOGLE_CLOUD_PROJECT and FIREBASE_WEB_CONFIG. See README.md.');
}
const firebaseConfig = JSON.parse(process.env.FIREBASE_WEB_CONFIG);
if (firebaseConfig.projectId !== projectId) throw new Error('Firebase web and server project IDs must match.');
initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(), db = getFirestore();
const app = createApp({ origin, firebaseConfig,
  allowLocalRedirects: process.env.MCP_ALLOW_LOCAL_REDIRECTS === 'true',
  trustProxyHops: Number(process.env.MCP_TRUST_PROXY_HOPS || 0),
}, new FirestoreStore(db), new FirestoreCareRepository(db), {
  verifyIdToken: async token => (await auth.verifyIdToken(token, true)).uid,
  assertUserActive: async uid => { if ((await auth.getUser(uid)).disabled) throw new Error('Account disabled'); },
});
const port = Number(process.env.PORT || 8787);
const listener = app.listen(port, () => console.error(`PitterPatter MCP listening on port ${port}`));
process.on('SIGTERM', () => listener.close());
