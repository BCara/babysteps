# BabySteps

BabySteps is an Android baby-care log for adult caregivers. The first private release records feeds, sleep and nappies in Firebase and shows a live timeline and simple summaries.

This repository is intentionally Android-first. Alexa, Google Assistant and in-app voice are not part of the initial Google Play test.

## Release status

- App name: BabySteps
- Android package: `com.babysteps.app`
- App version: `0.1.0`
- Android version code: `1`
- Target API: 36
- Firebase project: `babysteps-cbert`
- Firestore location: `australia-southeast1`
- Planned Play track: closed testing
- Privacy policy: <https://babysteps-cbert.web.app/privacy.html>
- Account deletion: <https://babysteps-cbert.web.app/delete-account.html>
- Support: <https://babysteps-cbert.web.app/>

The detailed product and engineering plan is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Play Console copy and declarations are in [store-assets](store-assets).

## Current functionality

- Email/password registration and login.
- Password-reset email.
- First-run baby setup.
- Multiple baby profiles and active selection.
- Bottle and breast feed logs.
- Wet, dirty and combined nappy logs.
- Persistent sleep start/stop.
- Live recent timeline.
- Edit and remove logs.
- Daily and seven-day summaries.
- In-app privacy, support and deletion links.
- Password-confirmed sole-caregiver account deletion.
- Firebase rules that restrict data to authorised accounts.
- Light and dark theme support.

BabySteps is a convenience log, not a medical device. It provides no diagnosis, medical guidance, monitoring guarantee or emergency service.

## Prerequisites

- Node.js 20 or newer.
- npm.
- Java 17 or newer; Android Studio’s bundled JBR is suitable.
- Android SDK with API 36 and recent Build Tools.
- Firebase CLI.
- Expo/EAS CLI through `npx`.
- Access to the Firebase project for deployment.
- Access to the `cbert89` Expo account for EAS builds.

## Install and run

```powershell
npm install
npm run doctor
npm run typecheck
npm test
npm run test:emulators
```

Start Metro:

```powershell
npm start
```

Generate the native Android project:

```powershell
npm run prebuild:android
```

The app uses React Native Firebase and therefore requires a development build or native Android build; Expo Go is not sufficient.

## Firebase configuration

The checked-in `google-services.json` contains Firebase Android client configuration, not a server credential. Never add service-account JSON, upload keystores, passwords or access tokens to the repository.

Deploy backend configuration:

```powershell
firebase deploy --only auth,firestore --project babysteps-cbert
firebase deploy --only hosting --project babysteps-cbert
```

Run Firestore rules tests:

```powershell
npm run test:emulators
```

The local rules suite verifies own-profile access, cross-profile denial, authorised baby access, unsupported event rejection, forged caregiver rejection, immutable ownership and sole-caregiver deletion.

## Release verification

Run every automated gate:

```powershell
npm run doctor
npm run typecheck
npm test
npm run test:emulators
npm --prefix functions run build
npm --prefix mcp-server run build
```

For each Play build:

1. Increase `expo.android.versionCode` in `app.json`.
2. Increase `expo.version` when the user-visible release version changes.
3. Build the production Android App Bundle.
4. Record its SHA-256 checksum.
5. Install an APK from the same source revision for device testing.
6. Repeat the smoke test below.
7. Upload the AAB to the intended Play track.
8. Confirm that Google Play reports the expected package, version code, target API and signing status.

## Google Play two-week test plan

### Purpose

The test establishes whether BabySteps is reliable and clear enough for normal household logging. It also gathers the evidence needed for a later production-access application where Google Play requires at least 12 opted-in testers for 14 continuous days.

Do not treat the 14-day threshold as the only goal. The release must also demonstrate data integrity, understandable workflows, safe account isolation and a supportable update process.

### Entry criteria

Do not start the qualifying period until all are true:

- AAB accepted on the closed track.
- Store listing and privacy declarations saved.
- Privacy and deletion URLs return HTTP 200.
- Automated verification is green.
- Fresh installation succeeds.
- Registration, onboarding and one event of each type have passed.
- Account deletion has passed on a disposable account.
- At least 12 committed testers are ready to opt in.
- Two reserve testers are available in case somebody leaves.
- Testers have the opt-in URL and tester instructions.
- A feedback tracker is ready.

### Test cohort

Target 14–16 invited adults so the qualifying count remains above 12.

Include, where practical:

- At least one Android 12/13 device.
- At least one Android 14 device.
- At least one Android 15/16 device.
- A small or older phone.
- A recent mid-size phone.
- At least one user who did not help build the app.
- Both millilitre and ounce users if ounce input is important.

