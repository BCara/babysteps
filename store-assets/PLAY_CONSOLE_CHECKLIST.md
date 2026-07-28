# Google Play Console Checklist

## 1. Create the application

- Open Play Console and choose **Create app**.
- App name: **BabySteps: Baby Care Log**.
- Default language: **English (Australia) — en-AU**.
- App or game: **App**.
- Free or paid: **Free**.
- Accept the required declarations only after reading the current wording.

The Android package in the first uploaded bundle is permanent: `com.babysteps.app`.

## 2. App integrity

- Enable Google Play App Signing.
- Keep the upload key or EAS-managed credentials recoverable.
- Confirm package: `com.babysteps.app`.
- Confirm version name: `0.1.0`.
- Confirm version code: `1`.
- Confirm target SDK/API: `36`.
- Record the Play app-signing SHA-256 certificate after the first upload.
- If Firebase later uses Google sign-in, App Check or certificate-bound APIs, add the Play signing SHA fingerprints there.

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
- Ads: **No**
- App access: **All functionality requires an account.** Supply a reusable review account in Play Console when requested. Do not place review credentials in this repository.
- Target audience: adult caregivers; the app is not designed for children.
- Content rating: complete the IARC questionnaire truthfully. No violence, sexual content, gambling, controlled substances or user-to-user public content is implemented.
- Data safety: use `DATA_SAFETY.md` as the source mapping and confirm against the final bundle.
- Account deletion URL: `https://babysteps-cbert.web.app/delete-account.html`
- Government app: **No**
- News app: **No**
- Financial features: **None**
- Health declaration: BabySteps records routine care but offers no medical advice, diagnosis or clinical monitoring. Answer the console’s current questions literally.

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
- Verify support and deletion pages are live.
- Install and run the smoke test.
- Add concise release notes.

## 9. Items requiring the account owner

- Pay/confirm Play developer registration if not already complete.
- Complete identity or organisation verification.
- Accept Play agreements and declarations.
- Add payment profile details if the console requires them, even for a free app.
- Create and maintain tester groups.
- Store review credentials securely in Play Console.
- Submit production-access and production-review applications.

These are console/identity actions and cannot be completed safely from source code.
