import express, { type Request, type Response, type NextFunction } from 'express';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { OAuthService, OAuthError, opaque } from './oauth.js';
import type { Store } from './store.js';
import type { CareRepository } from './care.js';
import { createMcpServer } from './mcp.js';

export interface AppConfig {
  origin: string; firebaseConfig: { apiKey: string; authDomain: string; projectId: string };
  allowLocalRedirects?: boolean; trustProxyHops?: number;
}
export interface Identity {
  verifyIdToken(token: string): Promise<string>;
  assertUserActive(uid: string): Promise<void>;
}
const bearer = (request: Request) => /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(request.get('authorization') || '')?.[1] || '';
const cookie = (request: Request) => /(?:^|;\s*)pitterpatter_connect=([A-Za-z0-9_-]{43})(?:;|$)/.exec(request.get('cookie') || '')?.[1] || '';
const safeText = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function createApp(config: AppConfig, store: Store, repository: CareRepository, identity: Identity) {
  const origin = new URL(config.origin);
  if (origin.href !== `${origin.origin}/` || origin.username || origin.password
    || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)))) {
    throw new Error('MCP_PUBLIC_URL must be an HTTPS origin (or HTTP loopback for local testing), without a path.');
  }
  config = { ...config, origin: origin.origin };
  const oauth = new OAuthService(config, store);
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxyHops) app.set('trust proxy', config.trustProxyHops);
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' https://www.gstatic.com; style-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com; frame-src https://*.firebaseapp.com; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' });
    if (origin.protocol === 'https:') res.set('Strict-Transport-Security', 'max-age=31536000');
    let host: string;
    try { host = new URL(`http://${req.get('host')}`).hostname; } catch { res.sendStatus(421); return; }
    if (host !== origin.hostname) { res.sendStatus(421); return; }
    const requestOrigin = req.get('origin');
    if (requestOrigin && requestOrigin !== origin.origin) { res.sendStatus(403); return; }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.use('/oauth', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get(['/health', '/healthz'], (_req, res) => { res.json({ status: 'ok', service: 'pitterpatter-mcp' }); });
  app.get('/.well-known/oauth-authorization-server', (_req, res) => { res.json(oauth.metadata()); });
  app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'], (_req, res) => { res.json(oauth.protectedMetadata()); });
  app.post('/oauth/register', async (req, res) => { res.status(201).json(await oauth.register(req.body)); });
  app.get('/oauth/authorize', async (req, res) => {
    const nonce = opaque();
    const requestId = await oauth.authorize(req.query, nonce);
    res.cookie('pitterpatter_connect', nonce, { httpOnly: true, sameSite: 'lax', secure: origin.protocol === 'https:', maxAge: 600_000, path: '/' });
    res.redirect(`/connect?request=${requestId}`);
  });
  app.get('/connect', async (req, res) => {
    const request = await oauth.consent(String(req.query.request || ''), cookie(req));
    const write = request.scopes.includes('care:write');
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect PitterPatter</title><link rel="stylesheet" href="/connect.css"><script type="module" src="/connect.js"></script></head><body><main><p class="brand">PitterPatter</p><h1>Your care records, in your assistant</h1><p>Connect <strong>${safeText(request.clientName)}</strong> at <strong>${safeText(new URL(request.redirect_uri).hostname)}</strong>.</p><p>This connection can read records for babies you can access${write ? ' and log completed care activities' : ''}. ${request.scopes.includes('offline_access') ? 'It stays connected for up to 30 days.' : 'It lasts up to one hour.'}</p><section id="signin"><button id="google" type="button">Continue with Google</button><p class="divider">or use your PitterPatter email</p><form id="email-form"><label>Email<input id="email" type="email" autocomplete="username" required></label><label>Password<input id="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></section><section id="consent" hidden><p id="account"></p><button id="allow" type="button">Allow connection</button></section><button id="cancel" class="secondary" type="button">Cancel</button><p id="status" role="status" aria-live="polite"></p><p class="fine">Your password is handled by Firebase sign-in. It is never sent to ChatGPT or Claude. Disconnect in your assistant to stop using this connection.</p></main></body></html>`);
  });
  app.get('/connect-config', async (req, res) => {
    await oauth.consent(String(req.query.request || ''), cookie(req));
    res.json(config.firebaseConfig);
  });
  app.post('/oauth/approve', async (req, res) => {
    const body = z.object({ requestId: z.string().regex(/^[A-Za-z0-9_-]{43}$/), allow: z.boolean() }).strict().parse(req.body);
    let uid = '';
    if (body.allow) {
      try { uid = await identity.verifyIdToken(bearer(req)); }
      catch { throw new OAuthError('login_required', 401); }
    }
    const redirect = await oauth.approve(body.requestId, cookie(req), uid, body.allow);
    res.clearCookie('pitterpatter_connect', { path: '/' });
    res.json({ redirect });
  });
  app.post('/oauth/token', async (req, res) => { res.json(await oauth.token(req.body || {})); });
  app.post('/oauth/revoke', async (req, res) => {
    const body = z.object({ token: z.string().max(512), client_id: z.string().max(256) }).passthrough().parse(req.body);
    await oauth.revoke(body.token, body.client_id); res.sendStatus(200);
  });
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url)), { index: false, dotfiles: 'deny' }));
  app.all('/mcp', async (req, res) => {
    let principal;
    try { principal = await oauth.verify(bearer(req)); await identity.assertUserActive(principal.uid); }
    catch {
      res.set('WWW-Authenticate', `Bearer resource_metadata="${config.origin}/.well-known/oauth-protected-resource/mcp", scope="care:read care:write offline_access"`);
      res.status(401).json({ error: 'invalid_token' }); return;
    }
    if (req.method !== 'POST') { res.set('Allow', 'POST').sendStatus(405); return; }
    const server = createMcpServer(repository, principal);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (error instanceof OAuthError) { res.status(error.status).json({ error: error.code }); return; }
    if (error instanceof z.ZodError || error instanceof SyntaxError) { res.status(400).json({ error: 'invalid_request' }); return; }
    console.error('PitterPatter connector request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: 'server_error' });
  });
  return app;
}
