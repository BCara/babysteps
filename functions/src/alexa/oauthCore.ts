import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const ALEXA_REDIRECT_HOSTS = new Set([
  'alexa.amazon.co.jp',
  'layla.amazon.com',
  'pitangui.amazon.com',
]);

export const ALEXA_OAUTH_CLIENT_ID = 'babysteps-alexa';

export const createOpaqueToken = () => randomBytes(32).toString('base64url');

export const sha256Hex = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export const sha256Base64Url = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('base64url');

export const isAllowedAlexaRedirect = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:'
      && ALEXA_REDIRECT_HOSTS.has(url.hostname)
      && url.pathname.startsWith('/api/skill/link/')
    );
  } catch {
    return false;
  }
};

export const matchesSecret = (actual: string, expected: string) => {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes)
  );
};

export const verifyPkce = (
  codeVerifier: string | undefined,
  codeChallenge: string | undefined,
) => {
  if (!codeChallenge) return true;
  if (!codeVerifier) return false;
  return matchesSecret(sha256Base64Url(codeVerifier), codeChallenge);
};

export const parseBasicCredentials = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Basic ')) return null;

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
};

export const parseAmazonDurationMinutes = (value: string | undefined) => {
  if (!value) return null;

  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return null;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const totalMinutes = days * 1440 + hours * 60 + minutes + seconds / 60;

  return totalMinutes > 0 ? Math.max(1, Math.round(totalMinutes)) : null;
};
