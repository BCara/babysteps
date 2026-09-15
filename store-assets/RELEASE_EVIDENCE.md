# PitterPatter 0.1.0 Release Evidence

> Historical record for the superseded `com.babysteps.app` package. This AAB
> and APK must not be uploaded to the replacement `com.cbcreations.babysteps`
> Play listing.

**Prepared:** 28 July 2026  
**Release:** 0.1.0 (version code 1)  
**Package:** `com.babysteps.app`  
**Source commit:** `1f1b47f0035531a136b112ea80e061ca0c452081`

## Release artifacts

The signed local artifacts are kept in the ignored `release` directory so that
large binaries and signing material are not committed.

| Purpose | File | SHA-256 |
| --- | --- | --- |
| Google Play upload | `release/BabySteps-0.1.0-1.aab` | `C78D66FBB99C53196A6F16FF0C2A38D247039601C13B388DAE8B8468917335DC` |
| Direct installation and device QA | `release/BabySteps-0.1.0-1.apk` | `50398EB79068E13F2371B01C00EE7E904D83740E3257D6C8DFE2301B8DFA7A5C` |

Upload certificate SHA-256:

`408C7CC2460E0B739A025F5ACFFDFA9A2B230593FB2018932151C1B0F339CA7B`

The APK verifies with Android APK Signature Scheme v2. The upload keystore and
its recovery details are stored outside Git in `.release-credentials`.

## Hosted builds

Both EAS jobs use the same source commit, application version, version code and
local upload key as the artifacts above.

| Profile | Build ID | Intended output |
| --- | --- | --- |
| Preview | `7b086723-a1d1-4795-9af7-5b345331e014` | Installable APK |
| Production | `c4ff77e5-4afb-42c7-aa06-ef0ee2feb765` | Play Store AAB |

Record the final hosted artifact URLs, checksums and inspection results here
after the EAS workers complete.

## Android inspection

- Minimum SDK: 24.
- Compile SDK: 36.
- Target SDK: 36.
- Native architectures: arm64-v8a, armeabi-v7a, x86 and x86_64.
- Application label: PitterPatter.
- Requested runtime/system permissions are limited to:
  - internet access;
  - network-state access;
  - wake lock used by the Expo runtime;
  - Google services read access;
  - Android's app-scoped non-exported dynamic receiver permission.
- The release does not request storage, microphone, camera, location,
  notification, overlay or vibration permissions.

## Verification completed

- TypeScript app check passed.
- Six unit tests passed.
- Seven Firestore security-rule tests passed in the Firestore emulator.
- Expo Doctor passed all 18 checks.
- Firebase Functions TypeScript build passed.
- MCP server TypeScript build passed.
- Local signed APK and AAB builds passed.
- Exact release APK installed and launched on an Android 17 phone emulator.
- Release startup produced no fatal Android runtime error.
- Native functional testing covered login, feed, nappy, sleep,
  timeline/edit/delete and summaries against the production Firebase project.
- Cross-account Firestore access was denied by the deployed rules.
- Public support, privacy and account-deletion pages returned HTTP 200.

## Known release risk

`npm audit --omit=dev` reports 30 transitive advisories in the current
Expo/React Native toolchain: 11 moderate and 19 high, with no critical
advisories. The available automatic remediations require breaking framework
upgrades. Treat upgrading the framework and rerunning the complete native test
matrix as post-test engineering work unless a directly exploitable issue is
identified during review.

## Play Console checks still required

The account owner must upload the AAB and confirm Play Console's own artifact
analysis, enable Play App Signing, complete app-content declarations, store the
review login securely in App access, configure the tester group and roll out
the closed test. Follow `PLAY_CONSOLE_CHECKLIST.md` without skipping the
pre-launch report or installed-from-Play smoke test.

## PitterPatter branded package build (2026-08-02)

The artifacts below are the rebuilt Android package with the PitterPatter
branding for the new Play listing package `com.cbcreations.babysteps`. They replace the historical
`com.babysteps.app` artifacts listed above; do not upload the historical files
to the new listing.

| Purpose | File | SHA-256 |
| --- | --- | --- |
| Google Play closed-test upload | `release/PitterPatter-0.1.0-1-cbcreations.aab` | `6F129EC68997CFAA176A01F1F0F56FCDF8EA0959AF191B7EC0FA7A616C49384F` |
| Direct installation and device QA | `release/PitterPatter-0.1.0-1-cbcreations.apk` | `0BDCC1566C66C9564A906BB6533323C40192BA28012A8F665E48898F2CD5A361` |

Build verification:

- Package: `com.cbcreations.babysteps`.
- Launcher label: `PitterPatter`.
- Version: `0.1.0` (`versionCode` 1).
- Minimum SDK 24; target SDK 36.
- Firebase Android app `1:942163605541:android:d07a30f55c79f7f3e3e7cc` is
  registered for this package, and the upload certificate SHA-1 is registered
  for Google sign-in.
- AAB JAR signature verification passed.
- APK signature verification passed with upload certificate SHA-256
  `408C7CC2460E0B739A025F5ACFFDFA9A2B230593FB2018932151C1B0F339CA7B`.
- No Android device was connected during this rebuild, so installation and
  runtime smoke testing remain pending for this package.
- Firebase Hosting was redeployed, and the support, privacy, deletion and Alexa
  linking pages return HTTP 200 with the PitterPatter branding.
- The Alexa endpoint, account-link authorization/token functions and cleanup
  function were redeployed with the PitterPatter response text. Publish the
  updated `pitterpatter` invocation model in the Alexa developer console before
  relying on the new invocation phrase.
- This closed-test build uses Google's test AdMob identifiers because real
  production AdMob identifiers are not configured locally. Configure the
  production identifiers and rebuild before production rollout.
