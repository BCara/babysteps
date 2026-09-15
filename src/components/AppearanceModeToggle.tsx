import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { IconButton, Menu, SegmentedButtons } from 'react-native-paper';
import { useAppearance } from '../providers/AppearanceProvider';
import type { NursingModePreference } from '../utils/nightMode';

/** One appearance preference for every screen, including active care timers. */
export default function AppearanceModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, preference, setPreference } = useAppearance();
  const [open, setOpen] = useState(false);

  const resolved = mode === 'night' ? 'dark' : 'pastel';

  if (compact) return (
    <Menu visible={open} onDismiss={() => setOpen(false)} anchor={
      <IconButton icon={mode === 'night' ? 'weather-night' : 'white-balance-sunny'}
        mode="outlined" size={22} style={{ width: 48, height: 48, margin: 0 }}
        accessibilityLabel={`Appearance: ${preference}, currently ${resolved}. Choose colour mode`}
        onPress={() => setOpen(true)} />
    }>
      {([
        ['auto', 'Automatic'], ['standard', 'Pastel'], ['night', 'Night'],
      ] as const).map(([value, label]) => <Menu.Item key={value} title={label}
        leadingIcon={preference === value ? 'check' : undefined}
        onPress={() => { setOpen(false); void setPreference(value); }} />)}
    </Menu>
  );

  return (
    <SegmentedButtons
      value={preference}
      onValueChange={value =>
        void setPreference(value as NursingModePreference)
      }
      density="small"
      style={styles.control}
      buttons={[
        {
          value: 'auto',
          icon: 'brightness-auto',
          showSelectedCheck: false,
          style: styles.segment,
          accessibilityLabel: `Appearance: auto, currently ${resolved}`,
        },
        {
          value: 'standard',
          icon: 'brightness-5',
          showSelectedCheck: false,
          style: styles.segment,
          accessibilityLabel: 'Appearance: always pastel',
        },
        {
          value: 'night',
          icon: 'weather-night',
          showSelectedCheck: false,
          style: styles.segment,
          accessibilityLabel: 'Appearance: always dark',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  control: { width: 150, maxWidth: '100%' },
  segment: { minWidth: 0 },
});
