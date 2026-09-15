import {
  ErrorHandler as AskErrorHandler,
  HandlerInput,
  RequestHandler,
} from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import {
  AlexaUserError,
  LinkAccountError,
  requireLinkedBaby,
} from './account';
import {
  logCompletedEvent,
  logDiaper,
  startTimedEvent,
  stopTimedEvent,
} from './events';
import { parseAmazonDurationMinutes } from './oauthCore';

const isRequestType = (handlerInput: HandlerInput, type: string) =>
  handlerInput.requestEnvelope.request.type === type;

const isIntent = (handlerInput: HandlerInput, name: string) =>
  isRequestType(handlerInput, 'IntentRequest')
  && (handlerInput.requestEnvelope.request as IntentRequest).intent.name === name;

const getSlot = (handlerInput: HandlerInput, name: string) => {
  if (!isRequestType(handlerInput, 'IntentRequest')) return undefined;
  const request = handlerInput.requestEnvelope.request as IntentRequest;
  return request.intent.slots?.[name]?.value?.trim();
};

const normalizeFeedType = (value: string | undefined) => {
  const normalized = value?.toLowerCase() || '';
  if (normalized.includes('breast') || normalized.includes('nurs')) {
    return 'breast' as const;
  }
  if (normalized.includes('bottle') || normalized.includes('formula')) {
    return 'bottle' as const;
  }
  return undefined;
};

const normalizeBreastSide = (value: string | undefined) => {
  const normalized = value?.toLowerCase();
  if (normalized === 'left' || normalized === 'right' || normalized === 'both') {
    return normalized;
  }
  return undefined;
};

const normalizeSleepType = (value: string | undefined) => {
  const normalized = value?.toLowerCase() || '';
  if (normalized.includes('contact')) return 'contactNap' as const;
  if (normalized.includes('night')) return 'night' as const;
  return 'nap' as const;
};

const normalizeDiaperCondition = (value: string | undefined) => {
  const normalized = value?.toLowerCase() || '';
  if (
    normalized.includes('both')
    || (normalized.includes('wet') && normalized.includes('dirty'))
  ) {
    return 'both' as const;
  }
  if (
    normalized.includes('dirty')
    || normalized.includes('soiled')
    || normalized.includes('poo')
  ) {
    return 'dirty' as const;
  }
  return 'wet' as const;
};

const LaunchRequestHandler: RequestHandler = {
  canHandle: handlerInput => isRequestType(handlerInput, 'LaunchRequest'),
  handle(handlerInput) {
    const speechText = 'Welcome to PitterPatter. You can start a feed, start sleep, or log a wet nappy. What would you like to do?';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

const StartFeedIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'StartFeedIntent'),
  async handle(handlerInput) {
    const context = await requireLinkedBaby(handlerInput);
    const feedType = normalizeFeedType(getSlot(handlerInput, 'FeedType'));
    const breastSide = normalizeBreastSide(getSlot(handlerInput, 'BreastSide'));
    await startTimedEvent(context, 'feed', { feedType, breastSide });
    return handlerInput.responseBuilder
      .speak(`Started a feed for ${context.babyName}.`)
      .getResponse();
  },
};

const StopFeedIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'StopFeedIntent'),
  async handle(handlerInput) {
    const context = await requireLinkedBaby(handlerInput);
    const duration = await stopTimedEvent(context, 'feed');
    return handlerInput.responseBuilder
      .speak(`Stopped the feed. It lasted ${duration} minute${duration === 1 ? '' : 's'}.`)
      .getResponse();
  },
};

const LogFeedIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'LogFeedIntent'),
  async handle(handlerInput) {
    const duration = parseAmazonDurationMinutes(getSlot(handlerInput, 'Duration'));
    if (!duration) {
      return handlerInput.responseBuilder
        .speak('How long was the feed?')
        .reprompt('Tell me how many minutes the feed lasted.')
        .addElicitSlotDirective('Duration')
        .getResponse();
    }

    const context = await requireLinkedBaby(handlerInput);
    const feedType = normalizeFeedType(getSlot(handlerInput, 'FeedType'));
    const breastSide = normalizeBreastSide(getSlot(handlerInput, 'BreastSide'));
    await logCompletedEvent(
      context,
      'feed',
      duration,
      { feedType, breastSide },
    );
    return handlerInput.responseBuilder
      .speak(`Logged a ${duration} minute feed for ${context.babyName}.`)
      .getResponse();
  },
};

const StartSleepIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'StartSleepIntent'),
  async handle(handlerInput) {
    const context = await requireLinkedBaby(handlerInput);
    const sleepType = normalizeSleepType(getSlot(handlerInput, 'SleepType'));
    await startTimedEvent(context, 'sleep', { sleepType });
    return handlerInput.responseBuilder
      .speak(`Started sleep for ${context.babyName}.`)
      .getResponse();
  },
};

const StopSleepIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'StopSleepIntent'),
  async handle(handlerInput) {
    const context = await requireLinkedBaby(handlerInput);
    const duration = await stopTimedEvent(context, 'sleep');
    return handlerInput.responseBuilder
      .speak(`Stopped sleep. It lasted ${duration} minute${duration === 1 ? '' : 's'}.`)
      .getResponse();
  },
};

const LogSleepIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'LogSleepIntent'),
  async handle(handlerInput) {
    const duration = parseAmazonDurationMinutes(getSlot(handlerInput, 'Duration'));
    if (!duration) {
      return handlerInput.responseBuilder
        .speak('How long did the sleep last?')
        .reprompt('Tell me how many minutes the sleep lasted.')
        .addElicitSlotDirective('Duration')
        .getResponse();
    }

    const context = await requireLinkedBaby(handlerInput);
    const sleepType = normalizeSleepType(getSlot(handlerInput, 'SleepType'));
    await logCompletedEvent(context, 'sleep', duration, { sleepType });
    return handlerInput.responseBuilder
      .speak(`Logged ${duration} minutes of sleep for ${context.babyName}.`)
      .getResponse();
  },
};

const LogDiaperIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'LogDiaperIntent'),
  async handle(handlerInput) {
    const context = await requireLinkedBaby(handlerInput);
    const condition = normalizeDiaperCondition(getSlot(handlerInput, 'Condition'));
    await logDiaper(context, condition);
    const description = condition === 'both' ? 'wet and dirty' : condition;
    return handlerInput.responseBuilder
      .speak(`Logged a ${description} nappy for ${context.babyName}.`)
      .getResponse();
  },
};

const HelpIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'AMAZON.HelpIntent'),
  handle(handlerInput) {
    const speechText = 'You can say, start a feed, stop sleep, log a ten minute feed, or log a wet nappy.';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler: RequestHandler = {
  canHandle: handlerInput =>
    isIntent(handlerInput, 'AMAZON.CancelIntent')
    || isIntent(handlerInput, 'AMAZON.StopIntent')
    || isIntent(handlerInput, 'AMAZON.NavigateHomeIntent'),
  handle: handlerInput =>
    handlerInput.responseBuilder.speak('Goodbye.').getResponse(),
};

const FallbackIntentHandler: RequestHandler = {
  canHandle: handlerInput => isIntent(handlerInput, 'AMAZON.FallbackIntent'),
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('I did not understand that. Try saying, log a wet nappy.')
      .reprompt('What would you like to log?')
      .getResponse();
  },
};

const SessionEndedRequestHandler: RequestHandler = {
  canHandle: handlerInput => isRequestType(handlerInput, 'SessionEndedRequest'),
  handle: handlerInput => handlerInput.responseBuilder.getResponse(),
};

export const AlexaErrorHandler: AskErrorHandler = {
  canHandle: () => true,
  handle(handlerInput: HandlerInput, error: Error) {
    if (error instanceof LinkAccountError) {
      return handlerInput.responseBuilder
        .speak(error.message)
        .withLinkAccountCard()
        .getResponse();
    }

    if (error instanceof AlexaUserError) {
      return handlerInput.responseBuilder
        .speak(error.message)
        .getResponse();
    }

    console.error('Unexpected Alexa skill error', error);
    const speechText = 'Sorry, I could not save that in PitterPatter. Please try again.';
    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

export const AlexaRequestHandlers = [
  LaunchRequestHandler,
  StartFeedIntentHandler,
  StopFeedIntentHandler,
  LogFeedIntentHandler,
  StartSleepIntentHandler,
  StopSleepIntentHandler,
  LogSleepIntentHandler,
  LogDiaperIntentHandler,
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  FallbackIntentHandler,
  SessionEndedRequestHandler,
];
