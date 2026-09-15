# PitterPatter monetisation and publishing runbook

This runbook turns on the implemented free-with-ads and Premium-without-ads
model. Complete it before publishing the first monetised build.

## Product and access rules

- **Free:** every core feed, sleep, nappy, activity and summary feature remains
  available. Free accounts may see anchored, non-personalised, G-rated banners
  plus at most one full-screen ad per 24 hours after completing a log.
- **Premium:** an active Google Play `babysteps_premium` subscription removes
  every ad. Monthly and annual prices come directly from Google Play.
- **Founding Premium:** accounts created on or before the deployed
  `LEGACY_SIGNUP_CUTOFF_ISO` (plus any addresses explicitly listed in
  `LEGACY_ACCOUNT_EMAILS`) receive permanent ad-free access. This is
  independent of Google Play products and prices.
- A cancelled subscription remains Premium until its paid expiry. Grace-period
  users keep access. Accounts on hold, paused or expired return to Free without
  losing care records.
- Deleting a PitterPatter account deletes its entitlement and server-side purchase
  binding, but Google Play subscriptions must be cancelled separately.

The app never trusts a client-written plan flag. Firebase Functions verifies
the Play purchase, acknowledges it, binds the token to the signed-in Firebase
UID and writes `entitlements/{uid}`. Firestore lets the owner read that document
but blocks every client write. Google Play real-time developer notifications
refresh the same record after renewals, cancellations, grace periods, holds,
pauses and expiries.

## 1. Existing test account is already covered

No account snapshot or email entry is needed. The backend default is:

```text
LEGACY_SIGNUP_CUTOFF_ISO=2026-07-30T23:59:59+10:00
```

The next time that account signs in, `entitlements_syncCurrentUser` grants
Founding Premium after checking its Firebase Authentication creation time. The
permanent result is stored in Firestore, so later changes to the cutoff do not
remove it.

For a future restructure, set `LEGACY_SIGNUP_CUTOFF_ISO` in
`functions/.env.babysteps-cbert` to the announced changeover instant and
redeploy. Every account created by that instant is preserved when it next signs
in. To grant a specific exception, add its lower-case email to the
comma-separated `LEGACY_ACCOUNT_EMAILS` value. Never remove a paid or permanent
legacy entitlement merely because prices change.

## 2. Create the Google Play subscription

The first AAB containing Play Billing may need to be uploaded to an internal
track before all monetisation controls appear.

1. In Play Console, open **Monetize with Play > Products > Subscriptions**.
2. Create the subscription:
   - Product ID: `babysteps_premium`
   - Name: `PitterPatter Premium`
   - Benefit: `Ad-free PitterPatter`
3. Create an auto-renewing base plan with ID `monthly` and billing period
   **Monthly**.
4. Create an auto-renewing base plan with ID `annual` and billing period
   **Yearly**.
5. Choose countries, prices, grace period and account-hold settings.
6. Activate both base plans. Draft plans are not returned to the app.
7. Do not add a free trial until its renewal wording and eligibility have been
   tested. The app already renders any eligible Play offer returned by Billing.

Prices are deliberately absent from source code. Changing a base-plan price
changes what Play presents to eligible customers, not the internal `premium`
benefit. Google Play can retain existing subscribers in legacy price cohorts.

If a future pricing structure uses another subscription product ID, append it
to `PLAY_SUBSCRIPTION_PRODUCT_IDS` before selling it. Keep
`babysteps_premium` in that list for as long as any old purchase must be
restored or renewed.

## 3. Give the backend Google Play access

1. In the Google Cloud project used by the Firebase Functions runtime, enable
   **Google Play Android Developer API**.
2. Deploy the callable functions once, then inspect each deployed function's
   runtime service-account email in Google Cloud.
3. In Play Console **Users and permissions**, invite that service-account email.
4. Grant the minimum billing permissions required by Google:
   - **View financial data, orders, and cancellation survey responses**
   - **Manage orders and subscriptions**
5. Do not download or add a service-account JSON key to the app or repository.
   The deployed function uses its managed runtime identity.

The backend calls `purchases.subscriptionsv2.get` for authoritative state and
the subscription acknowledgement endpoint after a verified purchase.

## 4. Configure real-time developer notifications

The code expects a Pub/Sub topic named `play-billing-notifications` in
`babysteps-cbert`.

1. In Google Cloud, enable the Pub/Sub API and create the topic
   `play-billing-notifications`.
2. On the topic, grant **Pub/Sub Publisher** to
   `google-play-developer-notifications@system.gserviceaccount.com`.
3. Deploy `entitlements_handlePlayBillingNotification`; Firebase creates its
   subscription to that topic.
4. In Play Console open **Monetize > Monetization setup**.
5. Enable real-time developer notifications and enter
   `projects/babysteps-cbert/topics/play-billing-notifications`.
6. Select subscription notifications, including voided purchases if offered.
7. Send a Play Console test message.
8. Confirm the function logs show processing and Firestore contains a
   `playRtdnEvents` record with status `test_received`.

The handler deduplicates Pub/Sub message IDs and always re-queries Google Play;
it never grants access from notification contents alone.

## 5. Deploy Firebase changes

From the repository root:

