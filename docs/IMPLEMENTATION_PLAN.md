# BabySteps Implementation Plan

**Status:** Proposed  
**Last updated:** 28 July 2026  
**Primary first release:** Functional mobile app plus Alexa integration  
**First test bench:** A real phone, a real Alexa device, and the Firebase `babysteps-prototype` project

## 1. Purpose

This document is the implementation plan for turning the existing BabySteps prototype into a functional baby-care logging application whose first voice interface is Alexa.

The first release is not intended to complete every feature currently suggested by the source tree. Its purpose is to establish one reliable end-to-end loop:

1. A caregiver creates an account and a baby profile in the app.
2. The caregiver can manually log and review events in the app.
3. The caregiver links an Alexa identity to the same BabySteps account.
4. Alexa can log feeds, sleep and diapers for the selected baby.
5. Alexa-created events appear immediately in the app.
6. Mistakes can be corrected or undone from the app or by voice.
7. Real usage produces enough privacy-safe evidence to improve commands and interaction design.

Phone voice recording, Google Assistant, subscriptions, widgets and broad analytics are later releases. They must not delay the functional app and Alexa test bench.

## 2. Product outcome

The Phase 1 product should support this journey:

> Create an account → add a baby → manually log a wet diaper → see it in the timeline → link Alexa → say “Alexa, ask BabySteps to log a wet diaper” → hear a confirmation → see the event appear in the app → correct or undo it.

Phase 1 is complete only when this works repeatedly with a real Firebase project, a real installed app and a real Alexa-enabled device. A successful TypeScript build or Alexa simulator response alone is not sufficient.

## 3. Scope

### 3.1 Phase 1 in scope

- Android or iOS development build running on at least one real phone.
- Email/password Firebase authentication.
- Caregiver account profile.
- Create, edit and select a baby.
- One or more authorized caregivers in the data model.
- Manual logging for:
  - Feed
  - Sleep start and stop
  - Diaper: wet, dirty or both
- Real-time event timeline.
- Current-day summary based on real data.
- Correction and undo.
- Persistent active sleep timer.
- Shared backend command service used by the app and Alexa.
- Alexa development skill.
- Secure private-test account linking.
- Alexa feed, sleep, diaper and undo commands.
- Spoken confirmations and actionable errors.
- Privacy-safe operational and product telemetry.
- Emulator, automated and real-device verification.

### 3.2 Explicitly deferred

- In-app free-form voice transcription.
- Google Assistant App Actions.
- Siri/App Intents.
- Gemini or other open-ended AI interpretation.
- Android home-screen widget.
- RevenueCat subscriptions.
- Charts beyond a basic daily summary.
- Photos, milestones, pumping and medication.
- Public Alexa certification.
- Production OAuth account linking, unless required earlier for the chosen Alexa testing configuration.
- Broad multi-language support.

Deferred features should remain isolated so they do not break the Phase 1 build.

## 4. Current repository assessment

The existing project provides a useful prototype but is not yet a functional application.

### 4.1 Existing foundations

- Expo Router app structure.
- React Native Paper themes and basic screens.
- Zustand app state.
- Firebase Auth and Firestore service stubs.
- Firestore baby and event data structures.
- Quick-log UI.
- Local active timers.
- Alexa feed, sleep and diaper intent handlers.
- Firebase Functions HTTPS endpoint.
- MCP server prototype.
- Voice recorder prototype.

### 4.2 Current blockers

- The project directory is not currently a Git repository.
- The root route hard-codes the user as unauthenticated.
- Login and registration fields do not call Firebase.
- The app links directly into authenticated screens.
- No functional baby onboarding or selection exists.
- The home screen uses the hard-coded baby name `Leo`.
- Daily summary values are hard-coded.
- Manual logs are written only to the console.
- Timeline and Stats are static placeholders.
- Timers exist only in memory and are lost when the app restarts.
- RevenueCat and Android widget modules are referenced but not installed.
- Expo icon and splash assets referenced by `app.json` are missing.
- The root TypeScript build fails.
- The Alexa error handler is registered as a request handler.
- Alexa uses the hard-coded user ID `demo-user-id`.
- Alexa account linking is not implemented.
- Firestore security rules and emulator tests are not present.
- There is no automated test suite or release checklist.

## 5. Implementation principles

### 5.1 One event service

The app and Alexa must not implement separate write logic. Both should call one authenticated backend command service.

