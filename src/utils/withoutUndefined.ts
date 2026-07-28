export const withoutUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutUndefined);
  }

  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, withoutUndefined(entry)]),
    );
  }

  return value;
};
