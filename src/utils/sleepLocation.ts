/**
 * Where a baby slept.
 *
 * Seven locations ship with the app and a caregiver can add their own, so an
 * id is an open string rather than a union. Custom ids carry a `custom:`
 * prefix, which keeps them from ever colliding with a built-in or with the
 * legacy `nap`/`night` values that older records still hold — including a
 * custom "Pram" added before Pram was built in, which keeps its own id.
 *
 * The order is the order the grid shows them in: where a newborn most often
 * sleeps first, the occasional places after.
 */
export const BUILT_IN_SLEEP_LOCATIONS = [
  'contactNap',
  'cot',
  'bassinet',
  'pram',
  'car',
  'carrier',
  'parentsBed',
] as const;

export type BuiltInSleepLocation = (typeof BUILT_IN_SLEEP_LOCATIONS)[number];

export type SleepLocation = string;

// `nap` and `night` remain supported so existing care records still render.
export type SleepType = SleepLocation | SleepLocation[];

export const selectedSleepLocations = (value: SleepType | undefined): string[] =>
  [...new Set(Array.isArray(value) ? value : value ? [value] : [])];

export const toggleSleepLocation = (value: SleepType | undefined, id: string): string[] => {
  const selected = selectedSleepLocations(value);
  return selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
};

export const CUSTOM_SLEEP_PREFIX = 'custom:';

/** More than this and the location cards stop fitting on one screen. */
export const MAX_CUSTOM_SLEEP_LOCATIONS = 5;

export const SLEEP_LABEL_MAX_LENGTH = 24;

export interface SleepLocationDefinition {
  id: SleepLocation;
  label: string;
  icon: string;
  builtIn: boolean;
}

/** A caregiver's own location, as stored on their profile. */
export interface CustomSleepLocation {
  id: SleepLocation;
  label: string;
}

const builtInLabels: Record<BuiltInSleepLocation, string> = {
  contactNap: 'Contact',
  cot: 'Cot',
  bassinet: 'Bassinet',
  pram: 'Pram',
  car: 'Car',
  carrier: 'Carrier',
  parentsBed: 'Our bed',
};

const builtInIcons: Record<BuiltInSleepLocation, string> = {
  contactNap: 'account-child',
  cot: 'bed',
  bassinet: 'cradle-outline',
  pram: 'baby-carriage',
  car: 'car',
  carrier: 'bag-personal-outline',
  parentsBed: 'bed-king-outline',
};

export const CUSTOM_SLEEP_ICON = 'sleep';

export const isBuiltInSleepLocation = (
  value: string | undefined,
): value is BuiltInSleepLocation =>
  BUILT_IN_SLEEP_LOCATIONS.includes(value as BuiltInSleepLocation);

export const isCustomSleepLocation = (value: string | undefined) =>
  typeof value === 'string' && value.startsWith(CUSTOM_SLEEP_PREFIX);

