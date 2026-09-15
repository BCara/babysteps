interface CalendarAppointment {
  title: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
  notes?: string;
}

export const addAppointmentToDeviceCalendar = async ({
  title,
  startDate,
  durationMinutes,
  location,
  notes,
}: CalendarAppointment) => {
  const Calendar = await import('expo-calendar');
  return Calendar.createEventInCalendarAsync({
    title,
    startDate,
    endDate: new Date(
      startDate.getTime() + (durationMinutes || 60) * 60_000,
    ),
    location,
    notes,
  });
};
