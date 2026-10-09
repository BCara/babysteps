import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { SkillBuilders } from 'ask-sdk-core';
import {
  SkillRequestSignatureVerifier,
  TimestampVerifier,
} from 'ask-sdk-express-adapter';
import {
  AlexaErrorHandler,
  AlexaRequestHandlers,
} from './alexa/handler';
export { alexaAuthorize, alexaToken } from './alexa/oauth';
export { cleanupDeletedUser as alexaCleanupDeletedUser } from './alexa/cleanup';
import {
  cleanupDeletedUserMonetization,
  handlePlayBillingNotification,
  syncCurrentUser,
  verifyPlaySubscription,
} from './monetization';
export { executeCareCommand as watch_executeCareCommand } from './watchCare';
export { extract as appointments_extract } from './appointmentExtraction';
export {
  acceptInvite as sharing_acceptInvite,
  createInvite as sharing_createInvite,
  removeCaregiver as sharing_removeCaregiver,
  revokeInvite as sharing_revokeInvite,
} from './caregiverSharing';
export {
  cleanupDeletedUser as ai_cleanupDeletedUser,
  generate as ai_generate,
  getStatus as ai_getStatus,
  updateConsent as ai_updateConsent,
} from './aiAssistant';

admin.initializeApp();

// Initialize the Alexa Skill
const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    ...AlexaRequestHandlers,
  )
  .addErrorHandlers(AlexaErrorHandler);

const skill = skillBuilder.create();
const signatureVerifier = new SkillRequestSignatureVerifier();
const timestampVerifier = new TimestampVerifier();

// Export HTTPS endpoint for Alexa
export const alexaEndpoint = functions.https.onRequest(
  {
    region: 'australia-southeast1',
    cors: false,
    invoker: 'public',
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST');
      response.status(405).send('Method Not Allowed');
      return;
    }

    const rawBody = request.rawBody.toString('utf8');
    try {
      await signatureVerifier.verify(rawBody, request.headers);
      await timestampVerifier.verify(rawBody);

      const envelope = JSON.parse(rawBody);
      const expectedSkillId = process.env.ALEXA_SKILL_ID;
      const actualSkillId = envelope?.context?.System?.application?.applicationId;
      if (!expectedSkillId || actualSkillId !== expectedSkillId) {
        response.status(403).send('Skill ID rejected');
        return;
      }

      const result = await skill.invoke(envelope, request.headers);
      response.status(200).json(result);
    } catch (error) {
      console.error('Alexa request verification or invocation failed', error);
      response.status(400).send('Invalid Alexa request');
    }
  },
);

export {
  cleanupDeletedUserMonetization as entitlements_cleanupDeletedUser,
  handlePlayBillingNotification as entitlements_handlePlayBillingNotification,
  syncCurrentUser as entitlements_syncCurrentUser,
  verifyPlaySubscription as entitlements_verifyPlaySubscription,
};
