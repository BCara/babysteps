import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import * as admin from 'firebase-admin';

export const LogFeedIntentHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'LogFeedIntent';
  },
  async handle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const durationSlot = request.intent.slots?.Duration?.value;
    
    // We need to link the account to get the user's baby data. 
    // The access token is provided by Amazon if account linking is set up.
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;
    
    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak('Please link your Baby Steps account in the Alexa app first.')
        .withLinkAccountCard()
        .getResponse();
    }

    try {
      // In a real scenario, you'd decode the JWT access token to get the user ID.
      // For this prototype, we'll assume the token IS the userId or we'd fetch the user profile.
      // const decodedToken = await admin.auth().verifyIdToken(accessToken);
      // const userId = decodedToken.uid;
      const userId = 'demo-user-id'; // Hardcoded for prototype

      // Fetch the user's primary baby
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const babyIds = userDoc.data()?.babyIds || [];
      
      if (babyIds.length === 0) {
        return handlerInput.responseBuilder
          .speak('I could not find a baby profile associated with your account.')
          .getResponse();
      }

      const babyId = babyIds[0];

      // Log the event
      await admin.firestore()
        .collection('babies')
        .doc(babyId)
        .collection('events')
        .add({
          type: 'feed',
          startTime: admin.firestore.Timestamp.now(),
          endTime: admin.firestore.Timestamp.now(), // Assume it just ended
          duration: durationSlot ? parseInt(durationSlot.match(/\d+/)?.[0] || '15') : 15,
          source: 'alexa',
          loggedBy: userId,
        });

      return handlerInput.responseBuilder
        .speak('Okay, I have logged the feed.')
        .getResponse();

    } catch (error) {
      console.error(error);
      return handlerInput.responseBuilder
        .speak('Sorry, something went wrong while saving the feed.')
        .getResponse();
    }
  }
};