```text
Manual app action ─┐
                   ├─> Event command service ─> Firestore
Alexa intent ──────┘
```

Future phone voice and Google Assistant integrations will call the same service.

### 5.2 Create a draft before committing uncertain data

Voice input should first become an `EventDraft`. The draft is validated before an event is written.

- High-confidence, reversible commands may save immediately and offer Undo.
- Missing baby, ambiguous timer or invalid quantity should trigger a question.
- Medication, when introduced, must always require confirmation.

### 5.3 The app is the source of truth

Alexa is the first voice input channel, but the app remains the place to:

- Configure the account and babies.
- Choose the active baby.
- Link integrations.
- See whether a command was recorded correctly.
- Correct or delete data.
- Resolve ambiguous active timers.

### 5.4 Real usage drives vocabulary

Phase 1 should support a small, explicit command set. New phrases are added only after:

1. A real failure or unmet need is observed.
2. The desired interpretation is agreed.
3. A regression test is added.
4. The change is released behind a controlled version.

### 5.5 Sensitive data stays minimal

- Do not retain raw voice recordings.
- Do not send baby names, notes or transcripts to general analytics.
- Store only operational outcomes such as intent type, success, correction, latency and error code.
- Any transcript collection for improving the product must be explicit opt-in.

## 6. Target architecture

### 6.1 Components

| Component | Responsibility |
|---|---|
| Expo mobile app | Authentication, baby setup, manual logging, live timeline, corrections and Alexa linking |
| Firebase Authentication | Caregiver identity |
| Cloud Firestore | Users, babies, event records, integration links and command receipts |
| Firebase Functions | Authorized event commands, Alexa endpoint, account-link flow and telemetry |
| Alexa custom skill | Speech recognition, intents, slots, follow-up questions and spoken responses |
| Firebase Emulator Suite | Local Auth, Functions and Firestore integration testing |

### 6.2 Event command flow

1. The source sends an authenticated command.
2. The command service verifies the caregiver or linked Alexa identity.
3. It resolves the baby.
4. It validates the requested operation.
5. It checks the request ID for duplicates.
6. It applies the event operation in a Firestore transaction.
7. It records a command receipt.
8. It returns a structured result.
9. The client or Alexa converts the result into visual or spoken feedback.

### 6.3 Command envelope

Every command should use a common shape:

```ts
type EventCommand = {
  requestId: string;
  actorId: string;
  babyId?: string;
  source: 'app_manual' | 'alexa';
  operation:
    | 'create_event'
    | 'start_timer'
    | 'stop_timer'
    | 'update_event'
    | 'undo_last';
  eventType?: 'feed' | 'sleep' | 'diaper';
  occurredAt?: string;
  payload?: Record<string, unknown>;
  schemaVersion: 1;
};
```

The backend must generate authoritative `createdAt` and `updatedAt` timestamps. Client-provided event times may be accepted only after validation.

## 7. Proposed Firestore model

### 7.1 Users

`users/{uid}`

