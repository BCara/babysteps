import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import {
  ALEXA_OAUTH_CLIENT_ID,
  createOpaqueToken,
  isAllowedAlexaRedirect,
  matchesSecret,
  parseBasicCredentials,
  sha256Hex,
  verifyPkce,
} from './oauthCore';

const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_DAYS = 180;
const AUTHORIZATION_CODE_MINUTES = 5;

export const alexaOAuthClientSecret = defineSecret(
  'ALEXA_OAUTH_CLIENT_SECRET',
);

const asString = (value: unknown) =>
  typeof value === 'string' ? value : '';

const setOAuthHeaders = (response: {
  set: (field: string, value: string) => unknown;
}) => {
  response.set('Cache-Control', 'no-store');
  response.set('Pragma', 'no-cache');
};

const sendOAuthError = (
  response: {
    status: (code: number) => {
      json: (body: Record<string, string>) => unknown;
    };
  },
  status: number,
  error: string,
  description: string,
) => response.status(status).json({
  error,
  error_description: description,
});

const getClientCredentials = (
  authorization: string | undefined,
  body: Record<string, unknown>,
) => {
  const basic = parseBasicCredentials(authorization);
  if (basic) return basic;
  return {
    clientId: asString(body.client_id),
    clientSecret: asString(body.client_secret),
  };
};

const issueTokens = async (userId: string, refreshToken?: string) => {
  const accessToken = createOpaqueToken();
  const nextRefreshToken = refreshToken || createOpaqueToken();
  const now = admin.firestore.Timestamp.now();
  const accessExpiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + ACCESS_TOKEN_SECONDS * 1000,
  );
  const refreshExpiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  );
  const batch = admin.firestore().batch();

  batch.set(
    admin.firestore().collection('alexaAccessTokens').doc(sha256Hex(accessToken)),
    {
      userId,
      createdAt: now,
      expiresAt: accessExpiresAt,
    },
  );

  batch.set(
    admin.firestore()
      .collection('alexaRefreshTokens')
      .doc(sha256Hex(nextRefreshToken)),
    {
      userId,
      createdAt: now,
      updatedAt: now,
      expiresAt: refreshExpiresAt,
    },
    { merge: true },
  );

  await batch.commit();

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: nextRefreshToken,
  };
};

