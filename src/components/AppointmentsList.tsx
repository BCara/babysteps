import { useCarePalette } from '../hooks/useCarePalette';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Surface, Text, useTheme } from 'react-native-paper';
import type { BabyEvent } from '../services/firebase/events';

interface Props {
  appointments: BabyEvent[];
  onPress: (appointment: BabyEvent) => void;
}

const appointmentTitle = (appointment: BabyEvent) =>
  appointment.metadata?.appointmentType?.trim() || 'Appointment';

const appointmentDetails = (appointment: BabyEvent) =>
  [
    appointment.metadata?.provider,
    appointment.metadata?.appointmentLocation ||
      appointment.metadata?.appointmentAddress,
  ]
    .map(value => value?.trim())
    .filter(Boolean)
    .join(' · ');

const formatAppointmentDate = (date: Date) =>
  date.toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function AppointmentRow({
  appointment,
  past,
  onPress,
}: {
  appointment: BabyEvent;
  past: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { careColor, careInk } = useCarePalette();
  const details = appointmentDetails(appointment);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${appointmentTitle(appointment)} appointment`}
      accessibilityHint="Opens this appointment to edit its details."
    >
      {({ pressed }) => (
        <Surface
          elevation={1}
          style={[
            styles.card,
            past && styles.pastCard,
            pressed && { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <View style={[styles.iconBadge, { backgroundColor: careColor('#D5E8F5') }]}>
            <Icon source="calendar-clock-outline" size={22} color={careInk} />
          </View>
          <View style={styles.copy}>
            <Text variant="titleMedium" style={styles.title}>
              {appointmentTitle(appointment)}
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.date, past && styles.pastText]}
            >
              {formatAppointmentDate(appointment.startTime)}
            </Text>
            {details ? (
              <Text variant="bodySmall" numberOfLines={2} style={styles.details}>
                {details}
              </Text>
            ) : null}
          </View>
          <Icon source="pencil-outline" size={19} color={theme.colors.primary} />
        </Surface>
      )}
    </Pressable>
  );
}

export default function AppointmentsList({ appointments, onPress }: Props) {
  const [showPast, setShowPast] = useState(false);
  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const upcomingAppointments = appointments
      .filter(appointment => appointment.startTime.getTime() >= now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const pastAppointments = appointments
      .filter(appointment => appointment.startTime.getTime() < now)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return { upcoming: upcomingAppointments, past: pastAppointments };
  }, [appointments, now]);

  if (!appointments.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Appointments
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {upcoming.length
              ? `${upcoming.length} upcoming${past.length ? ` · ${past.length} past` : ''}`
              : `${past.length} past appointment${past.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      {upcoming.map(appointment => (
        <AppointmentRow
          key={appointment.id || appointment.startTime.toISOString()}
          appointment={appointment}
          past={false}
          onPress={() => onPress(appointment)}
        />
      ))}

      {past.length ? (
        <>
          <Button
            mode="text"
            icon={showPast ? 'chevron-up' : 'history'}
            onPress={() => setShowPast(current => !current)}
            style={styles.pastToggle}
            contentStyle={styles.pastToggleContent}
          >
            {showPast ? 'Hide past appointments' : 'Show past appointments'}
          </Button>
          {showPast
            ? past.map(appointment => (
                <AppointmentRow
                  key={appointment.id || appointment.startTime.toISOString()}
                  appointment={appointment}
                  past
                  onPress={() => onPress(appointment)}
                />
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    paddingBottom: 8,
  },
  sectionHeading: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  muted: {
    opacity: 0.65,
    marginTop: 2,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pastCard: {
    opacity: 0.82,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '800',
  },
  date: {
    marginTop: 2,
    fontWeight: '700',
  },
  pastText: {
    opacity: 0.75,
  },
  details: {
    marginTop: 2,
    opacity: 0.72,
  },
  pastToggle: {
    alignSelf: 'flex-start',
    marginLeft: 12,
  },
  pastToggleContent: {
    flexDirection: 'row-reverse',
  },
});
