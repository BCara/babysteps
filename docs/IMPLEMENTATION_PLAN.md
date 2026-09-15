# PitterPatter Android Implementation Plan

**Status:** Initial Android test release in implementation
**Last updated:** 24 August 2026
**Release target:** Google Play closed test
**Initial test window:** At least 14 continuous days
**Optional integrations:** Voice, Alexa, paired Wear OS and bounded AI are implemented in source and require exact-build verification

## 1. Outcome

The first release is a small, dependable Android app that an adult caregiver can install from Google Play and use to:

1. Create and recover an account.
2. Add a baby profile.
3. Log feeds, sleep and nappies.
4. See a live activity list and seven-day summary.
5. Correct or remove a mistaken log.
6. Delete the account and associated app data.

The release is intended to generate real usage evidence. It is not a medical device and must not be relied on for emergency or clinical decisions. Current source includes optional voice entry, an Alexa development skill, paired-phone Wear OS Quick Care and a bounded, read-only AI Assistant. The Assistant is not an open-ended parenting service: it can describe only the selected baby's logged records and cannot write records or provide medical advice. Monetisation supports an ad-backed Free tier, an ad-free Premium subscription and permanent legacy access.

## 2. Release boundary

### In scope

- Android package `com.cbcreations.babysteps`.
- Expo SDK 54 / Android target API 36.
- Email/password Firebase Authentication.
- Password reset.
- One or more baby profiles per account.
- Active baby selection.
- Bottle or breast feed logs.
- Wet, dirty or both nappy logs.
- Persistent sleep start/stop timer.
- Activity list grouped by day.
- Edit and soft-delete events.
- Daily and seven-day totals.
- In-app support, privacy-policy and account-deletion routes.
- Firebase security rules and automated emulator tests.
- Google Play listing copy, artwork, policy declarations and tester guidance.
- Signed Android App Bundle for Google Play.
- A two-week usage-led test plan.
- Non-personalised anchored banners plus at most one interstitial per 24 hours
  for Free accounts, shown only after a completed log.
- Google Play Premium subscription purchase, restore and management.
- Server-controlled Free, Premium and permanent legacy entitlements.
- Optional in-app speech recognition with review before a care record is saved.
- Optional Alexa development skill and paired-phone Wear OS Quick Care path.
- Consent-gated Assistant tab with read-only questions, Today and Last 7 days summaries, evidence and allowance display.
- Five lifetime successful AI generations for Free accounts and 100 per UTC month for Premium and Founding Premium.
- Firebase App Check enforcement, server-owned AI quota/cache records and an operator kill switch.

### Deferred

- Shared caregiver invitations.
- iOS release.
- Medical diagnosis, symptom assessment, dosage or treatment recommendations.
- General parenting advice or external/web knowledge in the Assistant.
- AI-created, edited or deleted care records.
- Persistent AI chat history or conversational memory.
- Push notifications and home-screen widgets.
- Raw analytics or crash-reporting SDKs.
- Public production launch.

Deferred work must not be included in the production Android bundle unless it is inert and cannot affect the release.

## 3. Product rules

- The app is a convenience record, not medical guidance.
- The smallest useful dataset is preferred.
- A log must remain editable after creation.
- A running sleep is stored in Firestore so it survives app restarts.
- User-facing errors must say what can be done next.
- Signed-out users cannot read or write private data.
- A caregiver can access only babies explicitly associated with their Firebase UID.
- Unsupported event types and forged ownership fields are rejected by Firestore rules.
- Account deletion must be available in the app and explained on a public web page.
- Test feedback is collected without asking testers to disclose unnecessary child information.

## 4. Architecture

Core care screens use Firebase Auth and Firestore directly under security rules. The Assistant adds Firebase Functions in `australia-southeast1`, Play Integrity-backed App Check, server-only Firestore collections and an OpenAI Responses API call whose key is supplied through Secret Manager.

```text
Android app
  ├─ Expo Router screens
  ├─ React providers
  ├─ React Native Firebase Auth
  └─ React Native Firebase Firestore
          │
          ├─ users/{uid}
          └─ babies/{babyId}/events/{eventId}

Firebase project: babysteps-cbert
  ├─ Authentication: email/password
  ├─ Firestore: australia-southeast1
  ├─ Firestore rules and indexes
  └─ Hosting: support, privacy and deletion pages
```