/** Turns a typed label into the stable id stored on every sleep record. */
export const customSleepLocationId = (label: string) => {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${CUSTOM_SLEEP_PREFIX}${slug}`;
};

/**
 * The readable name for a deleted custom location, recovered from its own id.
 *
 * Labels are resolved through the definitions so that renaming a location
 * renames it everywhere it was ever used. That leaves deletion: rather than
 * showing a bare id, the slug is turned back into words.
 */
const labelFromCustomId = (id: string) => {
  const slug = id.slice(CUSTOM_SLEEP_PREFIX.length).replace(/-+/g, ' ').trim();
  if (!slug) return 'Sleep';
  return slug.charAt(0).toUpperCase() + slug.slice(1);
};

export const sleepLocationDefinitions = (
  custom: readonly CustomSleepLocation[] = [],
): SleepLocationDefinition[] => [
  ...BUILT_IN_SLEEP_LOCATIONS.map(id => ({
    id: id as SleepLocation,
    label: builtInLabels[id],
    icon: builtInIcons[id],
    builtIn: true,
  })),
  ...custom.map(location => ({
    id: location.id,
    label: location.label,
    icon: CUSTOM_SLEEP_ICON,
    builtIn: false,
  })),
];

export const sleepLocationLabel = (
  sleepType: SleepType | undefined,
  custom: readonly CustomSleepLocation[] = [],
): string => {
  if (Array.isArray(sleepType)) return sleepType.length
    ? sleepType.map(item => sleepLocationLabel(item, custom)).join(', ')
    : 'Sleep';
  if (sleepType === undefined) return 'Sleep';
  if (isBuiltInSleepLocation(sleepType)) return builtInLabels[sleepType];
  if (sleepType === 'night') return 'Night sleep';
  if (sleepType === 'nap') return 'Nap';
  if (isCustomSleepLocation(sleepType)) {
    return (
      custom.find(location => location.id === sleepType)?.label ??
      labelFromCustomId(sleepType)
    );
  }
  // A sleep nobody gave a location to is just a sleep.
  return 'Sleep';
};

export const sleepLocationIcon = (
  sleepType: SleepType | undefined,
): string => {
  if (Array.isArray(sleepType)) return sleepType.length === 1 ? sleepLocationIcon(sleepType[0]) : CUSTOM_SLEEP_ICON;
  if (isBuiltInSleepLocation(sleepType)) return builtInIcons[sleepType];
  return CUSTOM_SLEEP_ICON;
};

/**
 * The location a record should be filed under.
 *
 * Answers "which card shows this record", so it has to name one that exists:
 * a custom id survives only while its location does, and everything unknown —
 * including the legacy `nap` and `night` — falls back to the cot.
 */
export const sleepLocationFor = (
  sleepType: SleepType | undefined,
  custom: readonly CustomSleepLocation[] = [],
): SleepLocation => {
  if (Array.isArray(sleepType)) return sleepLocationFor(sleepType[0], custom);
  if (isBuiltInSleepLocation(sleepType)) return sleepType;
  if (
    isCustomSleepLocation(sleepType) &&
    custom.some(location => location.id === sleepType)
  ) {
    return sleepType as SleepLocation;
  }
  return 'cot';
};

/**
 * The location a record actually carries, or nothing when none was chosen.
 *
 * `sleepLocationFor` has to name a location. This answers "was one ever set",
 * which a sleep started without choosing one has to be able to say no to.
 */
export const optionalSleepLocation = (
  sleepType: SleepType | undefined,
  custom: readonly CustomSleepLocation[] = [],
): SleepType | undefined => {
  if (sleepType === undefined) return undefined;
  if (Array.isArray(sleepType)) return sleepType.map(item => item === 'nap' || item === 'night' ? 'cot' : item);
  return sleepType === 'nap' || sleepType === 'night' ? 'cot' : sleepType;
};

/**
 * Reads a caregiver's own locations back off their profile.
 *
 * Anything malformed is dropped rather than repaired: a location the app
 * cannot name is worse than one that is missing.
 */
export const sanitizeCustomSleepLocations = (
  value: unknown,
): CustomSleepLocation[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const locations: CustomSleepLocation[] = [];

  value.forEach(candidate => {
    if (!candidate || typeof candidate !== 'object') return;
    const raw = candidate as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id : '';
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    if (!isCustomSleepLocation(id) || !label) return;
    if (id === CUSTOM_SLEEP_PREFIX || seen.has(id)) return;
    if (locations.length >= MAX_CUSTOM_SLEEP_LOCATIONS) return;

    seen.add(id);
    locations.push({ id, label: label.slice(0, SLEEP_LABEL_MAX_LENGTH) });
  });

  return locations;
};

export type AddCustomSleepLocationResult =
  | { error: string; locations?: undefined }
  | { error?: undefined; locations: CustomSleepLocation[] };

export const addCustomSleepLocation = (
  existing: readonly CustomSleepLocation[],
  rawLabel: string,
): AddCustomSleepLocationResult => {
  const label = rawLabel.trim().slice(0, SLEEP_LABEL_MAX_LENGTH);
  if (!label) return { error: 'Give this sleep place a name.' };

  const id = customSleepLocationId(label);
  if (id === CUSTOM_SLEEP_PREFIX) {
    return { error: 'Use at least one letter or number.' };
  }
  if (existing.some(location => location.id === id)) {
    return { error: `You already have a place called ${label}.` };
  }
  if (
    sleepLocationDefinitions().some(
      definition => definition.label.toLowerCase() === label.toLowerCase(),
    )
  ) {
    return { error: `${label} is already one of the built-in places.` };
  }
  if (existing.length >= MAX_CUSTOM_SLEEP_LOCATIONS) {
    return {
      error: `You can add up to ${MAX_CUSTOM_SLEEP_LOCATIONS} of your own places.`,
    };
  }

  return { locations: [...existing, { id, label }] };
};
