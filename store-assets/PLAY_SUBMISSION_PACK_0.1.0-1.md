# PitterPatter Google Play submission pack

Prepared for the replacement **com.cbcreations.babysteps** Android package.
The previously signed version-1 bundle is still `com.babysteps.app` and cannot
be relabeled; a new bundle must be built before upload.

**Historical note:** the declaration section in this file describes the old
ad-free, no-purchase bundle. For the replacement build from the current source,
use `PLAY_STORE_LISTING.md`, `DATA_SAFETY.md`,
`PLAY_CONSOLE_CHECKLIST.md`, and `docs/MONETIZATION_PUBLISHING.md`; declare Ads
and In-app purchases as **Yes**.

## 1. Replacement build requirements

- File: new AAB to be built after the package change (the existing
  `release/BabySteps-0.1.0-1.aab` is the old package; do not upload it)
- Package name: `com.cbcreations.babysteps`
- Version name: `0.1.0`
- Version code: `1`
- Minimum Android API: `24`
- Target Android API: `36`
- SHA-256: record the new AAB checksum after the replacement build
- Release name: `0.1.0 (1) - Initial closed test`

Firebase Android app registration is complete:

- Firebase Android App ID: `1:942163605541:android:d07a30f55c79f7f3e3e7cc`
- Upload certificate SHA-1 to register: `dcd67f63d59a69ac8017b888cc743afbcbbc75a2`
- After the first Play upload, add the Play App Signing SHA-1 too and download
  the refreshed `google-services.json` before testing Google sign-in.

Enable Google Play App Signing when prompted. Keep the local upload key and its
recovery details private and outside Play listing fields.

## 2. Create app

| Play Console field | Enter/select |
| --- | --- |
| App name | `PitterPatter: Baby Care Log` |
| Default language | English (Australia) - `en-AU` |
| App or game | App |
| Free or paid | Free |
| Category | Parenting |
| Tags | Parenting, Baby, Family (use the closest tags Play currently offers) |

The package name becomes permanent after the first replacement bundle is
uploaded. Do not upload the old `com.babysteps.app` bundle to this listing.

## 3. Main store listing

### App name

```text
PitterPatter: Baby Care Log
```

### Short description

```text
Track feeds, sleep and nappies in one simple baby care timeline.
```

### Full description

```text
PitterPatter helps busy caregivers keep a simple record of everyday baby care.

Quickly log:

• Bottle and breast feeds
• Wet, dirty or combined nappies
• Sleep start, finish and duration
• Optional notes for your own reference

See recent activity in a clear timeline, check today’s totals and review a simple seven-day summary. A running sleep timer is stored securely so it remains available when you reopen the app.

Built for quick everyday use:

• Straightforward setup
• Fast feed and nappy logging
• Easy correction and removal of mistakes
• Multiple baby profiles with active selection
• Secure email and password account
• Account and data deletion from Settings

Private test release

This is an early test version. Features may change as we learn from real caregiver use. Please report problems through the support link in the app.

Important: PitterPatter is a convenience log, not a medical device. It does not provide medical advice, diagnosis, monitoring or emergency services. Do not rely on the app where a missed, delayed or incorrect record could cause harm. Contact an appropriate healthcare professional if you have concerns about a child’s health.
```

### Contact details

| Field | Enter |
| --- | --- |
| Support email | `clb.bertram@googlemail.com` |
| Support website | `https://babysteps-cbert.web.app/` |
| Privacy policy | `https://babysteps-cbert.web.app/privacy.html` |
| Account deletion URL | `https://babysteps-cbert.web.app/delete-account.html` |

These URLs and the email address above were checked against the live pages on
30 July 2026.

## 4. Graphics

Upload:

1. Store icon: `store-assets/play-icon-512.png` - 512 x 512 PNG.
2. Feature graphic: `store-assets/feature-graphic-1024x500.png` - 1024 x 500 PNG.
3. Phone screenshots, in this order:
   - `store-assets/screenshots/01-home.png`
   - `store-assets/screenshots/02-timeline.png`
   - `store-assets/screenshots/03-summary.png`
   - `store-assets/screenshots/04-settings.png`

