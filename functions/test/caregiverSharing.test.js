const assert = require('node:assert/strict');
const test = require('node:test');
const { caregiverSharingTestables } = require('../lib/caregiverSharing');

const { generateInviteCode, inviteIsUsable, normalizeInviteCode } =
  caregiverSharingTestables;

test('generates codes that survive normalisation', () => {
  for (let index = 0; index < 200; index += 1) {
    const code = generateInviteCode();
    assert.equal(code.length, 8);
    assert.equal(normalizeInviteCode(code), code);
  }
});

test('accepts codes typed with spaces, dashes or lowercase', () => {
  assert.equal(normalizeInviteCode('k7qm-3xpd'), 'K7QM3XPD');
  assert.equal(normalizeInviteCode(' K7QM 3XPD '), 'K7QM3XPD');
});

test('rejects malformed or ambiguous codes', () => {
  assert.equal(normalizeInviteCode('K7QM3XP'), null);
  assert.equal(normalizeInviteCode('K7QM3XP0'), null);
  assert.equal(normalizeInviteCode('K7QM3XPI'), null);
  assert.equal(normalizeInviteCode(12345678), null);
});

test('only unexpired, unused, unrevoked invites are usable', () => {
  const live = { acceptedBy: null, revoked: false, expiresAtMillis: 2_000 };
  assert.equal(inviteIsUsable(live, 1_000), true);
  assert.equal(inviteIsUsable(live, 2_000), false);
  assert.equal(inviteIsUsable({ ...live, revoked: true }, 1_000), false);
  assert.equal(inviteIsUsable({ ...live, acceptedBy: 'partner' }, 1_000), false);
});
