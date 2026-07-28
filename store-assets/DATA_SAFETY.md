# Google Play Data Safety Mapping

This is the implementation-source mapping for the Play Console form. Re-read the current Play definitions before submission and answer from the released bundle, including every SDK. Do not copy an answer blindly if analytics, crash reporting, advertising, payments or another SDK is added.

## Security and handling

- Data encrypted in transit: **Yes** — app communication uses Firebase over TLS.
- Data deletion request mechanism: **Yes** — in-app Settings flow and public deletion page.
- Data shared with third parties: **No for independent third-party purposes.** Google Firebase acts as a service provider/data processor. Confirm the current Play definition of “shared” when completing the form.
- Data processed ephemerally: **No** for the items stored in Firebase.
- Users can choose whether data is collected: account and core care data are required to use the cloud app; notes are optional.

## Data types

| Play category | Collected | Shared | Required | Purpose | Source |
|---|---:|---:|---:|---|---|
| Personal info — Name | Yes | No | Yes for account display name | App functionality; account management | Registration and `users/{uid}` |
| Personal info — Email address | Yes | No | Yes | Authentication; account management; password reset | Firebase Authentication and `users/{uid}` |
| Personal info — User IDs | Yes | No | Yes | Authentication; security; app functionality | Firebase UID and ownership fields |
| Health and fitness — Health info | Treat as **Yes** conservatively | No | Core event data required; notes optional | App functionality | Baby name/DOB and feed, sleep, nappy logs |
| App info and performance — Crash logs | No app SDK currently | No | N/A | N/A | No Crashlytics/Sentry SDK in release |
| App info and performance — Diagnostics | Firebase may process operational diagnostics | No independent sharing | Service operation | Security; app functionality | Firebase service operation |
| Device or other IDs | Firebase may process identifiers | No independent sharing | Service operation | Authentication; security; app functionality | Firebase SDK |
| App activity | No analytics SDK currently | No | N/A | N/A | No Analytics SDK in release |
| Photos and videos | No | No | N/A | N/A | Not implemented |
| Audio files | No | No | N/A | N/A | Voice deferred |
| Contacts | No | No | N/A | N/A | Not requested |
| Location | No | No | N/A | N/A | Not requested |
| Financial info | No | No | N/A | N/A | No payments |

## Important Play Console interpretation

Baby care records may fit Play’s broad “Health info” definition even though BabySteps is not a medical app. Select the conservative applicable category if the current console wording includes care activity, sleep or feeding information.

The app stores:

- Caregiver display name and email.
- Baby name or nickname and date of birth.
- Feed type, amount/unit, duration and optional note.
- Sleep start/end and duration.
- Nappy condition and optional note.

## Not collected by the current release

- Advertising identifiers.
- Precise or approximate location.
- Contacts.
- Photos, videos or audio.
- Payment or credit information.
- Web browsing history.
- SMS or call logs.
- Calendar data.
- Raw voice or transcripts.

## Change-control gate

Repeat this audit whenever any dependency or feature changes. In particular, revise the form before adding:

- Firebase Analytics or Crashlytics.
- Voice capture or speech-to-text.
- Advertising.
- Subscriptions or payments.
- Push-notification tokens.
- Photos.
- Shared caregiver invitations.
