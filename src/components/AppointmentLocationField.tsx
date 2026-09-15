import { ActivityTextInput as TextInput, ActivityButton as Button } from './ActivityStyle';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Surface, Text, useTheme } from 'react-native-paper';

interface Props {
  location: string;
  address: string;
  disabled?: boolean;
  onLocationChange: (value: string) => void;
}

export default function AppointmentLocationField({
  location,
  address,
  disabled = false,
  onLocationChange,
}: Props) {
  const theme = useTheme();
  const mapQuery = [location.trim(), address.trim()].filter(Boolean).join(', ');

  const openMaps = async () => {
    if (!mapQuery) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    try {
      await Linking.openURL(url);
    } catch {
      // The appointment can still be saved if no maps app/browser is available.
    }
  };

  return (
    <Surface
      elevation={0}
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
    >
      <View style={styles.heading}>
        <View style={[styles.headingIcon, { backgroundColor: theme.colors.surface }]}>
          <Icon source="map-marker-outline" size={21} color={theme.colors.primary} />
        </View>
        <View style={styles.headingCopy}>
          <Text variant="titleSmall">Location (optional)</Text>
          <Text variant="bodySmall" style={styles.muted}>
            Add a place or address
          </Text>
        </View>
        {mapQuery ? (
          <Button compact mode="text" icon="map-outline" onPress={() => void openMaps()}>
            Maps
          </Button>
        ) : null}
      </View>
      <Pressable
        onPress={() => void openMaps()}
        disabled={!mapQuery || disabled}
        accessibilityRole="imagebutton"
        accessibilityLabel={mapQuery ? 'Open this location in Google Maps' : 'Location map preview'}
        style={({ pressed }) => [
          styles.mapPreview,
          { backgroundColor: theme.colors.primaryContainer },
          pressed && styles.mapPressed,
          (!mapQuery || disabled) && styles.mapEmpty,
        ]}
      >
        <View style={[styles.roadOne, { backgroundColor: theme.colors.surface }]} />
        <View style={[styles.roadTwo, { backgroundColor: theme.colors.surface }]} />
        <View style={styles.park} />
        <Icon
          source={mapQuery ? 'map-marker' : 'map-search-outline'}
          size={34}
          color={mapQuery ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
        <Text variant="labelMedium" style={styles.mapLabel}>
          {mapQuery ? 'Tap to open in Maps' : 'Location preview'}
        </Text>
      </Pressable>
      <TextInput
        label="Place or address"
        mode="outlined"
        value={location}
        onChangeText={onLocationChange}
        disabled={disabled}
        left={<TextInput.Icon icon="map-marker-outline" />}
        style={styles.inputLast}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  headingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
  },
  muted: {
    opacity: 0.68,
    marginTop: 1,
  },
  mapPreview: {
    height: 96,
    borderRadius: 13,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 2,
  },
  mapPressed: {
    opacity: 0.76,
  },
  mapEmpty: {
    opacity: 0.7,
  },
  roadOne: {
    position: 'absolute',
    width: '130%',
    height: 12,
    transform: [{ rotate: '-12deg' }],
  },
  roadTwo: {
    position: 'absolute',
    height: '150%',
    width: 10,
    transform: [{ rotate: '28deg' }],
  },
  park: {
    position: 'absolute',
    width: 62,
    height: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(112,176,139,0.28)',
    left: 18,
    bottom: 14,
  },
  mapLabel: {
    opacity: 0.72,
  },
  inputLast: {
    marginBottom: 0,
  },
});
