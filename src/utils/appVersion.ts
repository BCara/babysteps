export interface AppVersionInfo {
  /** Version name baked into the installed native build, e.g. "0.2.0". */
  nativeVersion: string | null;
  /** Build number baked into the installed native build (Android versionCode). */
  nativeBuild: string | null;
  /** Version from the JavaScript bundle's app config; differs from native when Metro serves newer code. */
  bundleVersion: string | null;
  /** When this build was installed or last updated on the device. */
  lastUpdated: Date | null;
}

/** One quiet line for the bottom of Settings, e.g. "PitterPatter 0.2.0 (2)". */
export function formatVersionLine(info: AppVersionInfo): string {
  const version = info.nativeVersion || info.bundleVersion || 'unknown';
  return info.nativeBuild
    ? `PitterPatter ${version} (${info.nativeBuild})`
    : `PitterPatter ${version}`;
}

/** Full build details for support, shown when the version line is held down. */
export function formatVersionDetails(
  info: AppVersionInfo,
  extraLines: string[] = [],
): string {
  const lines = [
    `Version: ${info.nativeVersion || 'unknown'}`,
    `Build: ${info.nativeBuild || 'unknown'}`,
  ];
  if (info.lastUpdated) {
    lines.push(
      `Installed: ${info.lastUpdated.toLocaleString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    );
  }
  if (info.bundleVersion && info.bundleVersion !== info.nativeVersion) {
    lines.push(`App code: ${info.bundleVersion}`);
  }
  return [...lines, ...extraLines].join('\n');
}
