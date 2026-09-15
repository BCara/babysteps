# PitterPatter Alexa development skill

The PitterPatter Alexa custom skill records structured feed, sleep and nappy
commands in the same Firestore event collection used by the Android app. The
Android app itself does not request microphone permission and does not capture
audio.

## Current voice commands

With the invocation name **baby steps**, development users can say:

- "Alexa, ask PitterPatter to start a feed."
- "Alexa, ask PitterPatter to stop the feed."
- "Alexa, ask PitterPatter to log a ten minute breastfeed."
- "Alexa, ask PitterPatter to start a nap."
- "Alexa, ask PitterPatter to stop sleep."
- "Alexa, ask PitterPatter to log forty minutes of sleep."
- "Alexa, ask PitterPatter to log a wet nappy."

Alexa writes to the baby currently selected in PitterPatter. Feed and sleep timers
remain mutually exclusive, matching the Android app.

## Architecture

- Skill model: `alexa-skill/interactionModels/custom/en-AU.json`
- Alexa HTTPS endpoint:
  `https://babysteps-cbert.web.app/alexa/skill`
- Account-link page:
  `https://babysteps-cbert.web.app/alexa-link.html`
- OAuth token endpoint:
  `https://babysteps-cbert.web.app/alexa/oauth/token`
- OAuth client ID: `babysteps-alexa`
- OAuth client secret: Firebase Secret Manager name
  `ALEXA_OAUTH_CLIENT_SECRET`
- Cloud Functions region: `australia-southeast1`

The account-link flow uses OAuth 2.0 authorization code grant with S256 PKCE.
The linking page authenticates email/password users directly with Firebase
Authentication and sends only the Firebase ID token to the authorization
function. Alexa receives opaque, expiring PitterPatter access and refresh tokens.
Only SHA-256 token hashes are stored in Firestore.

Alexa requests are accepted only when all of the following pass:

- Amazon request-certificate and signature verification.
- Alexa request timestamp verification.
- Exact Alexa skill application ID validation.
- A valid, unexpired PitterPatter access token.
- Current caregiver access to the baby selected in PitterPatter.

## Firebase prerequisites

Firebase Cloud Functions, Cloud Build and Artifact Registry require the
`babysteps-cbert` project to use the Blaze pay-as-you-go plan. The project was
linked to the existing `Firebase Payment` billing account on 30 July 2026.
Configure a small Google Cloud budget alert. A budget alert is not a hard
spending cap.

Generate the ignored recovery copy of the OAuth client secret once:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-alexa-oauth-secret.ps1
```

The existing development skill is reused with skill ID
`amzn1.ask.skill.40103e14-2ab7-426c-a3b5-add0c2934630`. Its deprecated
configuration has been replaced rather than copied. The local
`functions/.env.babysteps-cbert` contains:

```text
ALEXA_SKILL_ID=amzn1.ask.skill.40103e14-2ab7-426c-a3b5-add0c2934630
PLAY_PACKAGE_NAME=com.cbcreations.babysteps
PLAY_SUBSCRIPTION_PRODUCT_IDS=babysteps_premium
LEGACY_ACCOUNT_EMAILS=
```

Set the Firebase secret without printing it:

```powershell
npx firebase-tools functions:secrets:set ALEXA_OAUTH_CLIENT_SECRET --project babysteps-cbert --data-file .release-credentials/alexa-oauth-client-secret.txt
```

Deploy the backend and hosting together:

```powershell
npm --prefix functions test
npm run typecheck
npx firebase-tools deploy --only "functions:alexaEndpoint,functions:alexaAuthorize,functions:alexaToken,functions:alexaCleanupDeletedUser,hosting" --project babysteps-cbert
```

## Alexa Developer Console configuration

Reuse the existing **Custom** development skill `skill-babysteps` with skill ID
`amzn1.ask.skill.40103e14-2ab7-426c-a3b5-add0c2934630`. Only `en-AU` remains
enabled; the deprecated `en-US` and `en-GB` locales were removed.

Import the JSON from
`alexa-skill/interactionModels/custom/en-AU.json`, then save and build the
model. The development model was rebuilt successfully on 30 July 2026 after the
endpoint configuration was finalised.

Set the custom endpoint to:

```text
https://babysteps-cbert.web.app/alexa/skill
```

The skill now uses this HTTPS endpoint with the Alexa wildcard-certificate
option, because Firebase Hosting presents `*.web.app`. It no longer references
the previous AWS Lambda ARN. The old Lambda resource itself was not deleted and
can be removed separately.

The four Alexa functions and the account-linking Hosting assets were deployed
on 30 July 2026. Artifact Registry removes function images older than seven
days. A signed Alexa `LaunchRequest` reached the live Hosting rewrite and
returned the PitterPatter welcome response.

For account linking use:

| Setting | Value |
|---|---|
| Grant type | Auth Code Grant |
| PKCE | Enabled, S256 |
| Web Authorization URI | `https://babysteps-cbert.web.app/alexa-link.html` |
| Access Token URI | `https://babysteps-cbert.web.app/alexa/oauth/token` |
| Client ID | `babysteps-alexa` |
| Client secret | Contents of the ignored recovery secret file |
| Authentication scheme | HTTP Basic |
| Scope | `babysteps:write` |
| Domain list | `identitytoolkit.googleapis.com` |
| Default access-token expiry | `3600` seconds |

Use these public URLs in distribution/privacy fields:

- Privacy policy: `https://babysteps-cbert.web.app/privacy.html`
- Terms of use: not currently published; leave optional development-only fields
  blank rather than inventing a URL.

## End-to-end development test

1. In the Alexa console, enable testing for **Development**.
2. Enable the development skill in the Alexa app and link an existing
   email/password PitterPatter account.
3. Confirm that the account has a baby and that the intended baby is selected
   in the Android app.
4. In the simulator, enter `ask baby steps to log a wet nappy`.
5. Confirm Alexa reports success.
6. Confirm exactly one nappy record appears in the Android Activity list with
   `source: alexa` in Firestore.
7. Run start/stop tests for both feed and sleep and confirm the recorded
   duration.
8. Test an unlinked request and confirm Alexa displays the Link Account card.
9. Test an invalid unsigned HTTPS request and confirm the endpoint rejects it.

Do not submit the skill for certification until the interaction model, account
linking, privacy text, deletion behaviour and multiple-device voice tests have
all passed.
