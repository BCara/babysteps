# PitterPatter for Wear OS

This is the native Wear OS companion for the Android PitterPatter app. It is
kept outside the Expo-generated `android/` directory so `expo prebuild --clean`
cannot delete it.

The watch does not require its own SIM. Quick Care actions take effect on the
watch immediately and are kept in an ordered local queue. The watch continues
to work while the phone is disconnected, then delivers each idempotent command
to the paired, signed-in Android phone over Bluetooth or Wi-Fi. The phone calls
the authenticated Firebase `watch_executeCareCommand` function and returns the
result to the watch without blocking the on-watch timer or controls.

## Build

From the repository root in PowerShell:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\android\gradlew.bat -p .\wear-app :app:assembleDebug
```

The debug APK is written to
`wear-app/app/build/outputs/apk/debug/app-debug.apk`.

## Install on a Galaxy Watch7

1. Enable Developer options on the watch by opening **Settings > About watch >
   Software information** and tapping **Software version** seven times.
2. Open **Developer options**, enable **ADB debugging** and **Wireless
   debugging**.
3. Pair ADB using the watch's displayed IP address, pairing port and pairing
   code, then connect to its debugging port.
4. Install the APK and add the **PitterPatter Quick Care** tile.

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb pair WATCH_IP:PAIRING_PORT
& $adb connect WATCH_IP:DEBUG_PORT
& $adb install -r .\wear-app\app\build\outputs\apk\debug\app-debug.apk
```

The phone and watch builds must use the same package name and signing
certificate for Wear OS Data Layer communication. Debug builds satisfy this
only when both APKs use the same debug keystore. Production builds must use the
same production signing identity.
