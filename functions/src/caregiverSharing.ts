import { randomInt } from 'node:crypto';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const REGION = 'australia-southeast1';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CAREGIVERS = 6;
// No 0/O, 1/I/L so codes survive being read aloud or retyped from a message.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

const db = () => admin.firestore();

interface InviteRecord {
  babyId: string;
  babyName: string;
  createdBy: string;
  createdByName: string;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  acceptedBy: string | null;
  revoked: boolean;
}

const generateInviteCode = () =>
  Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');

/** Accepts "k7qm-3xpd", "K7QM 3XPD" etc. Returns null for anything malformed. */
const normalizeInviteCode = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const code = value.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every(character => CODE_ALPHABET.includes(character))
    ? code
    : null;
};

const inviteIsUsable = (
  invite: Pick<InviteRecord, 'acceptedBy' | 'revoked'> & { expiresAtMillis: number },
  nowMillis: number,
) => !invite.revoked && !invite.acceptedBy && invite.expiresAtMillis > nowMillis;

const requireUid = (request: { auth?: { uid: string } }) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to manage sharing.');
  }
  return request.auth.uid;
};

const requireBabyId = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Choose a baby profile.');
  }
  return value;
};

const caregiversOf = (data: admin.firestore.DocumentData | undefined) =>
  Array.isArray(data?.authorizedCaregivers)
    ? (data.authorizedCaregivers as string[])
    : [];

const displayNameFor = async (uid: string) => {
  const profile = await db().collection('users').doc(uid).get();
  const name = profile.data()?.displayName;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const email = profile.data()?.email;
  return typeof email === 'string' && email ? email.split('@')[0] : 'A caregiver';
};

const caregiverRecord = async (uid: string) => {
  const profile = await db().collection('users').doc(uid).get();
  return {
    displayName: await displayNameFor(uid),
    email: typeof profile.data()?.email === 'string' ? profile.data()?.email : '',
  };
};

