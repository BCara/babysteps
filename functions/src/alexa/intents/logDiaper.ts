import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import * as admin from 'firebase-admin';

export const LogDiaperIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'LogDiaperIntent';
  },
  async handle(handlerInput: HandlerInput) {
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
    
    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak('Please link your Baby Steps account in the Alexa app first.')
        .withLinkAccountCard()
        .getResponse();
    }

    try {
      const userId = 'demo-user-id'; // Stub
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const babyIds = userDoc.data()?.babyIds || [];
      
      if (babyIds.length === 0) {
        return handlerInput.responseBuilder
          .speak('I could not find a baby profile.')
          .getResponse();
      }
      
      const babyId = babyIds[0];
      const request = handlerInput.requestEnvelope.request as IntentRequest;
      const conditionSlot = request.intent.slots?.Condition?.value; // wet, dirty, both

      await admin.firestore()
        .collection('babies')
        .doc(babyId)
        .collection('events')
        .add({
          type: 'diaper',
          startTime: admin.firestore.Timestamp.now(),
          endTime: admin.firestore.Timestamp.now(),
          source: 'alexa',
          loggedBy: userId,
          metadata: {
            condition: conditionSlot || 'wet'
          }
        });

      return handlerInput.responseBuilder
        .speak(`Okay, I logged a ${conditionSlot || 'wet'} diaper.`)
        .getResponse();

    } catch (error) {
      console.error(error);
      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble saving the diaper change.')
        .getResponse();
    }
  }
};