```powershell
npm --prefix functions run build
npm run test:emulators
firebase deploy --only firestore:rules --project babysteps-cbert
firebase deploy --only "functions:entitlements_syncCurrentUser,functions:entitlements_verifyPlaySubscription,functions:entitlements_handlePlayBillingNotification,functions:entitlements_cleanupDeletedUser" --project babysteps-cbert
firebase deploy --only hosting --project babysteps-cbert
```

After deployment:

1. Sign into the existing test account.
2. Confirm Settings shows **Founding Premium**.
3. Inspect `entitlements/{uid}` in Firestore and confirm
   `accessLevel=legacy`, `adFree=true`, `source=legacy_account`.
4. Confirm the account sees no banner and does not initialise an ad request.

## 6. Create the AdMob app and consent messages

1. In AdMob, add the Android app with package `com.cbcreations.babysteps`.
2. Create one **Banner** ad unit for the anchored adaptive banners.
3. Create one **Interstitial** ad unit named `Completed log - daily`.
4. Set that interstitial ad unit's AdMob frequency cap to **1 impression per
   user per 1 day**. The app independently enforces a rolling 24-hour local
   limit as a second layer.
5. Disable **high-engagement ads** for the first release so interstitials remain
   easier to dismiss.
6. Copy the AdMob **app ID** (contains `~`) plus the banner and interstitial
   **ad-unit IDs** (contain `/`). They are three different identifiers.
7. In AdMob **Privacy & messaging**, create and publish the required consent
   messages for every distributed region, including the EEA/UK message.
8. Keep mediation disabled for the first release. Adding another advertising
   network changes the SDK and Data safety audit.
9. Leave child-directed treatment off: PitterPatter targets adult caregivers, not
   children. The code still caps ad content at `G`, requests non-personalised
   ads and never sends baby-care fields to AdMob.

Development builds use Google's official test app, banner and interstitial IDs.
Never click a live ad while testing.

## 7. Add production build variables

In the Expo project `da4692ab-5a18-4a3c-8c1c-e0e6dff752c7`, add these to the
**production** EAS environment:

```text
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-...~...
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-.../...
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-.../...
EXPO_PUBLIC_PLAY_PREMIUM_PRODUCT_ID=babysteps_premium
```

These are public identifiers, not credentials. `app.config.js` and the EAS
pre-install check intentionally reject a production build that still uses
Google's test AdMob IDs.

Verify locally with the same values loaded in the shell:

```powershell
npm run verify:monetization:production
npx expo config --type public
```

## 8. Play Console declarations

Before submitting the bundle:

- App pricing remains **Free** because installation is free.
- Ads: **Yes**.
- Contains in-app purchases: **Yes**.
- Target audience: adult caregivers; not designed for children.
- Data safety: update from `store-assets/DATA_SAFETY.md` against the final
  generated bundle.
- App access: provide the review account. Keep it Free unless Play needs to
  review a Premium state; reviewers can use a licence-test purchase.
- Add the subscription disclosure and management path visible in Settings.
- Re-run the content rating because advertising is now present.
- Ensure the hosted privacy policy dated 30 July 2026 is deployed.

## 9. Test through Google Play

Billing cannot be validated in Expo Go or a normally sideloaded APK. Use an
internal Play build and a licence tester.

1. Upload the AAB to internal testing.
2. Add the tester Google account under Play licence testing.
3. Install from the Play opt-in link.
4. Use Play's test payment method to buy `monthly`.
5. Confirm:
   - the Play purchase sheet contains the correct price and renewal period;
   - the app reports Premium after server verification;
   - `entitlements/{uid}` becomes `premium` and `adFree=true`;
   - banners and interstitials disappear without deleting any care records;
   - relaunching and **Restore Google Play purchase** preserve Premium;
   - **Manage in Google Play** opens the correct subscription.
6. Test a pending payment; it must not grant Premium until Play reports
   `PURCHASED`.
7. Test cancellation; access must continue to the displayed expiry.
8. Use a short Play test renewal to exercise grace, hold and expiry:
   - grace keeps Premium;
   - hold, pause and expiry return the account to Free;
   - care records remain untouched.
9. Sign into a new non-legacy account and confirm test banners appear on Home,
   Activity and Summary without covering controls.
10. Complete a log and confirm one test interstitial appears only after the
    form closes. Complete more logs and restart the app; no second interstitial
    should appear during the following 24 hours.
11. Test consent acceptance, refusal and the Settings privacy-options link in a
    geography where AdMob requires it.
12. Delete a test account only after cancelling its Play test subscription;
    confirm the Auth deletion trigger removes its entitlement and purchase
    binding.

Do not publish until the RTDN test, purchase, restore, cancellation and expiry
journeys have all been observed in the real Play test environment.

## 10. Safe future pricing changes

- Change prices/base plans in Play Console; do not key app access to a numeric
  price.
- Do not rename or remove the `premium`/ad-free benefit in code.
- Keep all historical product IDs in the backend allow-list.
- Leave Founding Premium documents untouched.
- Let active subscribers retain access until Play's authoritative expiry.
- If moving legacy subscribers to a new price, follow Play's notice and consent
  rules; the app must not silently overwrite their entitlement.
