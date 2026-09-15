import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Store, Transaction, RecordData } from './store.js';
import { z } from 'zod';

export const SCOPES = ['care:read', 'care:write', 'offline_access'] as const;
export const opaque = () => randomBytes(32).toString('base64url');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const key = (kind: string, token: string) => `${kind}_${hash(token)}`;
const equal = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export class OAuthError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export interface Principal { uid: string; scopes: string[]; grantId: string }
export interface OAuthConfig { origin: string; allowLocalRedirects?: boolean }

export class OAuthService {
  readonly resource: string;
  constructor(public config: OAuthConfig, private store: Store, private now = Date.now) {
    this.resource = `${config.origin}/mcp`;
  }
  metadata() {
    return {
      issuer: this.config.origin,
      authorization_endpoint: `${this.config.origin}/oauth/authorize`,
      token_endpoint: `${this.config.origin}/oauth/token`,
      registration_endpoint: `${this.config.origin}/oauth/register`,
      revocation_endpoint: `${this.config.origin}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: SCOPES,
      authorization_response_iss_parameter_supported: true,
    };
  }
  protectedMetadata() {
    return { resource: this.resource, authorization_servers: [this.config.origin],
      scopes_supported: SCOPES, bearer_methods_supported: ['header'] };
  }
  allowedRedirect(value: string) {
    try {
      const url = new URL(value);
      if (url.username || url.password || url.hash || url.search) return false;
      if (url.origin === 'https://claude.ai' && url.pathname === '/api/mcp/auth_callback') return true;
      if (url.origin === 'https://chatgpt.com' && (
        url.pathname === '/connector_platform_oauth_redirect'
        || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(url.pathname)
      )) return true;
      return Boolean(this.config.allowLocalRedirects && url.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    } catch { return false; }
  }
  async register(body: unknown) {
    const parsed = z.object({
      redirect_uris: z.array(z.string().url().max(2048)).min(1).max(5),
      client_name: z.string().trim().min(1).max(100).default('Care assistant'),
      token_endpoint_auth_method: z.literal('none').default('none'),
      grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
      response_types: z.array(z.literal('code')).optional(),
    }).passthrough().safeParse(body);
    if (!parsed.success || parsed.data.redirect_uris.some(uri => !this.allowedRedirect(uri))) {
      throw new OAuthError('invalid_client_metadata');
    }
    const client = { client_id: opaque(), client_name: parsed.data.client_name,
      redirect_uris: parsed.data.redirect_uris, token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      client_id_issued_at: Math.floor(this.now() / 1000) };
    await this.store.set(key('client', client.client_id), client);
    return client;
  }
  private scopes(value: string) {
    const scopes = [...new Set(value.split(' ').filter(Boolean))];
    if (!scopes.includes('care:read') || scopes.some(scope => !SCOPES.includes(scope as any))) {
      throw new OAuthError('invalid_scope');
    }
    return scopes;
  }
  async authorize(query: unknown, browserNonce: string) {
    const parsed = z.object({
      client_id: z.string().min(1).max(256), response_type: z.literal('code'),
      redirect_uri: z.string().url().max(2048), state: z.string().min(1).max(2048),
      code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      code_challenge_method: z.literal('S256'), resource: z.literal(this.resource),
      scope: z.string().max(200).default('care:read'),
    }).safeParse(query);
    if (!parsed.success) throw new OAuthError('invalid_request');
    const request = parsed.data;
    const client = await this.store.get(key('client', request.client_id));
    if (!client || !client.redirect_uris.includes(request.redirect_uri)) throw new OAuthError('invalid_client');
    const requestId = opaque();
    await this.store.set(key('request', requestId), {
      ...request, scopes: this.scopes(request.scope), clientName: client.client_name,
      browserHash: hash(browserNonce), expiresAt: this.now() + 10 * 60_000,
    });
    return requestId;
  }
  async consent(requestId: string, browserNonce: string) {
    const request = await this.store.get(key('request', requestId));
    if (!request || request.expiresAt <= this.now() || !equal(request.browserHash, hash(browserNonce))) {
      throw new OAuthError('invalid_request');
    }
    return request;
  }
  async approve(requestId: string, browserNonce: string, uid: string, allow: boolean) {
    return this.store.run(async tx => {
      const request = await tx.get(key('request', requestId));
      if (!request || request.expiresAt <= this.now() || !equal(request.browserHash, hash(browserNonce))) {
        throw new OAuthError('invalid_request');
      }
      const redirect = new URL(request.redirect_uri);
      redirect.searchParams.set('state', request.state);
      redirect.searchParams.set('iss', this.config.origin);
      tx.delete(key('request', requestId));
      if (!allow) { redirect.searchParams.set('error', 'access_denied'); return redirect.href; }
      const code = opaque(), grantId = opaque();
      tx.set(key('grant', grantId), { uid, clientId: request.client_id, scopes: request.scopes,
        expiresAt: this.now() + 30 * 86400_000, revoked: false });
      tx.set(key('code', code), { uid, grantId, clientId: request.client_id,
        redirectUri: request.redirect_uri, challenge: request.code_challenge,
        resource: this.resource, scopes: request.scopes, expiresAt: this.now() + 5 * 60_000 });
      redirect.searchParams.set('code', code);
      return redirect.href;
    });
  }
  private issue(tx: Transaction, data: RecordData, grant: RecordData) {
    const access = opaque(), refresh = opaque();
    const record = { uid: data.uid, clientId: data.clientId, grantId: data.grantId,
      scopes: data.scopes, resource: this.resource };
    tx.set(key('access', access), { ...record, expiresAt: this.now() + 3600_000 });
    const offline = data.scopes.includes('offline_access');
    if (offline) tx.set(key('refresh', refresh), { ...record, expiresAt: grant.expiresAt, used: false });
    return { access_token: access, token_type: 'Bearer', expires_in: 3600,
      scope: data.scopes.join(' '), ...(offline ? { refresh_token: refresh } : {}) };
  }
  async token(body: Record<string, unknown>) {
    if (body.resource !== this.resource) throw new OAuthError('invalid_target');
    if (typeof body.client_id !== 'string' || body.client_id.length > 256) throw new OAuthError('invalid_client');
    const client = await this.store.get(key('client', body.client_id));
    if (!client) throw new OAuthError('invalid_client');
    if (body.grant_type === 'authorization_code') {
      if (typeof body.code !== 'string' || typeof body.code_verifier !== 'string'
        || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier)) throw new OAuthError('invalid_grant');
      const code = body.code, verifier = body.code_verifier;
      return this.store.run(async tx => {
        const data = await tx.get(key('code', code));
        if (!data || data.expiresAt <= this.now() || data.clientId !== body.client_id
          || data.redirectUri !== body.redirect_uri || data.resource !== body.resource
          || !equal(data.challenge, createHash('sha256').update(verifier).digest('base64url'))) {
          throw new OAuthError('invalid_grant');
        }
        const grant = await tx.get(key('grant', data.grantId));
        if (!grant || grant.revoked || grant.expiresAt <= this.now()) throw new OAuthError('invalid_grant');
        tx.delete(key('code', code));
        return this.issue(tx, data, grant);
      });
    }
    if (body.grant_type === 'refresh_token' && typeof body.refresh_token === 'string') {
      const refresh = body.refresh_token;
      const result = await this.store.run(async tx => {
        const data = await tx.get(key('refresh', refresh));
        if (!data || data.clientId !== body.client_id || data.expiresAt <= this.now()) throw new OAuthError('invalid_grant');
        const grant = await tx.get(key('grant', data.grantId));
        if (!grant || grant.revoked || grant.expiresAt <= this.now()) throw new OAuthError('invalid_grant');
        if (data.used) { tx.set(key('grant', data.grantId), { ...grant, revoked: true }); return null; }
        // A refresh cannot broaden or silently alter the user's consent.
        if (body.scope !== undefined && body.scope !== data.scopes.join(' ')) throw new OAuthError('invalid_scope');
        tx.set(key('refresh', refresh), { ...data, used: true });
        return this.issue(tx, data, grant);
      });
      if (!result) throw new OAuthError('invalid_grant');
      return result;
    }
    throw new OAuthError('unsupported_grant_type');
  }
  async verify(access: string): Promise<Principal> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(access)) throw new OAuthError('invalid_token', 401);
    const data = await this.store.get(key('access', access));
    if (!data || data.expiresAt <= this.now() || data.resource !== this.resource) throw new OAuthError('invalid_token', 401);
    const grant = await this.store.get(key('grant', data.grantId));
    if (!grant || grant.revoked || grant.expiresAt <= this.now()) throw new OAuthError('invalid_token', 401);
    return { uid: data.uid, scopes: data.scopes, grantId: data.grantId };
  }
  async revoke(token: string, clientId: string) {
    await this.store.run(async tx => {
      const data = await tx.get(key('refresh', token)) || await tx.get(key('access', token));
      if (!data || data.clientId !== clientId) return;
      const grant = await tx.get(key('grant', data.grantId));
      if (grant) tx.set(key('grant', data.grantId), { ...grant, revoked: true });
    });
  }
}
