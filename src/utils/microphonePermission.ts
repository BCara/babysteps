export interface MicrophonePermissionLike {
  granted: boolean;
  canAskAgain?: boolean;
}

export interface MicrophoneDenial {
  message: string;
  /** The system prompt is gone for good, so offer a shortcut into the app settings. */
  canOpenSettings: boolean;
}

/** Explains a refused microphone permission and whether settings can still fix it. */
export function describeMicrophoneDenial(
  permission: MicrophonePermissionLike | undefined,
  platform: string,
): MicrophoneDenial {
  if (platform !== 'ios' && platform !== 'android') {
    return {
      message:
        'Microphone access is needed for voice input. Allow the microphone in your browser settings.',
      canOpenSettings: false,
    };
  }

  return permission?.canAskAgain === false
    ? {
        message:
          'Microphone access is blocked. Open settings and turn the microphone on for PitterPatter.',
        canOpenSettings: true,
      }
    : {
        message:
          'Microphone access is needed for voice input. Tap the microphone to try again, or open settings.',
        canOpenSettings: true,
      };
}

export const MICROPHONE_SETTINGS_LABEL = 'Open settings';

export const MICROPHONE_SETTINGS_FAILED_MESSAGE =
  'Settings could not be opened. Turn the microphone on for PitterPatter in your device settings.';
