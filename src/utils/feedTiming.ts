export const formatTimeSinceEventStart = (
  startTime: Date,
  now = new Date(),
) => {
  const totalMinutes = Math.max(
    0,
    Math.floor((now.getTime() - startTime.getTime()) / 60_000),
  );

  if (totalMinutes < 1) return 'Just now';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

export const formatTimeSinceEvent = (
  event: { startTime: Date; endTime?: Date | null },
  now = new Date(),
  { fromStart = false }: { fromStart?: boolean } = {},
) =>
  formatTimeSinceEventStart(
    fromStart ? event.startTime : event.endTime || event.startTime,
    now,
  );

export const formatTimerSeconds = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const minuteSeconds = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
  return hours ? `${hours}:${minuteSeconds}` : minuteSeconds;
};

/** Display an elapsed care duration without exposing second-level precision. */
export const formatElapsedMinutes = (totalSeconds: number) => {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};
