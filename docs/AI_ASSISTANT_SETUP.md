# PitterPatter AI Assistant setup

The Assistant is an Android-first, read-only view over the selected baby's PitterPatter records. The same explicit AI consent also covers optional appointment and immunisation field extraction from a caregiver-selected image or pasted message or email text. The Assistant cannot create, edit or delete care events, and health-record extraction only fills an editable local draft. Its Firebase callables are deployed in `australia-southeast1` and remain unavailable until the operator explicitly enables them.

## Release boundary

- Free: five successful, uncached generations for the lifetime of the account.
- Premium and Founding Premium: 100 successful, uncached generations per UTC calendar month.
- Cached summaries and failed provider calls do not consume allowance.
- Summaries use at most 30 days of derived aggregates and 60 recent sanitised events.
- Assistant questions contain no baby or caregiver names, exact date of birth, Firebase identifiers, `loggedBy`, notes, provider names or free-text observations. Appointment and immunisation import are separate, user-initiated paths that send only the selected source and may include provider, location, booking and health details present in it.
- The OpenAI call uses `store: false`, no tools or web access, a hashed safety identifier, strict structured output, `reasoning.effort: "none"`, at most 5,000 input tokens and 350 output tokens.
- Medical, emergency, dosage, diagnosis and general parenting questions are handled by fixed redirects and are not sent to the model.
- AI is controlled independently from core logging by the server-side `AI_ENABLED` switch.

## 1. OpenAI project controls

Use a dedicated OpenAI project for PitterPatter. In the OpenAI project settings:

1. Create a restricted API key for the Firebase Functions runtime. Never put it in `.env`, EAS secrets exposed to the client, `app.json`, Android resources or source control.
2. Set the project monthly hard limit to **US$25**.
3. Configure operational notifications at 50%, 80% and 100% of the limit.
4. Leave data-sharing/training opt-in disabled unless the privacy policy and consent are deliberately revised first.

Set the Firebase Functions secret interactively:

```powershell
npx firebase-tools functions:secrets:set OPENAI_API_KEY --project babysteps-cbert
```

The command prompts for the value. Do not paste the key into shell history, documentation, tickets or chat.

## 2. Firebase App Check

The three Assistant callables enforce App Check. Before enabling AI for a release:

1. Register the Android app `com.cbcreations.babysteps` for Firebase App Check.
2. Select the Play Integrity provider.
3. Confirm the Play app-signing certificate and package match the uploaded AAB.
4. For local development only, register a Firebase App Check debug token and place it in an ignored `.env.local` file:

   ```text
   EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN=registered-debug-token
   ```

5. Regenerate the native Android project and rebuild the development client after adding or changing the App Check native module.

Never register a production release as a debug client. A missing or unregistered debug token should fail only the Assistant; core care logging must continue to work.

## 3. Runtime configuration

Copy `functions/.env.example` to the Firebase project-specific, ignored environment file used by the deployment workflow. Keep `AI_ENABLED=false` until the secret, App Check, privacy policy, Play declarations and closed-test build are ready.

The initial routing is:

```text
AI_ASSISTANT_MODEL=gpt-5.6-terra
AI_SUMMARY_MODEL=gpt-5.6-terra
```

Do not move summaries to Luna until the checked-in evaluation gate passes every safety case and reaches at least 95% factual correctness.

## 4. Deploy narrowly

Build and test first:

```powershell
npm --prefix functions run build
node --test functions/test/aiAssistant.test.js
npm run test:emulators
```

Deploy only the Assistant and health-record extraction functions and their rule/index support:

```powershell
npx firebase-tools deploy --only "functions:ai_getStatus,functions:ai_updateConsent,functions:ai_generate,functions:ai_cleanupDeletedUser,functions:appointments_extract,firestore:rules,firestore:indexes" --project babysteps-cbert
```

Deploy the revised privacy page separately after reviewing its rendered contents:

```powershell
npx firebase-tools deploy --only hosting --project babysteps-cbert
```

Set `AI_ENABLED=true` only after deployment and release prerequisites pass. Switching it back to `false` is the operational kill switch and must not affect logging, Activity or deterministic Stats.

## 5. Closed-test verification

Use fictional baby records and a Play-installed build from the exact AAB under review. Verify:

- no consent means no generation;
- accepting the displayed policy version enables requests;
- revoking consent blocks future calls and deletes PitterPatter response caches;
- Free allowance stops after five successful uncached requests and shows Premium;
- Premium and Founding Premium show a 100-generation UTC monthly allowance;
- cached summary views do not consume allowance;
- failed, timed-out and malformed provider responses refund a reservation;
- cross-baby and non-caregiver requests fail;
- offline, killed, over-quota and provider-failure states leave all core care screens usable;
- medical, dosage, emergency and general parenting prompts always receive the fixed redirect;
- function logs contain request ID, mode, model, latency, token counts, cache status and error class only—never questions, facts or answers;
- median response is under five seconds, p95 under ten seconds, typical cost is at most US$0.01 and no Terra request can exceed the configured ceiling.

Record the package, version code, SHA-256, App Check registration, privacy-policy URL, Data Safety answers and test results against the exact AAB. Do not add Assistant claims to the public listing until that evidence matches the released bundle.

## 6. Operational review

Review OpenAI and Firebase spend during closed testing. Investigate the 50% alert before raising any limit. At 80%, disable nonessential testing or set `AI_ENABLED=false`; at 100%, keep AI disabled until usage and quota records are reconciled.

Provider content retention and API terms can change. Recheck the current OpenAI data controls before each public release and update the consent/privacy copy if the stated boundary changes.