Record only the minimum tester register:

| Field | Purpose |
|---|---|
| Tester alias | Follow-up without publishing personal details |
| Device model | Compatibility diagnosis |
| Android version | Compatibility diagnosis |
| App version code | Identify tested build |
| Opt-in date | Track the continuous period |
| Active at day 14 | Production-access evidence |
| Core journey completed | Test coverage |
| Feedback supplied | Evidence of engagement |

### Severity and response

- **S0 — security/privacy:** another user’s data is visible, deletion falsely succeeds, secret exposure or serious policy mismatch. Pause the track, investigate immediately and notify affected testers appropriately.
- **S1 — release blocker:** crash loop, cannot sign in, cannot log, data loss, running sleep cannot stop. Fix as the highest priority.
- **S2 — material:** edit failure, incorrect summary, confusing data state, recurrent layout blocker or poor reconnect. Fix during the test if safe.
- **S3 — minor:** wording, spacing or low-frequency inconvenience. Record for prioritisation after the test.

Every issue must record:

- App version code.
- Device and Android version.
- Network state.
- Steps taken.
- Expected result.
- Actual result.
- Screenshot if useful and privacy-safe.
- Whether it repeated.
- Severity and owner.
- Resolution and retest result.

### Pre-release smoke test

Run on a fresh account:

1. Install the app from the intended Play test link or equivalent signed test build.
2. Launch and confirm icon, splash and login screen.
3. Register with a new email and an eight-character-or-longer password.
4. Add a baby name and date of birth.
5. Log a 120 ml bottle with a note.
6. Log a breast feed with a duration.
7. Log wet, dirty and both nappy types.
8. Start sleep, background the app, force-close it, reopen and confirm the timer remains.
9. Stop sleep and confirm a duration appears.
10. Open Timeline and confirm events are ordered correctly.
11. Edit the bottle amount or note and confirm it updates.
12. Delete one event and confirm it leaves the visible timeline and summaries.
13. Open Stats and compare totals with the timeline.
14. Sign out and sign back in; confirm the same baby and events return.
15. Trigger password reset and confirm an email is sent.
16. Open support, privacy and deletion pages from Settings.
17. Delete a disposable sole-caregiver account using the current password.
18. Confirm the deleted account can no longer sign in.

### Day 0 — internal installation

- Use the Play internal track first.
- Install from Google Play, not only via ADB.
- Verify Play App Signing and the displayed version.
- Run the full smoke test.
- Resolve all S0/S1 defects.
- Promote the same verified bundle to closed testing.

### Day 1 — onboarding and first logs

Each tester:

- Opts in and installs from the closed-test link.
- Registers and creates a baby profile.
- Logs one feed, one nappy and one completed sleep.
- Signs out and back in.
- Reports setup time and any unclear wording.

Coordinator:

- Confirms at least 12 opted-in testers.
- Captures the start date and Play Console count.
- Checks support email.
- Reviews Firebase Authentication and Firestore for expected record shapes without inspecting unnecessary notes.

### Day 2 — feed workflow

- Log bottle amount in the preferred unit.
- Log a breast feed with duration.
- Add and edit an optional note.
- Confirm home counts, timeline text and Stats.
- Report the number of taps and any values that were difficult to enter.

### Day 3 — nappy workflow

- Log wet, dirty and both conditions.
- Correct one condition.
- Delete one disposable test event.
- Confirm visible counts change as expected.

### Day 4 — sleep persistence

- Start a sleep.
- Background the app for at least five minutes.
- Force-close and reopen.
- Confirm the running timer.
- Stop sleep.
- Compare the displayed duration with elapsed wall time.

### Day 5 — unreliable network

- Open the app on a stable connection.
- Disable connectivity.
- Attempt one clearly labelled test action.
- Restore connectivity and observe recovery.
- Confirm no duplicate event appears.
- Record any ambiguous spinner or error.

The first release does not promise offline-first writes. The acceptance goal is an honest error/recovery state and no silent duplication.

### Day 6 — editing and recovery

- Edit a feed amount or duration.
- Edit a note.
- Remove a test event.
- Restart and confirm changes persist.
- Confirm there is no route to edit ownership/source fields.

### Day 7 — midpoint review

Coordinator:

- Verify at least 12 testers remain opted in.
- Review S0–S3 issues and group duplicate reports.
- Check crash reports available from Play pre-launch/testing reports.
- Run automated gates again on the current branch.
- Publish a maintenance update only for S0/S1 or high-impact S2 issues.
- If updating, verify data survives the Play update and record the new version code.