export const alexaAuthorize = onRequest(
  {
    region: 'australia-southeast1',
    cors: false,
    invoker: 'public',
  },
  async (request, response) => {
    setOAuthHeaders(response);

    if (request.method !== 'POST') {
      response.set('Allow', 'POST');
      response.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const authorization = request.get('authorization') || '';
    const idToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    if (!idToken) {
      response.status(401).json({ error: 'firebase_auth_required' });
      return;
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const clientId = asString(body.client_id);
    const responseType = asString(body.response_type);
    const redirectUri = asString(body.redirect_uri);
    const state = asString(body.state);
    const scope = asString(body.scope);
    const codeChallenge = asString(body.code_challenge);
    const codeChallengeMethod = asString(body.code_challenge_method);

    if (
      clientId !== ALEXA_OAUTH_CLIENT_ID
      || responseType !== 'code'
      || !state
      || !isAllowedAlexaRedirect(redirectUri)
      || !codeChallenge
      || codeChallengeMethod !== 'S256'
    ) {
      response.status(400).json({ error: 'invalid_authorization_request' });
      return;
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userSnapshot = await admin.firestore()
        .collection('users')
        .doc(decodedToken.uid)
        .get();
      const user = userSnapshot.data();
      const babyIds = Array.isArray(user?.babyIds) ? user.babyIds : [];

      if (!userSnapshot.exists || babyIds.length === 0) {
        response.status(409).json({
          error: 'baby_profile_required',
          message: 'Add a baby in the PitterPatter app before linking Alexa.',
        });
        return;
      }

      const authorizationCode = createOpaqueToken();
      const now = admin.firestore.Timestamp.now();
      await admin.firestore()
        .collection('alexaOAuthCodes')
        .doc(sha256Hex(authorizationCode))
        .set({
          userId: decodedToken.uid,
          clientId,
          redirectUri,
          scope,
          codeChallenge,
          codeChallengeMethod,
          createdAt: now,
          expiresAt: admin.firestore.Timestamp.fromMillis(
            now.toMillis() + AUTHORIZATION_CODE_MINUTES * 60 * 1000,
          ),
        });

      const destination = new URL(redirectUri);
      destination.searchParams.set('code', authorizationCode);
      destination.searchParams.set('state', state);
      response.status(200).json({ redirectUrl: destination.toString() });
    } catch (error) {
      console.error('Alexa authorization failed', error);
      response.status(401).json({ error: 'invalid_firebase_token' });
    }
  },
);

export const alexaToken = onRequest(
  {
    region: 'australia-southeast1',
    cors: false,
    invoker: 'public',
    secrets: [alexaOAuthClientSecret],
  },
  async (request, response) => {
    setOAuthHeaders(response);

    if (request.method !== 'POST') {
      response.set('Allow', 'POST');
      response.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const credentials = getClientCredentials(
      request.get('authorization'),
      body,
    );

    if (
      credentials.clientId !== ALEXA_OAUTH_CLIENT_ID
      || !matchesSecret(
        credentials.clientSecret,
        alexaOAuthClientSecret.value(),
      )
    ) {
      sendOAuthError(
        response,
        401,
        'invalid_client',
        'Client authentication failed.',
      );
      return;
    }

    const grantType = asString(body.grant_type);

    if (grantType === 'authorization_code') {
      const code = asString(body.code);
      const redirectUri = asString(body.redirect_uri);
      const codeVerifier = asString(body.code_verifier);
      if (!code || !redirectUri) {
        sendOAuthError(
          response,
          400,
          'invalid_request',
          'The code and redirect_uri are required.',
        );
        return;
      }

      const codeReference = admin.firestore()
        .collection('alexaOAuthCodes')
        .doc(sha256Hex(code));

      try {
        const userId = await admin.firestore().runTransaction(async transaction => {
          const codeSnapshot = await transaction.get(codeReference);
          const stored = codeSnapshot.data();
          const expiresAt = stored?.expiresAt?.toMillis?.() || 0;

          if (
            !codeSnapshot.exists
            || stored?.clientId !== credentials.clientId
            || stored?.redirectUri !== redirectUri
            || expiresAt <= Date.now()
            || !verifyPkce(codeVerifier, stored?.codeChallenge)
          ) {
            throw new Error('invalid_grant');
          }

          transaction.delete(codeReference);
          return String(stored.userId);
        });

        response.status(200).json(await issueTokens(userId));
      } catch (error) {
        console.warn('Alexa authorization-code exchange rejected', error);
        sendOAuthError(
          response,
          400,
          'invalid_grant',
          'The authorization code or code verifier is invalid.',
        );
      }
      return;
    }

    if (grantType === 'refresh_token') {
      const refreshToken = asString(body.refresh_token);
      const refreshReference = admin.firestore()
        .collection('alexaRefreshTokens')
        .doc(sha256Hex(refreshToken));
      const refreshSnapshot = refreshToken
        ? await refreshReference.get()
        : null;
      const stored = refreshSnapshot?.data();
      const expiresAt = stored?.expiresAt?.toMillis?.() || 0;

      if (
        !refreshSnapshot?.exists
        || !stored?.userId
        || expiresAt <= Date.now()
      ) {
        sendOAuthError(
          response,
          400,
          'invalid_grant',
          'The refresh token is invalid or expired.',
        );
        return;
      }

      await refreshReference.update({
        updatedAt: admin.firestore.Timestamp.now(),
      });
      response.status(200).json(
        await issueTokens(String(stored.userId), refreshToken),
      );
      return;
    }

    sendOAuthError(
      response,
      400,
      'unsupported_grant_type',
      'Use authorization_code or refresh_token.',
    );
  },
);
