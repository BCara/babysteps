const DAY_MS = 24 * 60 * 60 * 1_000;

const calendarDayNumber = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;

const calendarDaysBetween = (start: Date, end: Date) =>
  Math.floor(calendarDayNumber(end) - calendarDayNumber(start));

const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const addCalendarMonths = (date: Date, months: number) => {
  const monthIndex = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return new Date(
    year,
    month,
    Math.min(date.getDate(), daysInMonth(year, month)),
  );
};

type BabyAgeFormat = 'long' | 'compact';

const unit = (
  value: number,
  singular: string,
  format: BabyAgeFormat,
) => {
  if (format === 'compact') {
    const suffix = singular === 'month' ? 'mo' : singular.charAt(0);
    return `${value}${suffix}`;
  }

  return `${value} ${singular}${value === 1 ? '' : 's'}`;
};

export const formatBabyAgeAtDate = (
  dateOfBirth: Date,
  atDate: Date,
  format: BabyAgeFormat = 'long',
) => {
  const totalDays = calendarDaysBetween(dateOfBirth, atDate);
  if (totalDays < 0) return null;
  if (totalDays < 14) return unit(totalDays, 'day', format);

  let totalMonths =
    (atDate.getFullYear() - dateOfBirth.getFullYear()) * 12 +
    atDate.getMonth() -
    dateOfBirth.getMonth();
  let monthAnniversary = addCalendarMonths(dateOfBirth, totalMonths);
  if (calendarDaysBetween(monthAnniversary, atDate) < 0) {
    totalMonths -= 1;
    monthAnniversary = addCalendarMonths(dateOfBirth, totalMonths);
  }

  if (totalMonths < 3) {
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    return [
      unit(weeks, 'week', format),
      days ? unit(days, 'day', format) : '',
    ]
      .filter(Boolean)
      .join(format === 'compact' ? ' ' : ', ');
  }

  if (totalMonths < 24) {
    const remainingDays = calendarDaysBetween(monthAnniversary, atDate);
    const weeks = Math.floor(remainingDays / 7);
    return [
      unit(totalMonths, 'month', format),
      weeks ? unit(weeks, 'week', format) : '',
    ]
      .filter(Boolean)
      .join(format === 'compact' ? ' ' : ', ');
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return [
    unit(years, 'year', format),
    months ? unit(months, 'month', format) : '',
  ]
    .filter(Boolean)
    .join(format === 'compact' ? ' ' : ', ');
};
