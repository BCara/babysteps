import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, get } from 'node:http';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../build/app.js';
import { opaque } from '../build/oauth.js';
import { MemoryStore } from './helpers.mjs';

async function fixture(t) {
  const listener = createServer();
  listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  t.after(() => { listener.closeAllConnections(); listener.close(); });
  const origin = `http://127.0.0.1:${listener.address().port}`;
  const writes = [], reads = [], state = { disabled: false };
  const app = createApp({ origin, firebaseConfig: { apiKey: 'test', authDomain: 'demo.firebaseapp.com', projectId: 'demo-test' } }, new MemoryStore(), {
    listBabies: async uid => { reads.push(uid); return [{ id: 'baby-a', name: 'Demo baby', dateOfBirth: null }]; },
    queryEvents: async (uid, args) => { reads.push(uid); return { events: [], nextCursor: null }; },
    logEvent: async (uid, babyId, requestId, event) => { writes.push({ uid, babyId, requestId, event }); return { eventId: 'event-a', duplicate: false }; },
  }, { verifyIdToken: async token => { assert.equal(token, 'firebase-test-token'); return 'caregiver-a'; },
    assertUserActive: async uid => { assert.equal(uid, 'caregiver-a'); if (state.disabled) throw new Error('disabled'); } });
  listener.on('request', app);
  const post = (path, body, headers = {}) => fetch(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  async function begin(scope = 'care:read care:write offline_access') {
    const client = await (await post('/oauth/register', { client_name: '<script>bad()</script>', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] })).json();
    const verifier = opaque();
    const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: 'code', state: 'test-state',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource: `${origin}/mcp`, scope });
    const response = await fetch(`${origin}/oauth/authorize?${query}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const location = response.headers.get('location');
    const requestId = new URL(location, origin).searchParams.get('request');
    return { client, verifier, cookie, location, requestId };
  }
  async function login(scope) {
    const pending = await begin(scope);
    const approved = await post('/oauth/approve', { requestId: pending.requestId, allow: true }, { cookie: pending.cookie, authorization: 'Bearer firebase-test-token', origin });
    assert.equal(approved.status, 200);
    const code = new URL((await approved.json()).redirect).searchParams.get('code');
    const response = await fetch(`${origin}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: pending.verifier,
        client_id: pending.client.client_id, redirect_uri: pending.client.redirect_uris[0], resource: `${origin}/mcp` }) });
    assert.equal(response.status, 200);
    return response.json();
  }
  return { origin, post, begin, login, writes, reads, state };
}
test('unauthenticated MCP requests provide usable OAuth discovery', async t => {
  const f = await fixture(t), response = await f.post('/mcp', {});
  assert.equal(response.status, 401);
  assert.match(response.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/);
  const metadata = await (await fetch(`${f.origin}/.well-known/oauth-protected-resource/mcp`)).json();
  assert.equal(metadata.resource, `${f.origin}/mcp`);
  const auth = await (await fetch(`${f.origin}/.well-known/oauth-authorization-server`)).json();
  assert.deepEqual(auth.code_challenge_methods_supported, ['S256']);
  assert.equal(auth.authorization_response_iss_parameter_supported, true);
});
test('browser consent escapes client content and rejects cross-site or cookieless approval', async t => {
  const f = await fixture(t), pending = await f.begin();
  const html = await (await fetch(`${f.origin}${pending.location}`, { headers: { cookie: pending.cookie } })).text();
  assert.match(html, /&lt;script&gt;/);
  assert.equal(html.includes('<script>bad()'), false);
  assert.match(html, /claude.ai/);
  assert.equal((await f.post('/oauth/approve', { requestId: pending.requestId, allow: true }, { authorization: 'Bearer firebase-test-token' })).status, 400);
  assert.equal((await f.post('/oauth/approve', { requestId: pending.requestId, allow: true }, { cookie: pending.cookie,
    authorization: 'Bearer firebase-test-token', origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.post('/oauth/approve', { requestId: pending.requestId, allow: true }, { cookie: pending.cookie })).status, 401);
});
test('official MCP client initializes, discovers tools, reads and writes as the authenticated caregiver', async t => {
  const f = await fixture(t), tokens = await f.login();
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${f.origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } });
  await client.connect(transport); t.after(() => client.close());
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['list_babies', 'log_baby_event', 'query_baby_events']);
  assert.equal(tools.find(tool => tool.name === 'log_baby_event').annotations.readOnlyHint, false);
  const babies = await client.callTool({ name: 'list_babies', arguments: {} });
  assert.equal(babies.structuredContent.babies[0].id, 'baby-a');
  const result = await client.callTool({ name: 'log_baby_event', arguments: { babyId: 'baby-a', requestId: randomUUID(),
    event: { type: 'diaper', diaperCondition: 'wet', startTime: '2026-09-01T10:00:00+10:00' } } });
  assert.equal(result.structuredContent.eventId, 'event-a');
  assert.equal(f.writes[0].uid, 'caregiver-a');
  const invalid = await client.callTool({ name: 'log_baby_event', arguments: { babyId: 'baby-a', requestId: randomUUID(),
    event: { type: 'diaper', startTime: '2026-09-01T10:00:00+10:00' } } });
  assert.equal(invalid.isError, true);
  assert.equal(f.writes.length, 1);
});
test('read-only scopes block writes and disabled accounts cannot call MCP', async t => {
  const f = await fixture(t), tokens = await f.login('care:read offline_access');
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${f.origin}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
  t.after(() => client.close());
  const denied = await client.callTool({ name: 'log_baby_event', arguments: { babyId: 'baby-a', requestId: randomUUID(),
    event: { type: 'bath', startTime: '2026-09-01T10:00:00+10:00' } } });
  assert.equal(denied.isError, true); assert.equal(f.writes.length, 0);
  f.state.disabled = true;
  const response = await f.post('/mcp', {}, { authorization: `Bearer ${tokens.access_token}` });
  assert.equal(response.status, 401);
});
test('reject hostile Host headers and invalid JSON', async t => {
  const f = await fixture(t);
  const hostileStatus = await new Promise((resolve, reject) => {
    get(`${f.origin}/healthz`, { headers: { host: 'evil.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(hostileStatus, 421);
  assert.equal((await fetch(`${f.origin}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
});
