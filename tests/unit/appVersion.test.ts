import { describe, expect, it } from 'vitest';
import {
  formatVersionDetails,
  formatVersionLine,
} from '../../src/utils/appVersion';

const info = {
  nativeVersion: '0.2.0',
  nativeBuild: '2',
  bundleVersion: '0.2.0',
  lastUpdated: null,
};

describe('formatVersionLine', () => {
  it('shows the native version and build number', () => {
    expect(formatVersionLine(info)).toBe('PitterPatter 0.2.0 (2)');
  });

  it('falls back to the bundle version when native info is missing', () => {
    expect(
      formatVersionLine({ ...info, nativeVersion: null, nativeBuild: null }),
    ).toBe('PitterPatter 0.2.0');
  });
});

describe('formatVersionDetails', () => {
  it('flags app code that differs from the installed build', () => {
    const details = formatVersionDetails(
      { ...info, bundleVersion: '0.3.0' },
      ['Microphone: not allowed'],
    );
    expect(details).toContain('App code: 0.3.0');
    expect(details).toContain('Microphone: not allowed');
  });

  it('omits app code when it matches the installed build', () => {
    expect(formatVersionDetails(info)).not.toContain('App code');
  });
});
