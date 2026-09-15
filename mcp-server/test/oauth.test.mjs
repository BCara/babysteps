import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { OAuthService, opaque } from '../build/oauth.js';
import { MemoryStore } from './helpers.mjs';

async function flow(options = {}) {
  let now = Date.now();
  const store = new MemoryStore();
  const oauth = new OAuthService({ origin: 'https://care.example', ...options }, store, () => now);
  const redirect = 'https://claude.ai/api/mcp/auth_callback';
  const client = await oauth.register({ redirect_uris: [redirect] });
  const verifier = opaque(), nonce = opaque();
  const query = { client_id: client.client_id, redirect_uri: redirect, response_type: 'code', state: 'state123',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    resource: oauth.resource, scope: 'care:read care:write offline_access' };
  const requestId = await oauth.authorize(query, nonce);
  const approve = () => oauth.approve(requestId, nonce, 'caregiver-a', true);
  const exchange = code => oauth.token({ grant_type: 'authorization_code', code, code_verifier: verifier,
    client_id: client.client_id, redirect_uri: redirect, resource: oauth.resource });
  return { oauth, store, client, query, verifier, nonce, requestId, approve, exchange,
    advance: milliseconds => { now += milliseconds; } };
}
test('authorization binds browser, state, issuer, PKCE, resource, client and UID', async () => {
  const f = await flow();
  await assert.rejects(f.oauth.consent(f.requestId, opaque()), /invalid_request/);
  const callback = new URL(await f.approve());
  assert.equal(callback.searchParams.get('state'), 'state123');
  assert.equal(callback.searchParams.get('iss'), 'https://care.example');
  const token = await f.exchange(callback.searchParams.get('code'));
  const principal = await f.oauth.verify(token.access_token);
  assert.equal(principal.uid, 'caregiver-a');
  assert.deepEqual(principal.scopes, ['care:read', 'care:write', 'offline_access']);
  for (const record of f.store.data.values()) assert.equal(JSON.stringify(record).includes(token.access_token), false);
});
test('codes are single use even under simultaneous exchange', async () => {
  const f = await flow(), code = new URL(await f.approve()).searchParams.get('code');
  const results = await Promise.allSettled([f.exchange(code), f.exchange(code)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
});
test('wrong verifier, resource, redirect and client do not consume a legitimate code', async () => {
  const f = await flow(), code = new URL(await f.approve()).searchParams.get('code');
  const body = { grant_type: 'authorization_code', code, client_id: f.client.client_id,
    code_verifier: f.verifier, redirect_uri: f.query.redirect_uri, resource: f.oauth.resource };
  for (const override of [{ code_verifier: opaque() }, { resource: 'https://evil.example/mcp' },
    { redirect_uri: 'https://evil.example' }, { client_id: 'invalid-client' }]) {
    await assert.rejects(f.oauth.token({ ...body, ...override }));
  }
  assert.ok((await f.exchange(code)).access_token);
});
test('refresh rotates; replay revokes the grant including the newest access token', async () => {
  const f = await flow(), original = await f.exchange(new URL(await f.approve()).searchParams.get('code'));
  const body = { grant_type: 'refresh_token', refresh_token: original.refresh_token,
    client_id: f.client.client_id, resource: f.oauth.resource };
  const refreshed = await f.oauth.token(body);
  assert.notEqual(refreshed.refresh_token, original.refresh_token);
  await f.oauth.verify(refreshed.access_token);
  await assert.rejects(f.oauth.token(body), /invalid_grant/);
  await assert.rejects(f.oauth.verify(refreshed.access_token), /invalid_token/);
});
test('read-only consent cannot become write consent through refresh', async () => {
  const f = await flow();
  const id = await f.oauth.authorize({ ...f.query, scope: 'care:read offline_access' }, f.nonce);
  const callback = await f.oauth.approve(id, f.nonce, 'caregiver-a', true);
  const tokens = await f.exchange(new URL(callback).searchParams.get('code'));
  await assert.rejects(f.oauth.token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token,
    resource: f.oauth.resource, client_id: f.client.client_id, scope: 'care:read care:write offline_access' }), /invalid_scope/);
});
test('denial and expired requests issue no codes', async () => {
  const f = await flow();
  const result = new URL(await f.oauth.approve(f.requestId, f.nonce, '', false));
  assert.equal(result.searchParams.get('error'), 'access_denied');
  assert.equal(result.searchParams.has('code'), false);
  await assert.rejects(f.approve(), /invalid_request/);
  const g = await flow(); g.advance(11 * 60_000);
  await assert.rejects(g.approve(), /invalid_request/);
});
test('expired access tokens and revoked grants are rejected', async () => {
  const f = await flow(), tokens = await f.exchange(new URL(await f.approve()).searchParams.get('code'));
  await f.oauth.revoke(tokens.refresh_token, 'wrong-client');
  await f.oauth.verify(tokens.access_token);
  await f.oauth.revoke(tokens.refresh_token, f.client.client_id);
  await assert.rejects(f.oauth.verify(tokens.access_token), /invalid_token/);
  const g = await flow(), other = await g.exchange(new URL(await g.approve()).searchParams.get('code'));
  g.advance(3600_001);
  await assert.rejects(g.oauth.verify(other.access_token), /invalid_token/);
});
test('redirect registration rejects hostile domains, fragments and credentials', async () => {
  const f = await flow();
  for (const uri of ['https://claude.ai.evil.example/api/mcp/auth_callback', 'javascript:alert(1)',
    'https://claude.ai/api/mcp/auth_callback#fragment', 'https://x@claude.ai/api/mcp/auth_callback', 'http://localhost:123/callback']) {
    await assert.rejects(f.oauth.register({ redirect_uris: [uri] }));
  }
  for (const uri of ['https://chatgpt.com/connector_platform_oauth_redirect', 'https://chatgpt.com/connector/oauth/callback-id']) {
    assert.ok((await f.oauth.register({ redirect_uris: [uri] })).client_id);
  }
});
test('PKCE is mandatory and invalid scopes cannot reach consent', async () => {
  const f = await flow();
  for (const override of [{ code_challenge_method: 'plain' }, { code_challenge: '' },
    { resource: 'https://other.example/mcp' }, { scope: 'care:read admin' }]) {
    await assert.rejects(f.oauth.authorize({ ...f.query, ...override }, f.nonce));
  }
});
