import { HandlerInput } from 'ask-sdk-core';
import * as admin from 'firebase-admin';
import { sha256Hex } from './oauthCore';

export class LinkAccountError extends Error {
  constructor() {
    super('Link your PitterPatter account in the Alexa app first.');
  }
}

export class AlexaUserError extends Error {}

export interface LinkedBabyContext {
  userId: string;
  babyId: string;
  babyName: string;
}

const getAccessToken = (handlerInput: HandlerInput) =>
  handlerInput.requestEnvelope.context.System.user.accessToken;

export const requireLinkedBaby = async (
  handlerInput: HandlerInput,
): Promise<LinkedBabyContext> => {
  const accessToken = getAccessToken(handlerInput);
  if (!accessToken) throw new LinkAccountError();

  const tokenSnapshot = await admin.firestore()
    .collection('alexaAccessTokens')
    .doc(sha256Hex(accessToken))
    .get();
  const token = tokenSnapshot.data();
  const expiresAt = token?.expiresAt?.toMillis?.() || 0;

  if (!tokenSnapshot.exists || !token?.userId || expiresAt <= Date.now()) {
    throw new LinkAccountError();
  }

  const userId = String(token.userId);
  const userSnapshot = await admin.firestore().collection('users').doc(userId).get();
  const user = userSnapshot.data();
  const babyIds = Array.isArray(user?.babyIds) ? user.babyIds.map(String) : [];
  const babyId = user?.activeBabyId
    ? String(user.activeBabyId)
    : babyIds[0];

  if (!babyId) {
    throw new AlexaUserError(
      'I could not find a baby profile. Add a baby in the PitterPatter app first.',
    );
  }

  const babySnapshot = await admin.firestore().collection('babies').doc(babyId).get();
  const baby = babySnapshot.data();
  const caregivers = Array.isArray(baby?.authorizedCaregivers)
    ? baby.authorizedCaregivers.map(String)
    : [];

  if (!babySnapshot.exists || !caregivers.includes(userId)) {
    throw new AlexaUserError(
      'I could not access the selected baby. Open PitterPatter and select a baby, then try again.',
    );
  }

  return {
    userId,
    babyId,
    babyName: String(baby?.info?.name || 'your baby'),
  };
};