Core care records continue to write directly from the authenticated app to Firestore under strict rules. The Assistant reads records server-side through authenticated, App Check-enforced callables; clients cannot read or write AI consent, quota, cache, request or telemetry collections directly.

## 5. Data model

### `users/{uid}`

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

### `babies/{babyId}`

```ts
{
  info: {
    name: string;
    dateOfBirth: Timestamp;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
  authorizedCaregivers: string[];
}
```

### `babies/{babyId}/events/{eventId}`

```ts
{
  type: 'feed' | 'sleep' | 'diaper';
  startTime: Timestamp;
  endTime: Timestamp | null;
  durationMinutes?: number;
  source: 'app';
  loggedBy: string;
  notes?: string;
  metadata?: {
    feedType?: 'breast' | 'bottle';
    amount?: number;
    unit?: 'ml' | 'oz';
    diaperCondition?: 'wet' | 'dirty' | 'both';
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}
```

## 6. Delivery milestones

### Milestone A — Stable project baseline

Tasks:

- Create a Git baseline and preserve the original prototype.
- Upgrade to Expo SDK 54.
- Remove unimplemented voice, subscription and widget dependencies from the release path.
- Add valid application, adaptive-icon and splash assets.
- Register package `com.cbcreations.babysteps` in Firebase.
- Add the real `google-services.json`.
- Configure Android version `0.1.0`, version code `1`, API 36.
- Make Expo Doctor, TypeScript, Functions and MCP builds pass.

Exit criteria:

- Dependencies install from a clean checkout.
- `npm run doctor` passes.
- `npm run typecheck` passes.
- The Android native project can be generated.

### Milestone B — Functional Firebase app

Tasks:

- Implement auth-state routing and loading state.
- Implement registration, login, password reset and logout.
- Create the user profile after registration.
- Add first-run baby onboarding.
- Subscribe to babies and persist active selection.
- Replace prototype values with live Firestore data.
- Implement feed and nappy forms.
- Implement start/stop sleep with a persisted open event.
- Subscribe to recent events.
- Implement editing and soft deletion.
- Calculate home and seven-day summaries.
- Add clear empty, loading and error states.

Exit criteria:

- A new user can complete onboarding.
- All three event types persist and reappear after restart.
- A running sleep remains visible after restart.
- Activity and summaries reflect the same records.
- An event can be edited and removed.

### Milestone C — Privacy and backend controls

Tasks:

- Enable only email/password authentication.
- Deploy deny-by-default Firestore rules.
- Restrict profiles, babies and events by authenticated UID.
- Validate allowed event types, source and `loggedBy`.
- Keep ownership fields immutable during updates.
- Support account deletion for sole and shared caregivers.
- Add rule tests for allowed and denied operations.
- Host support, privacy and account-deletion pages.
- Link those pages from app Settings.

Exit criteria:

- Rule emulator suite passes.
- Cross-account reads and writes fail.
- Public pages return HTTP 200 over HTTPS.
- In-app account deletion removes the auth account, preserves shared baby profiles for remaining caregivers and deletes baby data when the account is the last caregiver.

### Milestone D — Google Play release package

Tasks:

- Generate store icon and feature graphic.
- Prepare title, short description and full description.
- Prepare app-access, ads, target-audience and content-rating answers.
- Prepare a source-to-console Data safety mapping.
- Prepare privacy-policy and deletion URLs.
- Prepare release notes and tester instructions.
- Configure EAS or local Android signing.
- Produce a signed `.aab`.
- Record the SHA-256 checksum and version details.

Exit criteria:

- Google Play accepts the bundle format and target API.
- Store copy meets field-length limits.
- Required policy URLs are publicly reachable.
- The upload key and recovery details are retained safely outside source control.

### Milestone E — Closed test and iteration

Tasks:

- Complete an internal installation smoke test first.
- Create a Google Group or email list for closed testers.
- Recruit at least 12 testers before starting the qualifying period.
- Keep at least 12 testers opted in continuously for 14 days if the Play account is subject to that production-access rule.
- Execute the README test plan.
- Triage defects by severity.
- Release only changes that are necessary to preserve test continuity or fix material defects.
- Compare reported use with expected core journeys.

Exit criteria:

