const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALEXA_OAUTH_CLIENT_ID,
  isAllowedAlexaRedirect,
  parseAmazonDurationMinutes,
  parseBasicCredentials,
  sha256Base64Url,
  verifyPkce,
} = require('../lib/alexa/oauthCore');

test('uses a stable Alexa OAuth client ID', () => {
  assert.equal(ALEXA_OAUTH_CLIENT_ID, 'babysteps-alexa');
});

test('accepts only Amazon Alexa skill-link redirect URLs', () => {
  assert.equal(
    isAllowedAlexaRedirect(
      'https://layla.amazon.com/api/skill/link/vendor-id',
    ),
    true,
  );
  assert.equal(
    isAllowedAlexaRedirect(
      'https://pitangui.amazon.com/api/skill/link/vendor-id',
    ),
    true,
  );
  assert.equal(
    isAllowedAlexaRedirect('https://example.com/api/skill/link/vendor-id'),
    false,
  );
  assert.equal(
    isAllowedAlexaRedirect(
      'https://layla.amazon.com.evil.example/api/skill/link/vendor-id',
    ),
    false,
  );
});

test('verifies the S256 PKCE code challenge', () => {
  const verifier = 'test-code-verifier-with-more-than-forty-three-characters';
  const challenge = sha256Base64Url(verifier);
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce('wrong-verifier', challenge), false);
  assert.equal(verifyPkce(undefined, challenge), false);
});

test('parses HTTP Basic client credentials', () => {
  const header = `Basic ${Buffer.from('client-id:secret:value').toString('base64')}`;
  assert.deepEqual(parseBasicCredentials(header), {
    clientId: 'client-id',
    clientSecret: 'secret:value',
  });
  assert.equal(parseBasicCredentials('Bearer token'), null);
});

test('parses Amazon duration slots into minutes', () => {
  assert.equal(parseAmazonDurationMinutes('PT10M'), 10);
  assert.equal(parseAmazonDurationMinutes('PT1H30M'), 90);
  assert.equal(parseAmazonDurationMinutes('PT30S'), 1);
  assert.equal(parseAmazonDurationMinutes('invalid'), null);
  assert.equal(parseAmazonDurationMinutes(undefined), null);
});