All four phone screenshots are 1080 x 2400 PNG files and use fictional review
data. Do not replace them with screenshots containing a real child's details.

Suggested captions, if Play offers a caption or promotional-text field:

1. Log everyday care in a few taps
2. Review a clear daily timeline
3. See simple seven-day totals
4. Keep profiles and privacy controls together

## 5. App content declarations

### Privacy policy

```text
https://babysteps-cbert.web.app/privacy.html
```

### Ads

Select **No**. The version-code-1 bundle contains no advertising SDK and shows
no ads.

### In-app purchases

Select **No** for this bundle. It contains no Play Billing SDK, products or
subscriptions.

### App access / sign-in details

Select that all or some functionality is restricted. All useful app
functionality requires an account.

Create a permanent, reusable Firebase review account with fictional data, then
enter its real credentials in Play Console only:

| Field | Enter |
| --- | --- |
| Instruction name | `PitterPatter reviewer account` |
| Username/email | `[REVIEW ACCOUNT EMAIL]` |
| Password | `[REVIEW ACCOUNT PASSWORD]` |
| Other instructions | Use the email and password fields on the first screen, then tap Sign in. The account contains a fictional baby profile and sample feed, sleep and nappy records. No OTP, 2-step verification, location restriction or subscription is required. Please do not delete this shared review account. To review account deletion, create a separate disposable account in the app. |

The credentials must remain valid, reusable and accessible from any country
throughout review. Do not use the `example.com` address visible in the prepared
screenshots as the actual review login.

### Target audience and content

- Target age group: **18 and over only**.
- Is the app designed for children? **No**.
- Does the store listing unintentionally appeal to children? **No**. The app is
  a utility for adult caregivers, although the records concern babies.

### Content rating

Choose **App** and answer from the actual version-code-1 content:

- Violence: No
- Sexuality or nudity: No
- Language/profanity: No
- Controlled substances: No
- Gambling or simulated gambling: No
- Fear/horror: No
- User-to-user communication: No
- Public user-generated content: No
- Location sharing: No
- Digital purchases: No
- Ads: No

Private notes entered by the signed-in caregiver are not published or exchanged
with other users. Submit the questionnaire and use the rating assigned by IARC;
do not manually claim a specific rating before the certificate is issued.

### Health apps declaration

Complete the declaration; do not choose "no health features." Select:

- **Nutrition and Weight Management** - limited to recording bottle/breast
  feeds; PitterPatter provides no nutritional advice or weight management.
- **Sleep Management** - limited to recording sleep start, finish and duration;
  PitterPatter provides no sleep advice or clinical monitoring.

For any explanatory field, use:

```text
PitterPatter is a private routine-care log for adult caregivers. It records baby feeds, nappies and sleep entries and displays simple totals. It does not diagnose, treat, monitor a medical condition, recommend care, connect to a medical device or provide emergency services. The app and store listing state that it is not a medical device.
```

Do not select Medical Device Apps, Diseases and Conditions Management, Clinical
Decision Support or any other medical category.

### News app

Select **No**.

### Government app

Select **No**.

### Financial features

Select **None**.

### Advertising ID

If Play asks whether the app uses the advertising ID, select **No** for this
bundle.

### High-risk or sensitive permissions

The bundle does not request camera, microphone, location, contacts, storage,
notifications, SMS, call log or accessibility permissions. No special
permissions declaration is expected; answer any bundle-generated prompt
literally.

## 6. Data safety form

### Opening questions

| Question | Answer |
| --- | --- |
| Does the app collect or share any required user data types? | Yes |
| Is all collected user data encrypted in transit? | Yes |
| Can users request deletion of their data? | Yes |
| Account deletion URL | `https://babysteps-cbert.web.app/delete-account.html` |
| Is data shared with third parties? | No, using Play's service-provider exception for Firebase processing on the developer's behalf |

### Declare these collected data types