```ts
{
  displayName: string;
  email: string;
  babyIds: string[];
  activeBabyId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 7.2 Babies

`babies/{babyId}`

```ts
{
  info: {
    name: string;
    dateOfBirth: Timestamp;
    gender?: string;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
  authorizedCaregivers: string[];
}
```

An array is acceptable for the private test bench. Before a larger beta, reassess whether caregiver membership should move to a subcollection to support roles, invitations and scalable security checks.

### 7.3 Events

`babies/{babyId}/events/{eventId}`

```ts
{
  type: 'feed' | 'sleep' | 'diaper';
  startTime: Timestamp;
  endTime: Timestamp | null;
  durationMinutes?: number;
  source: 'app_manual' | 'alexa';
  loggedBy: string;
  notes?: string;
  metadata?: {
    feedType?: 'breast' | 'bottle' | 'formula' | 'unknown';
    amount?: number;
    unit?: 'ml' | 'oz';
    side?: 'left' | 'right' | 'both';
    diaperCondition?: 'wet' | 'dirty' | 'both';
  };
  requestId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  correctedAt?: Timestamp;
  deletedAt?: Timestamp;
}
```

Use soft deletion during the private beta so accidental removal can be recovered and investigated. Normal timeline queries should exclude records with `deletedAt`.

### 7.4 Alexa links

`alexaLinks/{hashedAlexaUserId}`

```ts
{
  uid: string;
  activeBabyId: string | null;
  status: 'active' | 'revoked';
  linkedAt: Timestamp;
  lastUsedAt: Timestamp;
  linkVersion: 1;
}
```

Do not use the raw Alexa user ID as a readable document ID. Store a deterministic hash and retain the minimum identity information required.

### 7.5 Temporary linking requests

`alexaLinkRequests/{hashedCode}`

```ts
{
  alexaUserIdHash: string;
  expiresAt: Timestamp;
  usedAt: Timestamp | null;
  createdAt: Timestamp;
}
```

Link codes must be single-use, short-lived and rate-limited.

### 7.6 Command receipts

`commandReceipts/{requestId}`

```ts
{
  actorId: string;
  source: 'app_manual' | 'alexa';
  operation: string;
  eventId?: string;
  status: 'completed' | 'rejected';
  errorCode?: string;
  createdAt: Timestamp;
}
```

This collection prevents duplicate Alexa requests or repeated app taps from creating duplicate events.

## 8. Work breakdown

## Milestone 0 — Establish a safe development baseline

### Objective

Create a repeatable, version-controlled project that builds and can use Firebase emulators.

### Tasks

- Confirm whether the project belongs inside a parent Git repository.
- If it does not, initialize a repository and create a baseline commit before feature changes.
- Add a project-level `.gitignore`.
- Confirm the intended Phase 1 phone platform.
- Keep the app architecture cross-platform, but choose one real device as the release gate.
- Add the missing Expo assets or update `app.json` to valid assets.
- Decide whether RevenueCat and the Android widget are:
  - Removed from Phase 1 source; or
  - Feature-isolated with their packages installed.
- Fix all TypeScript errors.
- Add scripts:
  - `typecheck`
  - `test`
  - `test:emulators`
  - `functions:build`
- Create environment documentation for:
  - Firebase project selection.
  - Native Firebase configuration files.
  - Emulator ports.
  - Alexa development skill configuration.
- Add Firebase native configuration without committing secrets.
- Confirm whether an Expo development build is required and create one for the test device.
- Add Firestore rules and indexes to `firebase.json`.
- Add a minimal CI-equivalent local verification command.

### Alexa build correction

The Alexa `ErrorHandler` must be registered with `addErrorHandlers`, not included in `addRequestHandlers`. Request, error, fallback and session handlers should have explicit types.

### Exit criteria

- Root app typecheck passes.
- Firebase Functions build passes.
- MCP build either passes or is excluded from the Phase 1 verification command.
- App launches on the selected real phone.
- Firebase Auth, Functions and Firestore emulators start successfully.
- No placeholder asset causes an Expo build failure.
- No unrelated deferred feature can break the Phase 1 build.

## Milestone 1 — Functional Firebase-backed app

### Objective

Make the app useful without Alexa before adding voice writes.

### 1.1 Authentication

- Replace the hard-coded auth state in `app/index.tsx`.
- Subscribe to Firebase authentication state at the root.
- Add an initial loading state to prevent incorrect redirects.
- Connect login fields to email/password sign-in.
- Connect registration fields to account creation.
- Create the user profile document after registration.
- Replace navigation-only logout with Firebase sign-out.
- Add user-facing messages for invalid credentials, offline failure and account creation errors.
- Prevent authenticated routes from being used without a signed-in user.

### 1.2 Baby onboarding and selection

- Add a first-run baby creation screen.
- Capture:
  - Name.
  - Date of birth.
  - Optional gender.
- Create the baby document and add the caregiver.
- Save `activeBabyId` on the user profile.
- Replace hard-coded `Leo` with the selected baby.
- Add a baby selector when more than one baby exists.
- Handle:
  - No babies.
  - Baby removed or access revoked.
  - Selected baby no longer available.

### 1.3 Manual event logging

- Replace console logging with calls to the shared command service.
- Phase 1 manual forms:
  - Feed: type, amount/unit or duration, optional notes.
  - Sleep: start and stop.
  - Diaper: wet, dirty or both, optional notes.
- Validate values before sending.
- Disable Save while a command is in flight.
- Generate a unique request ID for each deliberate action.
- Show success, retryable failure and permanent failure states.

### 1.4 Persistent sleep timer

- Represent an active sleep timer as a Firestore sleep event with `endTime: null`.
- Query active sleep events on app launch.
- Calculate elapsed time from the server-backed start time.
- Stop the event transactionally.
- Prevent two active sleep timers for the same baby unless product testing proves this is required.
- Resolve conflicting active timers with an explicit app warning.

### 1.5 Timeline and editing

- Subscribe to recent events for the selected baby.
- Render real `EventCard` components.
- Group events by date.
- Show event source where useful during beta testing.
- Add edit support.
- Add soft delete with a confirmation step.
- Add Undo after create, stop and delete actions.
- Make loading, empty and error states distinct.

### 1.6 Daily summary

- Replace hard-coded values with a calculation from the selected day’s events.
- Display:
  - Feed count.
  - Diaper count.
  - Completed sleep duration.
  - Ongoing sleep separately.
- Define the day boundary using the caregiver’s configured timezone.

### Exit criteria

- New caregiver can register and sign in again after app restart.
- Caregiver can create and select a baby.
- Manual feed, sleep and diaper events persist.
- Active sleep survives an app restart.
- Timeline updates in real time.
- Daily summary matches stored events.
- Event can be corrected and soft-deleted.
- One caregiver cannot access another caregiver’s baby or events.

## Milestone 2 — Shared event command service

### Objective

Move event validation and mutation into a backend service that both the app and Alexa use.

### 2.1 Domain module

Create a Functions-side domain module with no Alexa-specific speech logic:

- `resolveAuthorizedBaby`
- `createFeed`
- `startSleep`
- `stopSleep`
- `createDiaper`
- `updateEvent`
- `softDeleteEvent`
- `undoLastCommand`
- `executeEventCommand`

### 2.2 Validation rules

- Actor must exist and be authorized for the baby.
- Baby must be active.
- Event type must be supported.
- Event times cannot be unreasonably far in the future.
- Feed amount and duration must be within configured bounds.
- Diaper condition must be one of the allowed values.
- Sleep stop requires an active sleep event.
- Each request ID may commit at most once.
- Undo must be limited to the actor’s recent reversible action.
- Backend timestamps are authoritative for `createdAt` and `updatedAt`.

Initial validation bounds should be conservative and configurable. They are data-quality checks, not medical advice.

### 2.3 App callable endpoint

- Add an authenticated Firebase callable function for app commands.
- Verify Firebase Auth context.
- Add App Check before expanding beyond the private test bench.
- Return stable result and error codes.
- Map backend errors to understandable app messages.

### 2.4 Alexa internal adapter

- Add a server-side adapter that converts Alexa intent slots into `EventCommand`.
- Do not let Alexa handlers write to Firestore directly.
- Use the Alexa request ID as the idempotency request ID.
- Keep spoken response generation outside the domain module.

### 2.5 Error contract

Use stable codes such as:

- `AUTH_REQUIRED`
- `ACCOUNT_NOT_LINKED`
- `BABY_REQUIRED`
- `BABY_NOT_FOUND`
- `NOT_AUTHORIZED`
- `INVALID_EVENT`
- `NO_ACTIVE_SLEEP`
- `SLEEP_ALREADY_ACTIVE`
- `DUPLICATE_REQUEST`
- `TEMPORARY_FAILURE`

### Exit criteria

- Manual app writes go through the command service.
- Alexa development tests use the same command service.
- Replaying a request ID does not duplicate an event.
- Unauthorized commands are rejected.
- Unit tests cover each command and validation branch.

## Milestone 3 — Alexa private test-bench integration

### Objective

Allow a real Alexa device to write reliable events for the caregiver’s selected baby.

### 3.1 Development skill configuration

- Create or confirm an Alexa custom skill named BabySteps.
- Configure an invocation name that Alexa recognises reliably.
- Point the skill to the Firebase HTTPS endpoint.
- Configure locale `en-AU` first if supported by the target account and device.
- Create a development interaction model.
- Add built-in Help, Cancel, Stop, Fallback and Session End handling.

### 3.2 Initial intent model

#### LogFeedIntent

Supported examples:

- “Log a feed.”
- “Log a bottle.”
- “Log a 120 millilitre bottle.”
- “Log a 15 minute feed.”

Initial slots:

- Baby name, optional.
- Feed type, optional.
- Amount, optional.
- Unit, optional.
- Duration, optional.
- Time, optional and deferred if recognition is unreliable.

#### StartSleepIntent

Supported examples:

- “Start sleep.”
- “Leo went to sleep.”
- “Start a nap for Leo.”

#### StopSleepIntent

Supported examples:

- “Leo woke up.”
- “Stop sleep.”
- “End the nap.”

#### LogDiaperIntent

Supported examples:

- “Log a wet diaper.”
- “Log a dirty nappy.”
- “Log a wet and dirty nappy.”

Include Australian vocabulary such as “nappy”.

#### UndoLastIntent

Supported examples:

- “Undo that.”
- “Remove the last log.”
- “That was wrong.”

### 3.3 Private-test account linking

For the initial private test bench, implement a one-time code flow:

1. An unlinked Alexa request creates a short-lived link code associated with the verified Alexa user ID.
2. Alexa tells the user to open BabySteps and enter the code.
3. The signed-in app submits the code to an authenticated callable function.
4. The function creates the Alexa-to-Firebase link.
5. The code is invalidated immediately.
6. Alexa commands then resolve to the linked Firebase UID.

Security requirements:

- Verify Alexa request signature and timestamp before trusting identity.
- Hash Alexa identity and link codes in Firestore.
- Six-digit codes expire quickly.
- Codes are single-use.
- Limit code generation and redemption attempts.
- Allow unlinking from the app.
- Revoke the link if the user account is deleted.

This private linking mechanism is a test-bench feature. Before public Alexa release, replace or supplement it with Amazon-supported OAuth 2.0 Authorization Code Grant account linking.

### 3.4 Baby resolution

- If the linked account has one baby, use it by default.
- If `activeBabyId` is configured, use it.
- If the command names a baby, resolve only among authorized babies.
- If multiple babies remain ambiguous, Alexa must ask which baby.
- Never silently choose a baby when the choice is uncertain.
- Add an Alexa integration setting in the app for the default baby.

### 3.5 Spoken responses

Confirm what was actually committed:

- “Logged a wet nappy for Leo.”
- “Started Leo’s sleep timer.”
- “Leo slept for 42 minutes.”
- “Logged a 120 millilitre bottle for Leo.”

Errors should provide the next action:

- “I could not find an active sleep for Leo.”
- “I found more than one baby. Which baby is this for?”
- “Your BabySteps account is not linked. Open the BabySteps app and enter code 123456.”

Avoid long conversational prompts during night-time use.

### 3.6 Endpoint hardening

- Verify Alexa signatures and request timestamps.
- Reject unsupported application IDs.
- Validate request JSON.
- Redact access tokens and personal content from logs.
- Use structured logging with request ID, intent, result and latency.
- Add rate limiting where practical.
- Target a fast response so Alexa does not time out.
- Return a safe generic response for unexpected failures.

### Exit criteria

- Account can be linked without editing source code or Firestore manually.
- Real Alexa device logs feed, sleep and diaper events.
- Alexa-created events appear in the app in real time.
- Start/stop sleep works across separate Alexa sessions.
- Repeated delivery of the same Alexa request does not duplicate an event.
- Ambiguous baby selection does not write an event.
- Undo removes or reverses the correct recent event.
- Alexa link can be revoked from the app.

## Milestone 4 — Security rules, testing and release verification

### Objective

Prove that Phase 1 is safe and repeatable before relying on it for everyday logging.

### 4.1 Firestore rules

- Signed-out clients cannot read or write private data.
- Caregivers can read only babies for which they are authorized.
- Caregivers can read only events belonging to authorized babies.
- Event writes are performed through Functions, not arbitrary client writes.
- Clients cannot add themselves as caregivers.
- Alexa links and command receipts are inaccessible to ordinary clients.
- Emulator rule tests cover allowed and denied paths.

### 4.2 Unit tests

- Event validation.
- Feed metadata parsing.
- Sleep start/stop state transitions.
- Diaper condition mapping.
- Idempotency.
- Undo selection.
- Baby authorization.
- Alexa slot-to-command mapping.
- Spoken response mapping.
- Link code expiry and single use.

### 4.3 Integration tests

- Register user and create baby using emulators.
- Execute app command and verify Firestore.
- Execute Alexa intent fixture and verify the same Firestore shape.
- Subscribe to timeline and verify real-time update.
- Replay command and verify no duplicate.
- Attempt cross-user access and verify rejection.

### 4.4 Alexa regression corpus

Maintain a version-controlled fixture containing:

- Spoken phrase.
- Expected intent.
- Expected slots.
- Expected event command.
- Expected spoken confirmation or question.

Every reported misunderstanding must become a test case before the interaction model or adapter changes.

### 4.5 Real-device matrix

At minimum:

- Selected development phone.
- One real Alexa device.
- Quiet room.
- Background television or household noise.
- Australian pronunciation and “nappy” terminology.
- Phone app foreground and restarted.
- Alexa and phone on different networks, if practical.
- One baby and multiple-baby accounts.

### 4.6 Phase 1 release checklist

- Typecheck passes.
- Unit and emulator tests pass.
- Functions build succeeds.
- App development build installs cleanly.
- Firebase project and region are confirmed.
- Firestore rules are deployed.
- Functions are deployed.
- Alexa endpoint points to the deployed function.
- Real-device linking succeeds.
- End-to-end acceptance journey passes three consecutive times.
- Known limitations are recorded.
- Rollback path is documented.

## Milestone 5 — Private usage and iteration

### Objective

Use the functional app and Alexa test bench to discover the command vocabulary and failure modes that matter in real caregiving situations.

### 5.1 Initial cohort

- Begin with the owner and one household.
- Expand to a small number of trusted caregivers only after the core loop is stable.
- Ensure testers understand that the product is a prototype and should not be relied on for urgent medical decisions.

### 5.2 Privacy-safe telemetry

Record:

- Source: app or Alexa.
- Intent or operation type.
- Success or stable error code.
- Whether clarification was required.
- Whether the event was edited or undone.
- End-to-end latency.
- Parser or interaction-model version.

Do not record in general analytics:

- Baby name.
- Caregiver name or email.
- Raw voice.
- Free-text notes.
- Full transcript.
- Feed amount or medical information unless specifically required for an opted-in diagnostic workflow.

### 5.3 Success metrics

Initial targets for the supported command set:

- At least 90% of attempted supported Alexa commands produce the intended event or an appropriate clarification.
- Fewer than 2% create an unintended event that requires deletion.
- No duplicate events from request retries.
- Median successful command response feels immediate during real use.
- At least 95% of Alexa-created events appear in the app without manual refresh.
- All incorrect events can be corrected or undone.

Targets are starting points. They should be revised from real baseline data rather than used to hide important qualitative failures.

### 5.4 Weekly iteration loop

1. Review success, clarification, correction, undo and error rates.
2. Review tester-reported failed phrases.
3. Classify each failure:
   - Alexa recognition.
   - Intent classification.
   - Slot resolution.
   - Baby resolution.
   - Backend validation.
   - Firestore or network failure.
   - Poor spoken confirmation.
4. Add a regression fixture.
5. Make the smallest relevant change.
6. Test locally and in the Alexa simulator.
7. Test on the real device.
8. Release the interaction-model or function change.
9. Compare results by version.

### 5.5 Feedback mechanism

The app should show Alexa-created events with:

- Source indicator during beta.
- “Correct this” action.
- “Delete” or Undo action.
- Optional “Alexa misunderstood me” feedback.

Feedback should reference the command receipt rather than requiring the user to re-enter sensitive content.

## 9. Later releases

## Phase 2 — In-app phone voice

Start only after Alexa proves the event model and common language.

- One-tap start/stop recording.
- Speech-to-text provider behind an interface.
- Text command parser producing the same `EventCommand`.
- Structured confirmation card.
- Audible confirmation.
- Offline and retry behaviour.
- No raw audio retention by default.
- Regression corpus seeded from Alexa usage.

## Phase 3 — Google Assistant

- Implement Android App Actions or the then-current supported Android voice-action mechanism.
- Use deep links or authenticated app actions to create an event draft.
- Reuse the shared command service.
- Validate supported phrases on a real Android phone.
- Keep platform-specific invocation language out of the event domain.

## Phase 4 — Production Alexa account linking and publication

- Implement OAuth 2.0 Authorization Code Grant with PKCE.
- Add consent, token refresh, revocation and account deletion.
- Complete Alexa privacy and certification requirements.
- Add production monitoring and support procedures.
- Validate multiple Alexa profiles and shared household devices.
- Complete public skill certification.

## Phase 5 — Broader product features

- Multiple caregiver invitations and roles.
- Pumping, tummy time, baths, medication and milestones.
- Rich statistics.
- Notifications.
- Widgets and shortcuts.
- Subscription model.
- Additional languages.

Each new event type must define validation, correction, voice phrasing, confirmation and privacy requirements before implementation.

## 10. Delivery sequence and dependencies

| Order | Deliverable | Depends on |
|---|---|---|
| 1 | Stable build and version-control baseline | None |
| 2 | Firebase Auth and baby onboarding | Stable app build |
| 3 | Shared event command service | Firebase project and data model |
| 4 | Manual logging and live timeline | Auth, baby selection and command service |
| 5 | Persistent sleep and corrections | Timeline and command transactions |
| 6 | Alexa handler refactor | Functions build and command service |
| 7 | Private Alexa linking | App authentication and verified Alexa endpoint |
| 8 | Real-device Alexa commands | Linking, baby resolution and intents |
| 9 | Security and end-to-end release gate | All Phase 1 functionality |
| 10 | Usage-driven iteration | Private test-bench release |

Do not begin Google Assistant, RevenueCat or widget work while any Phase 1 acceptance gate is failing.

## 11. Indicative effort

These are planning ranges for one experienced developer and exclude waiting for external certification:

| Milestone | Indicative effort |
|---|---:|
| Stable baseline | 2–4 working days |
| Functional Firebase app | 5–10 working days |
| Shared command service | 3–6 working days |
| Alexa private integration | 5–10 working days |
| Security and automated verification | 4–7 working days |
| Initial private usage period | At least 2 weeks of normal household use |

The largest uncertainty is account linking and real-device Alexa behaviour. The plan deliberately puts a private code-linking flow before production OAuth so useful testing can begin earlier without retaining the hard-coded demo identity.

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Alexa recognises the wrong phrase | Incorrect care record | Limited intents, clear confirmation, immediate Undo and regression corpus |
| Wrong baby selected | High data-integrity impact | Explicit active baby, clarification for ambiguity and no silent guessing |
| Duplicate Alexa delivery | Duplicate event | Request-ID idempotency and command receipts |
| Timer lost on restart | Incorrect sleep duration | Persist open sleep event in Firestore |
| Shared Alexa household identity | Wrong caregiver attribution | Link management, profile testing and clear source/actor records |
| Firebase rules expose data | Privacy breach | Deny-by-default rules and emulator tests |
| Analytics collect sensitive content | Privacy breach | Outcome-only telemetry and transcript opt-in |
| Prototype modules break builds | Delays core release | Remove or isolate deferred RevenueCat, widget, MCP and voice modules |
| Free-form AI creates plausible but wrong records | Data-integrity risk | Do not use open-ended AI in Phase 1 |
| Network failure during voice logging | Missing event | Clear failure response, safe retry and idempotent command |
| Alexa account-link implementation becomes large | Delayed test bench | Private one-time code link first; OAuth before public release |

## 13. Decisions required before implementation

These decisions should be made during Milestone 0:

1. Which phone platform and physical device is the first release gate?
2. Does this folder need a new Git repository, or is it intended to belong to a parent repository?
3. Should the MCP server remain in the Phase 1 build, or be isolated as experimental?
4. Which Firebase region should host the Functions close to the primary users?
5. Is email/password sufficient for the first private users?
6. Is a six-digit in-app Alexa linking code acceptable for the private test bench?
7. Should the first feed command support amounts, durations or both?
8. Is soft deletion acceptable for the private beta retention policy?
9. Which Alexa device and Amazon locale/account will be used for real testing?

None of these decisions changes the core architecture. They determine the first implementation slice and test configuration.

## 14. Definition of Phase 1 done

Phase 1 is done only when all of the following are true:

- The app builds and runs on the chosen real phone.
- A caregiver can register, sign in, sign out and return later.
- A caregiver can create and select a baby.
- Manual feed, sleep and diaper logs persist in Firebase.
- Active sleep survives app restart.
- Timeline and daily summary use real data.
- Events can be corrected and undone.
- Alexa can be linked without hard-coded IDs.
- Alexa can log feed, sleep and diaper events for the correct baby.
- Alexa can undo the most recent eligible command.
- Alexa events appear in the app in real time.
- Duplicate requests do not create duplicate events.
- Ambiguous baby selection never silently writes an event.
- Security rules prevent cross-account access.
- Automated tests cover domain logic, rules and primary integration flows.
- The complete acceptance journey passes on a real Alexa device.
- Operational telemetry can distinguish recognition, linking, validation and backend failures without storing sensitive speech content.
- A repeatable usage-review process is active.

Only after this definition is met should phone voice and Google Assistant move into active implementation.

