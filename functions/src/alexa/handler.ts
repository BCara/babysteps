import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { LogFeedIntentHandler } from './intents/logFeed';
import { LogSleepIntentHandler } from './intents/logSleep';
import { LogDiaperIntentHandler } from './intents/logDiaper';

const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput: HandlerInput) {
    const speechText = 'Welcome to Baby Steps. You can say things like: log a feed, start sleep, or log a wet diaper. What would you like to do?';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput: HandlerInput, error: Error) {
    console.log(`~~~~ Error handled: ${error.message}`);
    const speechText = 'Sorry, I had trouble understanding what you asked. Please try again.';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  }
};

export const AlexaSkillHandler = [
  LaunchRequestHandler,
  LogFeedIntentHandler,
  LogSleepIntentHandler,
  LogDiaperIntentHandler,
  ErrorHandler
];