- No unresolved release-blocking defect.
- No known privacy or cross-account data exposure.
- Core journeys work on the supported device range.
- Tester feedback and defect outcomes are documented.
- Production-access evidence is ready for the Play Console questionnaire.

## 7. Verification strategy

### Automated gates

- Expo configuration: `npm run doctor`.
- TypeScript: `npm run typecheck`.
- Event calculations: `npm test`.
- Firestore rules: `npm run test:emulators`.
- Firebase Functions: `npm --prefix functions run build`.
- MCP prototype isolation: `npm --prefix mcp-server run build`.
- Android release: Gradle bundle task or EAS production build.

### Device gates

- Fresh install.
- Upgrade over the previous test version.
- Small phone and contemporary phone.
- Android light and dark appearance.
- Online, offline and reconnect.
- App background, forced close and restart.
- Authentication expiry and password reset.
- Keyboard and small-screen form usability.
- Account deletion with password reauthentication.

### Release-blocking severity

- **S0 Security/privacy:** data exposed to the wrong account, secrets exposed, deletion falsely confirms, or policy mismatch. Stop release immediately.
- **S1 Core failure:** cannot register, log an event, stop sleep, read the activity list or launch reliably. Fix before distributing.
- **S2 Material usability/data issue:** edit failure, inaccurate summary, poor reconnect, inaccessible control. Fix during test unless a safe workaround exists.
- **S3 Minor:** cosmetic copy, spacing or low-impact inconvenience. Record and prioritise from usage.

## 8. Iteration model

The test is explicitly iterative:

1. Observe normal use and reported friction.
2. Confirm whether the issue is repeatable.
3. Classify it as defect, confusing UX or new feature.
4. Add a regression test where practical.
5. Make the smallest safe change.
6. Repeat automated and device gates.
7. Increase version code.
8. Publish to the closed track with concise release notes.
9. Verify update installation and data continuity.
10. Review whether the change improved the observed problem.

Feature requests do not automatically enter the two-week test. Only security, reliability, data integrity and high-frequency usability improvements should interrupt the test build.

## 9. Release management

- Version name starts at `0.1.0`.
- Version code starts at `1` and must increase for every Play upload.
- Closed-test builds use the production application ID.
- The same package cannot later be renamed without creating a new Play listing.
- Google Play App Signing should be enabled.
- The upload key must never be committed.
- Each release records:
  - Git commit.
  - version name/code.
  - AAB filename and SHA-256.
  - Firebase rules version.
  - test results.
  - known limitations.

## 10. Known initial limitations

- The private test is designed primarily for one caregiver per baby.
- Shared-caregiver invitations are not available.
- Account deletion automatically removes the departing account from shared profiles and preserves their records for remaining caregivers; last-caregiver profiles and records are deleted.
- Event deletion is soft deletion during ordinary app use.
- No offline-first conflict-resolution promise is made.
- Deterministic and AI summaries are informational and are not clinical calculations.
- Voice entry is optional, depends on the configured recognition provider and always requires confirmation before save.
- AI questions are stateless, limited to a 30-day record window and unavailable offline or while the operator kill switch is active.

## 11. Definition of the initial test release

The build is ready for the Google Play closed test when:

- A signed API-36 Android App Bundle exists.
- Package and signing identity are stable.
- The app installs and launches on a real Android environment.
- Registration, reset, login and logout work against production Firebase.
- Baby onboarding and selection work.
- Feed, nappy and sleep records persist.
- Sleep survives restart.
- Activity, edit, deletion and summaries work.
- Account deletion is verified.
- Security tests and static checks pass.
- Store assets and console answers are complete.
- Privacy and deletion URLs are live.
- The OpenAI secret is stored only in Secret Manager; the API key is absent from the Android bundle.
- Play Integrity-backed App Check is registered for the exact Play-signed build, with debug access confined to development builds.
- AI consent, quota, caching, safety redirects, failure refunds, access controls and account-deletion cleanup pass their tests.
- The privacy policy and Play Data Safety declarations describe the actual AI and voice paths in the exact AAB.
- AI remains unadvertised publicly until the closed-test evidence, privacy copy, App Check configuration and Play declarations match that AAB.
- README contains the repeatable two-week test programme.
- Remaining Play Console actions are administrative rather than missing implementation.
