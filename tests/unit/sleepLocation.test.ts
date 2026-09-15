import { selectedSleepLocations, toggleSleepLocation } from '../../src/utils/sleepLocation';
import { describe, expect, it } from 'vitest';
import {
  MAX_CUSTOM_SLEEP_LOCATIONS,
  addCustomSleepLocation,
  customSleepLocationId,
  optionalSleepLocation,
  sanitizeCustomSleepLocations,
  sleepLocationDefinitions,
  sleepLocationFor,
  sleepLocationLabel,
} from '../../src/utils/sleepLocation';

const pram = { id: 'custom:pram', label: 'Pram' };

describe('sleep locations', () => {
  it('namespaces custom ids so they cannot collide with the built-ins', () => {
    expect(customSleepLocationId('Pram')).toBe('custom:pram');
    expect(customSleepLocationId('Grandma’s house')).toBe(
      'custom:grandma-s-house',
    );
    expect(customSleepLocationId('Cot')).not.toBe('cot');
  });

  it('lists the built-ins first, then the caregiver’s own', () => {
    expect(sleepLocationDefinitions([pram]).map(d => d.id)).toEqual([
      'contactNap',
      'car',
      'cot',
      'custom:pram',
    ]);
  });

  it('names every kind of location, including the legacy values', () => {
    expect(sleepLocationLabel('cot')).toBe('Cot');
    expect(sleepLocationLabel('contactNap')).toBe('Contact');
    expect(sleepLocationLabel('night')).toBe('Night sleep');
    expect(sleepLocationLabel('nap')).toBe('Nap');
    expect(sleepLocationLabel(undefined)).toBe('Sleep');
    expect(sleepLocationLabel('custom:pram', [pram])).toBe('Pram');
  });

  it('follows a rename through to records already logged against it', () => {
    expect(
      sleepLocationLabel('custom:pram', [{ id: 'custom:pram', label: 'Buggy' }]),
    ).toBe('Buggy');
  });

  it('recovers a readable name when a location has been deleted', () => {
    // The definition is gone, so the id itself has to carry the name.
    expect(sleepLocationLabel('custom:grandma-s-house', [])).toBe(
      'Grandma s house',
    );
  });

  it('files a record under a location that still exists', () => {
    expect(sleepLocationFor('custom:pram', [pram])).toBe('custom:pram');
    expect(sleepLocationFor('custom:pram', [])).toBe('cot');
    expect(sleepLocationFor('night')).toBe('cot');
    expect(sleepLocationFor(undefined)).toBe('cot');
  });

  it('keeps "no location chosen" distinct from "filed under the cot"', () => {
    expect(optionalSleepLocation(undefined)).toBeUndefined();
    expect(optionalSleepLocation('night')).toBe('cot');
  });

  it('drops malformed, duplicate and unprefixed stored locations', () => {
    expect(
      sanitizeCustomSleepLocations([
        pram,
        { id: 'custom:pram', label: 'Duplicate' },
        { id: 'cot', label: 'Not custom' },
        { id: 'custom:', label: 'No slug' },
        { id: 'custom:sling', label: '   ' },
        'nonsense',
        null,
      ]),
    ).toEqual([pram]);
  });

  it('ignores a stored list longer than the cap', () => {
    const many = Array.from({ length: MAX_CUSTOM_SLEEP_LOCATIONS + 3 }, (_, i) => ({
      id: `custom:place-${i}`,
      label: `Place ${i}`,
    }));
    expect(sanitizeCustomSleepLocations(many)).toHaveLength(
      MAX_CUSTOM_SLEEP_LOCATIONS,
    );
  });

  it('refuses a blank, duplicate or built-in name', () => {
    expect(addCustomSleepLocation([], '   ').error).toBe(
      'Give this sleep place a name.',
    );
    expect(addCustomSleepLocation([], '!!!').error).toBe(
      'Use at least one letter or number.',
    );
    expect(addCustomSleepLocation([pram], 'Pram').error).toContain('already');
    expect(addCustomSleepLocation([], 'Cot').error).toContain('built-in');
  });

  it('refuses to go past the cap', () => {
    const full = Array.from({ length: MAX_CUSTOM_SLEEP_LOCATIONS }, (_, i) => ({
      id: `custom:place-${i}`,
      label: `Place ${i}`,
    }));
    expect(addCustomSleepLocation(full, 'One more').error).toContain(
      `${MAX_CUSTOM_SLEEP_LOCATIONS}`,
    );
  });

  it('adds a valid place to the end of the list', () => {
    expect(addCustomSleepLocation([pram], 'Sling').locations).toEqual([
      pram,
      { id: 'custom:sling', label: 'Sling' },
    ]);
  });
});

it('toggles several places independently and reads legacy single selections', () => {
  const selection = toggleSleepLocation('contactNap', 'car');
  expect(selection).toEqual(['contactNap', 'car']);
  expect(sleepLocationLabel(selection)).toBe('Contact, Car');
  expect(toggleSleepLocation(selection, 'contactNap')).toEqual(['car']);
  expect(toggleSleepLocation(['car'], 'car')).toEqual([]);
  expect(selectedSleepLocations('cot')).toEqual(['cot']);
  expect(optionalSleepLocation(['custom:carrier', 'car'])).toEqual(['custom:carrier', 'car']);
});
