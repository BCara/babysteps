import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, setPersistence, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';

const requestId = new URL(location.href).searchParams.get('request');
const status = document.getElementById('status');
let auth;
const report = text => { status.textContent = text; };
function signedIn() {
  document.getElementById('signin').hidden = true;
  document.getElementById('consent').hidden = false;
  document.getElementById('account').textContent = `Signed in as ${auth.currentUser.email || 'your PitterPatter account'}.`;
  document.getElementById('password').value = '';
  report('Review the permissions above, then allow the connection.');
}
async function login(action) {
  if (!auth) return;
  report('Signing in…');
  try { await action(); signedIn(); }
  catch { report('Sign-in did not complete. Check your details or try again.'); }
}
document.getElementById('google').addEventListener('click', () => login(() => signInWithPopup(auth, new GoogleAuthProvider())));
document.getElementById('email-form').addEventListener('submit', event => {
  event.preventDefault();
  void login(() => signInWithEmailAndPassword(auth, document.getElementById('email').value.trim(), document.getElementById('password').value));
});
async function finish(allow) {
  if (allow && !auth?.currentUser) return;
  document.getElementById('allow').disabled = true;
  document.getElementById('cancel').disabled = true;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (allow) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    const response = await fetch('/oauth/approve', { method: 'POST', headers,
      body: JSON.stringify({ requestId, allow }) });
    if (!response.ok) throw new Error('Connection failed');
    location.assign((await response.json()).redirect);
  } catch {
    report('This connection could not be completed. Return to your assistant and start connecting again.');
    document.getElementById('allow').disabled = false;
    document.getElementById('cancel').disabled = false;
  }
}
document.getElementById('allow').addEventListener('click', () => finish(true));
document.getElementById('cancel').addEventListener('click', () => finish(false));
try {
  const response = await fetch(`/connect-config?request=${encodeURIComponent(requestId)}`);
  if (!response.ok) throw new Error('Expired');
  auth = getAuth(initializeApp(await response.json()));
  await setPersistence(auth, inMemoryPersistence);
} catch { report('This connection has expired. Return to your assistant and start again.'); }