### Day 8 — multi-baby selection

For testers willing to create disposable data:

- Add a second baby profile.
- Switch the active baby.
- Log distinct events for each.
- Confirm timeline and summaries do not mix babies.
- Return to the first baby after restart.

### Day 9 — accessibility and compact layout

- Test increased Android font size.
- Test dark appearance.
- Test a small screen if available.
- Check keyboard does not hide Save.
- Check controls have clear labels and useful error messages.
- Test basic TalkBack navigation where practical.

### Day 10 — account and session

- Sign out and back in.
- Use password reset if not already tested.
- Leave the app unused, then return.
- Verify an expired or interrupted session produces a recoverable sign-in state.
- Confirm privacy and support links still open.

### Day 11 — realistic normal use

- Use BabySteps naturally for a day.
- Do not create artificial volume unless desired.
- Note the moment the app felt slow, confusing or unnecessary.
- Record any event type or shortcut that would materially improve repeated use, but do not treat it as a release blocker automatically.

### Day 12 — data accuracy audit

- Select a one-hour period.
- Keep a separate simple written count.
- Compare BabySteps timeline and summaries with that count.
- Check ordering around midnight if the opportunity occurs.
- Report discrepancies with exact times but omit unnecessary child details.

### Day 13 — deletion and policy review

Using a disposable account:

- Read the privacy policy and compare it with observed app behaviour.
- Delete the account in Settings.
- Confirm sign-in fails afterward.
- Confirm the web deletion route is usable without the app.
- Report any unclear retention or deletion language.

### Day 14 — final closed-test review

Each tester:

- Confirms whether they remained opted in.
- Completes the short exit questionnaire.
- Supplies one most useful feature, one frustration and whether they would keep using the app.

Coordinator:

- Capture the Play Console tester count and dates.
- Confirm the qualifying period has actually elapsed before applying for production access.
- Confirm no unresolved S0/S1 defects.
- Summarise device coverage, completed journeys, issue counts and changes released.
- Complete the production-access questionnaire truthfully using observed evidence.

### Daily five-minute regression

Run after every test update:

1. Launch.
2. Sign in.
3. Select the intended baby.
4. Add a nappy.
5. Start and stop sleep.
6. Add a feed.
7. Edit one item.
8. Check timeline and Stats.
9. Restart and confirm persistence.
10. Sign out.

### Exit questionnaire

Ask:

1. Which Android device and version did you use?
2. On how many days did you use BabySteps?
3. Which of feed, sleep and nappy logging did you use?
4. Did any saved event disappear, duplicate or show the wrong value?
5. Was it always clear which baby was active?
6. What was the most confusing step?
7. What action did you repeat most often?
8. Which single improvement would save the most time?
9. Did you understand that the app is not a medical device?
10. Would you continue using this version? Why or why not?

### Test exit criteria

The test can proceed toward production access when:

- Required continuous tester participation is satisfied where applicable.
- No unresolved S0 or S1 issue exists.
- Core journeys pass on the supported device set.
- No confirmed cross-account access exists.
- No confirmed silent data loss or duplicate-write defect exists.
- Account deletion and public deletion route are verified.
- Store declarations still match actual behaviour.
- Issues and tester feedback have an owner or explicit deferral.
- A versioned release record and rollback plan exist.

## Store and release files

- `store-assets/PLAY_STORE_LISTING.md` — copy for the Play listing.
- `store-assets/DATA_SAFETY.md` — Data safety source mapping.
- `store-assets/PLAY_CONSOLE_CHECKLIST.md` — console sequence and policy answers.
- `store-assets/TESTER_INSTRUCTIONS.md` — text to send to closed testers.
- `store-assets/RELEASE_NOTES.md` — initial release notes.
- `store-assets/RELEASE_EVIDENCE.md` — signed artifact hashes, build IDs and verification evidence.
- `store-assets/play-icon-512.png` — 512 × 512 store icon.
- `store-assets/feature-graphic-1024x500.png` — 1024 × 500 feature graphic.

## Known initial limitations

- Optimised for a sole caregiver; caregiver invitation/transfer is not implemented.
- Account deletion in-app is for sole-caregiver accounts.
- No clinical interpretation or reminders.
- No voice integration.
- No guaranteed offline write queue.
- No public production support commitment during the private test.

## Support

Email `clb.bertram@googlemail.com` and include app version, Android version, device model, expected behaviour and actual behaviour. Avoid including a child’s real name or sensitive notes unless essential to diagnose the problem.
