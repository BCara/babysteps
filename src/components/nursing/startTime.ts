/**
 * The date as every nursing screen writes it.
 *
 * The year is left off when it is this one: nearly every entry is from this
 * week, "2026" says nothing, and it is what pushed the date onto two lines in
 * a half-width field. A date from another year still gets it.
 */
export const formatNursingDate = (value: Date, now = new Date()) =>
  value.toLocaleDateString(
    [],
    value.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );

/** The time of day, without the date. */
export const formatNursingTime = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Both, for a screen that reports a start rather than edits one. */
export const formatNursingStartTime = (value: Date) =>
  `${formatNursingDate(value)}, ${formatNursingTime(value)}`;
