# Google Play Console Checklist

## 1. Create the application

- Open Play Console and choose **Create app**.
- App name: **PitterPatter: Baby Care Log**.
- Default language: **English (Australia) — en-AU**.
- App or game: **App**.
- Free or paid: **Free**.
- Accept the required declarations only after reading the current wording.

The Android package for the replacement bundle is `com.cbcreations.babysteps`.

## 2. App integrity

- Enable Google Play App Signing.
- Keep the upload key or EAS-managed credentials recoverable.
- Confirm package: `com.cbcreations.babysteps`.
- Confirm version name: `0.2.0` for the current source candidate.
- Confirm version code: `2` for the current source candidate.
- Confirm target SDK/API: `36`.
- Record the Play app-signing SHA-256 certificate after the first upload.
- Add the Google Play app-signing SHA-1 fingerprint to the Firebase Android app before testing Google sign-in from a Play-installed build.
- Register `com.cbcreations.babysteps` with the Play Integrity provider in Firebase App Check and verify the exact Play-signed build can call the Assistant.

## 3. Store listing

- Copy fields from `PLAY_STORE_LISTING.md`.
- Upload `play-icon-512.png`.
- Upload `feature-graphic-1024x500.png`.
- Capture and upload at least two phone screenshots; four are planned.
- Use only fictional test data in screenshots.
- Add support email and support website.
- Check spelling in the rendered listing.

## 4. App content

Complete every section shown by the current console:

- Privacy policy: `https://babysteps-cbert.web.app/privacy.html`
- Ads: **Yes.** Free accounts can receive non-personalised anchored banners and
  at most one interstitial per 24 hours after completing a log; Premium and
  legacy accounts are ad-free.
- In-app products: **Yes.** `babysteps_premium` is an optional auto-renewing subscription with monthly and annual base plans.
- App access: **All functionality requires an account.** Supply a reusable review account in Play Console when requested. Do not place review credentials in this repository.
- Target audience: adult caregivers; the app is not designed for children.
- Content rating: complete the IARC questionnaire truthfully. No violence, sexual content, gambling, controlled substances or user-to-user public content is implemented.
- Data safety: use `DATA_SAFETY.md` as the source mapping and confirm against the final bundle.
- Account deletion URL: `https://babysteps-cbert.web.app/delete-account.html`
- Government app: **No**
- News app: **No**
- Financial features: **None**
- Health declaration: PitterPatter records routine care but offers no medical advice, diagnosis or clinical monitoring. Answer the console’s current questions literally.
- AI-generated content: if present in the exact AAB, declare the optional read-only Assistant and its fixed medical/general-parenting redirects using the current console wording.
- Data Safety for an AI-enabled build: declare the typed question and minimum structured Health info sent to OpenAI as a service provider, plus optional microphone processing by the speech-recognition provider. Re-audit every included SDK rather than relying on the draft alone.

## 5. Review account

Create a dedicated Firebase review account containing fictional data:

- Fictional caregiver display name.
- Fictional baby name.
- A small set of feed, sleep and nappy events.
- No personal or real-child information.

Keep the credentials in a password manager. Verify them immediately before every submission and prevent automated deletion during review.

## 6. Testing tracks

### Internal test

- Upload the signed AAB.
- Add owner/internal tester emails.
- Add release notes from `RELEASE_NOTES.md`.
- Roll out internally.
- Install through the Play opt-in link.
- Run the README smoke test.

### Closed test

- Create a Google Group or email list.
- Invite 14–16 committed testers to preserve a buffer.
- Add the tester group to the closed track.
- Promote the internally verified release or upload the verified replacement.
- Share the opt-in link and `TESTER_INSTRUCTIONS.md`.
- Confirm at least 12 testers are opted in before starting the recorded 14-day period if the account is subject to Google’s personal-account rule.
- Do not let the count fall below 12 during the continuous period.

### Production access

After the required period:

- Capture the date range and tester count.
- Summarise actual tester engagement and feedback.
- Describe changes made from testing.
- Explain who the app is for and the value it provides.
- Apply for production access using truthful observed evidence.

## 7. Pre-launch and device reports

- Review automated pre-launch report results.
- Review Android vitals available for the test.
- Reproduce crashes on the same or closest device profile.
- Treat data/security issues and startup crashes as release blockers.
- Document harmless automated-crawler failures separately.

## 8. Before each upload

- Increase version code.
- Run all README verification commands.
- Build from a known Git commit.
- Save AAB checksum and build log.
- Verify privacy/Data safety still match the bundle.
- Verify the Assistant consent version, privacy provider/retention copy, App Check enforcement, server kill switch and quotas against the deployed backend.
- Confirm the OpenAI key is absent from the AAB and exists only as a Firebase Functions secret.
- Keep the gated Assistant listing copy unpublished unless the exact AAB has passed the AI closed-test checklist in `docs/AI_ASSISTANT_SETUP.md`.
- Verify support and deletion pages are live.
- Install and run the smoke test.
- Add concise release notes.

## 9. Items requiring the account owner

- Pay/confirm Play developer registration if not already complete.
- Complete identity or organisation verification.
- Accept Play agreements and declarations.
- Add and verify the payments profile required to sell subscriptions.
- Create and activate the `babysteps_premium` monthly and annual base plans.
- Configure Android Publisher API permissions and Play Billing real-time developer notifications using `docs/MONETIZATION_PUBLISHING.md`.
- Create the AdMob app, banner and interstitial units, set the interstitial
  frequency cap to one impression per day, disable high-engagement ads, and
  publish the required Privacy & messaging consent forms.
- Create and maintain tester groups.
- Store review credentials securely in Play Console.
- Configure the dedicated OpenAI project with a US$25 monthly hard limit and operational alerts at 50%, 80% and 100%.
- Set the Firebase `OPENAI_API_KEY` secret, register Play Integrity App Check and explicitly enable `AI_ENABLED` only after the release gate passes.
- Submit production-access and production-review applications.

These are console/identity actions and cannot be completed safely from source code.
