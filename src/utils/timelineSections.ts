const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export interface TimelineSectionLabel {
  title: string;
  subtitle: string;
}

/**
 * The two-part heading a day of activity is grouped under: a name the reader
 * recognises at a glance, and the date that pins it down. Older days are named
 * by weekday, so their subtitle drops the weekday rather than repeating it.
 */
export const timelineSectionLabel = (
  date: Date,
  now: Date,
): TimelineSectionLabel => {
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  const dayMonth = date.toLocaleDateString(
    [],
    date.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );

  if (days === 0 || days === 1) {
    return {
      title: days === 0 ? 'Today' : 'Yesterday',
      subtitle: `${date.toLocaleDateString([], { weekday: 'short' })} ${dayMonth}`,
    };
  }

  return {
    title: date.toLocaleDateString([], { weekday: 'long' }),
    subtitle: dayMonth,
  };
};
