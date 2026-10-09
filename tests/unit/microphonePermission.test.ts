import { describe, expect, it } from 'vitest';
import { describeMicrophoneDenial } from '../../src/utils/microphonePermission';

describe('describeMicrophoneDenial', () => {
  it('offers settings when the permission is blocked for good', () => {
    const denial = describeMicrophoneDenial(
      { granted: false, canAskAgain: false },
      'android',
    );
    expect(denial.canOpenSettings).toBe(true);
    expect(denial.message).toContain('Open settings');
  });

  it('offers settings alongside a retry while the prompt can still appear', () => {
    const denial = describeMicrophoneDenial(
      { granted: false, canAskAgain: true },
      'ios',
    );
    expect(denial.canOpenSettings).toBe(true);
    expect(denial.message).toContain('Tap the microphone to try again');
  });

  it('offers settings when the permission state is unknown', () => {
    expect(describeMicrophoneDenial(undefined, 'ios').canOpenSettings).toBe(true);
  });

  it('points at the browser instead of settings on web', () => {
    const denial = describeMicrophoneDenial(
      { granted: false, canAskAgain: false },
      'web',
    );
    expect(denial.canOpenSettings).toBe(false);
    expect(denial.message).toContain('browser settings');
  });
});
