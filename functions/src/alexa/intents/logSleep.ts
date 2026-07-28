import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import * as admin from 'firebase-admin';

export const LogSleepIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'LogSleepIntent';
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

      // Let's figure out if we are starting or stopping sleep based on slot or intent name
      const request = handlerInput.requestEnvelope.request as IntentRequest;
      const actionSlot = request.intent.slots?.Action?.value; // e.g. "start", "stop", "woke up"
      
      if (actionSlot === 'stop' || actionSlot === 'woke up') {
        // Stop sleep: find the most recent open sleep event
        const recentSleepQuery = await admin.firestore()
          .collection('babies')
          .doc(babyId)
          .collection('events')
          .where('type', '==', 'sleep')
          .orderBy('startTime', 'desc')
          .limit(1)
          .get();
          
        if (!recentSleepQuery.empty && !recentSleepQuery.docs[0].data().endTime) {
          const doc = recentSleepQuery.docs[0];
          await doc.ref.update({
            endTime: admin.firestore.Timestamp.now()
          });
          return handlerInput.responseBuilder
            .speak('I have stopped the sleep timer. Hope they had a good nap!')
            .getResponse();
        } else {
          return handlerInput.responseBuilder
            .speak('I couldn\'t find an active sleep timer to stop.')
            .getResponse();
        }
      } else {
        // Start sleep
        await admin.firestore()
          .collection('babies')
          .doc(babyId)
          .collection('events')
          .add({
            type: 'sleep',
            startTime: admin.firestore.Timestamp.now(),
            endTime: null, // Timer is running
            source: 'alexa',
            loggedBy: userId,
          });

        return handlerInput.responseBuilder
          .speak('Okay, I have started the sleep timer. Shhh.')
          .getResponse();
      }

    } catch (error) {
      console.error(error);
      return handlerInput.responseBuilder
        .speak('Sorry, something went wrong.')
        .getResponse();
    }
  }
};
