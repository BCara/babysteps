# Google Play Data Safety Mapping

This is the implementation-source mapping for the Play Console form. Re-read the current Play definitions before submission and answer from the released bundle, including every SDK. Do not copy an answer blindly if analytics, crash reporting, advertising, payments or another SDK is added.

## Security and handling

- Data encrypted in transit: **Yes** — app communication uses Firebase over TLS.
- Data deletion request mechanism: **Yes** — in-app Settings flow and public deletion page.
- Data shared with third parties: **Yes for advertising-related SDK data.** Google Mobile Ads automatically collects and shares the categories below for advertising, analytics and fraud prevention. With separate consent, minimum structured care facts and a typed Assistant question—or a caregiver-selected appointment or immunisation image/pasted text—are transferred to OpenAI for processing, and optional microphone audio is processed by the configured speech-recognition service. Google Play's current definition excludes a provider acting only on the developer's instructions from “sharing”, but the data is still “collected”; verify the provider terms and final bundle before relying on that exception.
- Data processed ephemerally: **No** for the items stored in Firebase.
- Users can choose whether data is collected: account and core care data are required to use the cloud app; notes, voice input and the AI Assistant are optional. Assistant processing requires separate, revocable consent.

## Data types

| Play category | Collected | Shared | Required | Purpose | Source |
|---|---:|---:|---:|---|---|
| Personal info — Name | Yes | No | Yes for account display name | App functionality; account management | Registration and `users/{uid}` |
| Personal info — Email address | Yes | No | Yes | Authentication; account management; password reset | Firebase Authentication (email/password or Google) and `users/{uid}` |
| Personal info — User IDs | Yes | No | Yes | Authentication; security; app functionality | Firebase UID and ownership fields |
| Health and fitness — Health info | **Yes** | No if OpenAI qualifies for Play's service-provider exception; otherwise Yes | Core event data required; AI processing and notes optional | App functionality | Baby name/DOB and care logs stored in Firebase; minimum sanitised structured care facts or a caregiver-selected appointment or immunisation source sent to OpenAI only after AI consent |
| App info and performance — Crash logs | No dedicated crash SDK | No | N/A | N/A | No Crashlytics/Sentry SDK in release |
| App info and performance — Diagnostics | Yes | Yes for Free-tier ad requests | Automatic for Free tier | Security; app functionality; advertising; fraud prevention | Firebase service operation and Google Mobile Ads SDK |
| Device or other IDs | Yes | Yes for Free-tier ad requests | Automatic for Free tier | Authentication; security; app functionality; advertising; analytics; fraud prevention | Firebase SDK and Google Mobile Ads SDK |
| App activity — App interactions | Yes for Free-tier ad interactions | Yes | Automatic for Free tier | Advertising; analytics; fraud prevention | Google Mobile Ads SDK |
| Location — Approximate location | IP address may be used to estimate it for Free-tier ads | Yes | Automatic for Free tier | Advertising; analytics; fraud prevention | Google Mobile Ads SDK |
| Financial info — Purchase history | Yes for Premium purchasers | Processed with Google Play | Optional | App functionality; account management; fraud prevention | Product ID, token, state and expiry verified by Firebase Functions |
| Photos and videos | **Yes when appointment or immunisation image import is used** | No if OpenAI qualifies for Play's service-provider or user-initiated exception; otherwise Yes | Optional | App functionality | A caregiver-selected appointment or immunisation image is processed for one-time field extraction; it is not attached to the saved record |
| Audio files | **Yes when voice input is used** | No if the recogniser qualifies for Play's service-provider or user-initiated exception; otherwise Yes | Optional | App functionality | In-app voice entry uses microphone audio for speech recognition; PitterPatter does not intentionally retain the raw recording. Alexa audio remains with Amazon |
| App activity — Other user-generated content | **Yes when Assistant is used** | No if OpenAI qualifies for Play's service-provider exception; otherwise Yes | Optional | App functionality; abuse prevention | Typed Assistant question is processed for a single stateless response and is not logged by PitterPatter |
| Contacts | No | No | N/A | N/A | Not requested |
| Location — Precise location | No | No | N/A | N/A | Not requested |

The optional **Add to device calendar** action opens the operating system's calendar event flow with the reviewed appointment fields. PitterPatter does not read existing calendar events or copy calendar contents into Firebase. Recheck the exact packaged permission manifest and Play disclosure requirements before release.

## Important Play Console interpretation

PitterPatter can store caregiver-entered growth, temperature, medicine and other health-related records as well as everyday baby care activity. Declare Health info for the uploaded build even though the app is a convenience log rather than a medical device.

The app stores:

- Caregiver display name and email.
- Baby name or nickname and date of birth.
- Feed type, amount/unit, duration and optional note.
- Sleep start/end and duration.
- Nappy condition and optional note.

## Not otherwise collected by the current source

- Precise location.
- Contacts.
- Payment or credit information.
- Web browsing history.
- SMS or call logs.
- Calendar data.
- Persistent raw voice recordings or AI conversation history. In-app speech recognition produces a draft transcript for confirmation; Alexa sends the PitterPatter service a structured command and relevant slot values, not the raw recording.

## Change-control gate

Repeat this audit whenever any dependency or feature changes. In particular, revise the form before adding:

- Firebase Analytics or Crashlytics.
- Changes to the speech-recognition SDK or its on-device/off-device processing path.
- Changes to the OpenAI model, retention/data-control settings, facts sent, caching or Assistant scope.
- Disabling App Check enforcement or changing the AI consent version.
- Push-notification tokens.
- Photos.
- Shared caregiver invitations.
