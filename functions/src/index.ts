import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { SkillBuilders } from 'ask-sdk-core';
import { AlexaSkillHandler } from './alexa/handler';

admin.initializeApp();

// Initialize the Alexa Skill
const skillBuilder = SkillBuilders.custom()
  .addRequestHandlers(
    ...AlexaSkillHandler
  );

const skill = skillBuilder.create();

// Export HTTPS endpoint for Alexa
export const alexaEndpoint = functions.https.onRequest(async (request, response) => {
  try {
    const textBody = JSON.stringify(request.body);
    const result = await skill.invoke(request.body, request.headers);
    response.status(200).send(result);
  } catch (error) {
    console.error("Alexa skill error:", error);
    response.status(500).send("Internal Skill Error");
  }
});
