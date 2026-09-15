/** The date as every nursing screen writes it. */
export const formatNursingDate = (value: Date) =>
  value.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** The time of day, without the date. */
export const formatNursingTime = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Both, for a screen that reports a start rather than edits one. */
export const formatNursingStartTime = (value: Date) =>
  `${formatNursingDate(value)}, ${formatNursingTime(value)}`;