export const createInvite = onCall(
  { region: REGION, enforceAppCheck: true },
  async request => {
    const uid = requireUid(request);
    const babyId = requireBabyId(request.data?.babyId);
    const babyRef = db().collection('babies').doc(babyId);
    const baby = await babyRef.get();
    const caregivers = caregiversOf(baby.data());

    if (!baby.exists || !caregivers.includes(uid)) {
      throw new HttpsError('permission-denied', 'That baby profile is not shared with you.');
    }
    if (caregivers.length >= MAX_CAREGIVERS) {
      throw new HttpsError(
        'failed-precondition',
        `A baby profile can be shared with up to ${MAX_CAREGIVERS} caregivers.`,
      );
    }

    // Reuse this caregiver's outstanding invite so tapping "Invite" twice
    // does not leave several live codes floating around.
    const now = Date.now();
    const existing = await db()
      .collection('babyInvites')
      .where('babyId', '==', babyId)
      .where('createdBy', '==', uid)
      .get();
    const reusable = existing.docs.find(document => {
      const data = document.data() as InviteRecord;
      return inviteIsUsable(
        { ...data, expiresAtMillis: data.expiresAt.toMillis() },
        now,
      );
    });
    if (reusable) {
      const data = reusable.data() as InviteRecord;
      return {
        code: reusable.id,
        babyName: data.babyName,
        expiresAtMillis: data.expiresAt.toMillis(),
      };
    }

    // Make sure the inviter appears in the caregiver list, including profiles
    // created before sharing existed.
    const inviter = await caregiverRecord(uid);
    const inviterRef = babyRef.collection('caregivers').doc(uid);
    if (!(await inviterRef.get()).exists) {
      await inviterRef.set({
        ...inviter,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const babyName = String(baby.data()?.info?.name || 'your baby');
    const expiresAt = admin.firestore.Timestamp.fromMillis(now + INVITE_TTL_MS);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateInviteCode();
      try {
        await db().collection('babyInvites').doc(code).create({
          babyId,
          babyName,
          createdBy: uid,
          createdByName: inviter.displayName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          acceptedBy: null,
          revoked: false,
        });
        return { code, babyName, expiresAtMillis: expiresAt.toMillis() };
      } catch (error) {
        if ((error as { code?: number }).code !== 6) throw error; // ALREADY_EXISTS
      }
    }
    throw new HttpsError('unavailable', 'Could not create an invite. Please try again.');
  },
);

export const revokeInvite = onCall(
  { region: REGION, enforceAppCheck: true },
  async request => {
    const uid = requireUid(request);
    const code = normalizeInviteCode(request.data?.code);
    if (!code) throw new HttpsError('invalid-argument', 'That invite code is not valid.');

    const inviteRef = db().collection('babyInvites').doc(code);
    const invite = await inviteRef.get();
    const data = invite.data() as InviteRecord | undefined;
    if (!data) return { revoked: true };

    const baby = await db().collection('babies').doc(data.babyId).get();
    if (data.createdBy !== uid && !caregiversOf(baby.data()).includes(uid)) {
      throw new HttpsError('permission-denied', 'You cannot change this invite.');
    }
    await inviteRef.update({ revoked: true });
    return { revoked: true };
  },
);

export const acceptInvite = onCall(
  { region: REGION, enforceAppCheck: true },
  async request => {
    const uid = requireUid(request);
    const code = normalizeInviteCode(request.data?.code);
    if (!code) {
      throw new HttpsError('invalid-argument', 'Check the invite code and try again.');
    }

    const member = await caregiverRecord(uid);
    const inviteRef = db().collection('babyInvites').doc(code);

    const result = await db().runTransaction(async transaction => {
      const invite = await transaction.get(inviteRef);
      const data = invite.data() as InviteRecord | undefined;
      if (!data) {
        throw new HttpsError('not-found', 'That invite code was not found.');
      }

      const babyRef = db().collection('babies').doc(data.babyId);
      const baby = await transaction.get(babyRef);
      const caregivers = caregiversOf(baby.data());

      if (caregivers.includes(uid)) {
        return { babyId: data.babyId, babyName: data.babyName, alreadyMember: true };
      }
      if (
        !baby.exists
        || !caregivers.includes(data.createdBy)
        || !inviteIsUsable(
          { ...data, expiresAtMillis: data.expiresAt.toMillis() },
          Date.now(),
        )
      ) {
        throw new HttpsError(
          'failed-precondition',
          'This invite has expired or was already used. Ask for a new code.',
        );
      }
      if (caregivers.length >= MAX_CAREGIVERS) {
        throw new HttpsError(
          'failed-precondition',
          `This baby profile already has ${MAX_CAREGIVERS} caregivers.`,
        );
      }

      transaction.update(babyRef, {
        authorizedCaregivers: admin.firestore.FieldValue.arrayUnion(uid),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(babyRef.collection('caregivers').doc(uid), {
        ...member,
        invitedBy: data.createdBy,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(
        db().collection('users').doc(uid),
        {
          babyIds: admin.firestore.FieldValue.arrayUnion(data.babyId),
          activeBabyId: data.babyId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.update(inviteRef, {
        acceptedBy: uid,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { babyId: data.babyId, babyName: data.babyName, alreadyMember: false };
    });

    logger.info('Caregiver joined baby profile', { babyId: result.babyId });
    return result;
  },
);

/**
 * Removes a caregiver from a baby profile. Anyone may leave; only the profile
 * owner (the first caregiver) may remove someone else. The last caregiver
 * cannot leave — they delete the profile instead.
 */
export const removeCaregiver = onCall(
  { region: REGION, enforceAppCheck: true },
  async request => {
    const uid = requireUid(request);
    const babyId = requireBabyId(request.data?.babyId);
    const target =
      typeof request.data?.caregiverId === 'string' ? request.data.caregiverId : uid;
    const babyRef = db().collection('babies').doc(babyId);

    await db().runTransaction(async transaction => {
      const baby = await transaction.get(babyRef);
      const caregivers = caregiversOf(baby.data());
      if (!caregivers.includes(uid)) {
        throw new HttpsError('permission-denied', 'That baby profile is not shared with you.');
      }
      if (!caregivers.includes(target)) return;
      if (target !== uid && caregivers[0] !== uid) {
        throw new HttpsError(
          'permission-denied',
          'Only the person who created this profile can remove other caregivers.',
        );
      }
      if (caregivers.length === 1) {
        throw new HttpsError(
          'failed-precondition',
          'You are the only caregiver on this profile.',
        );
      }

      const userRef = db().collection('users').doc(target);
      const user = await transaction.get(userRef);
      const remainingBabyIds = ((user.data()?.babyIds as string[]) || []).filter(
        id => id !== babyId,
      );

      transaction.update(babyRef, {
        authorizedCaregivers: admin.firestore.FieldValue.arrayRemove(target),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.delete(babyRef.collection('caregivers').doc(target));
      if (user.exists) {
        transaction.update(userRef, {
          babyIds: remainingBabyIds,
          ...(user.data()?.activeBabyId === babyId
            ? { activeBabyId: remainingBabyIds[0] || null }
            : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    // Invites the removed caregiver handed out stop working too; acceptInvite
    // also checks this, so a failure here is only untidy, not unsafe.
    const invites = await db()
      .collection('babyInvites')
      .where('babyId', '==', babyId)
      .where('createdBy', '==', target)
      .get();
    await Promise.all(
      invites.docs.map(document => document.ref.update({ revoked: true })),
    );

    return { removed: true };
  },
);

export const caregiverSharingTestables = {
  generateInviteCode,
  inviteIsUsable,
  normalizeInviteCode,
};