| Play data type | Collected | Shared | Required/optional | Purposes |
| --- | --- | --- | --- | --- |
| Personal info - Name | Yes | No | Required | App functionality; Account management |
| Personal info - Email address | Yes | No | Required | App functionality; Account management |
| Personal info - User IDs | Yes | No | Required | App functionality; Account management; Fraud prevention, security and compliance |
| Personal info - Other info | Yes | No | Required | App functionality |
| Health and fitness - Health info | Yes | No | Required for the core profile/log service; notes are optional | App functionality |
| App activity - Other user-generated content | Yes | No | Optional | App functionality |

The Other info entry covers the baby's date of birth. The Health info entry
covers feed, sleep and nappy records. Other user-generated content covers
optional free-text notes. The app does not sell data, use it for advertising,
or use it for analytics.

### Do not declare for version code 1

- Approximate or precise location
- Contacts
- Photos or videos
- Audio files
- Files and documents
- Calendar
- Web browsing
- SMS or call logs
- Financial or payment information
- Purchase history
- App interactions for analytics or advertising
- Crash logs

Firebase Authentication processes IP addresses and service metadata for
security and abuse prevention. Firebase and Firestore are service providers,
not independent recipients of PitterPatter data. Recheck any SDK suggestions Play
shows after bundle analysis before submitting the form.

### Deletion wording

Select that users can request deletion of their account and associated data
both in the app and through the public web resource. The in-app route is
**Settings > Delete account and data**.

For a shared baby profile, account deletion removes the departing caregiver's
access while preserving the profile and care history for remaining caregivers.
When the account is the last caregiver, the baby profile and its care records
are deleted.

## 7. Closed-test release

### Release notes / What's new

```text
Initial PitterPatter closed test.

• Create an account and baby profile
• Log feeds, sleep and nappies
• Review and edit a live timeline
• See daily and seven-day summaries
• Delete your account and data from Settings

This is an early test release. Please use the in-app support link to report problems.
```

### Track sequence

1. Upload the AAB to **Internal testing** first.
2. Enable Play App Signing.
3. Add the owner/internal tester and roll out.
4. Install from Google Play, not by ADB, and run the full README smoke test.
5. Record the Google Play app-signing SHA-1 and SHA-256 certificates.
6. Promote the same verified bundle to **Closed testing**.
7. Add a Google Group or email list with 14-16 committed testers.
8. Share the Play opt-in link and `store-assets/TESTER_INSTRUCTIONS.md`.

If the developer account is a personal account created after 13 November 2023,
at least 12 testers must remain opted in continuously for 14 days before an
application for production access can be made. Keep two or more reserve testers
and record genuine use and feedback, not only opt-in counts.

### Tester invitation message

```text
You are invited to the private PitterPatter Android test.

1. Open [PLAY OPT-IN LINK] while signed in to the invited Google account.
2. Choose Become a tester.
3. Install PitterPatter from the Play Store link.
4. Keep yourself opted in for the full 14-day test.
5. Use the app for feed, sleep and nappy logging and send any feedback to clb.bertram@googlemail.com.

PitterPatter is an early convenience log, not a medical device. Do not rely on it for medical decisions, monitoring or emergencies.
```

## 8. Account-owner fields that still need real values

These cannot be safely invented:

- Play developer account's public developer name.
- Legal identity, address, phone and verification information requested at the
  account level.
- The permanent review account email and password.
- Tester email list or Google Group and final opt-in link.
- Countries/regions for production availability.
- Whether the Play account is a personal account created after 13 November
  2023.

## 9. Stop conditions

Do not send the release for review if:

- Play's artifact analysis does not show `com.cbcreations.babysteps`, version
  code `1` and target API `36` in the new replacement bundle;
  and target API `36`;
- the live privacy, support or deletion pages fail;
- the review login does not work from a fresh installation;
- the declarations say Ads or In-app purchases are Yes for this AAB;
- listing text mentions Google sign-in, Alexa, ads or Premium;
- a newer AAB has been built from the current modified source without first
  increasing the version code and repeating the release/Data safety audit.
