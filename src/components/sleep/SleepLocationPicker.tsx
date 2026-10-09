import { selectedSleepLocations, toggleSleepLocation } from '../../utils/sleepLocation';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import type { NursingChrome } from '../nursing/NursingChrome';
import type {
  SleepType,
  SleepLocationDefinition,
} from '../../utils/sleepLocation';

/** Four places to a row: enough to read an icon and a word, few enough to aim at. */
const COLUMNS = 4;
const GAP = 8;

/**
 * Where the baby is sleeping.
 *
 * A grid of icon tiles, four across, with Add as a tile of its own at the end
 * so it never stretches into a row on its own. Nothing here is required: a
 * sleep with no place chosen is a perfectly good sleep, so a choice can be
 * cleared by tapping it again.
 */
export default function SleepLocationPicker({
  chrome,
  definitions,
  value,
  onChange,
  onAdd,
  disabled = false,
}: {
  chrome: NursingChrome;
  definitions: SleepLocationDefinition[];
  value?: SleepType;
  onChange: (next: SleepType | undefined) => void;
  /** Offered only where adding a place makes sense. */
  onAdd?: () => void;
  disabled?: boolean;
}) {
  // Measured rather than a percentage, so four tiles and three gaps always add
  // up to exactly the row, however wide the screen.
  const [tileWidth, setTileWidth] = useState<number>();
  const tile = tileWidth ? { width: tileWidth } : styles.cellFallback;

  return (
    <View
      style={styles.grid}
      onLayout={event =>
        setTileWidth(
          Math.floor(
            (event.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS,
          ),
        )
      }
    >
      {definitions.map(definition => {
        const active = selectedSleepLocations(value).includes(definition.id);
        return (
          <Pressable
            key={definition.id}
            style={tile}
            disabled={disabled}
            onPress={chrome.tap(() =>
              onChange(toggleSleepLocation(value, definition.id)),
            )}
            {...chrome.press(definition.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active, disabled }}
            accessibilityLabel={definition.label}
            accessibilityHint={
              active
                ? 'Clears this sleep place'
                : `Adds the sleep place ${definition.label}`
            }
          >
            <Animated.View
              style={[
                styles.card,
                {
                  // Chosen places take the same filled pill every other
                  // selected control in the app wears. A tinted dark card next
                  // to an untinted one is not a difference you can read at 3am.
                  backgroundColor: active
                    ? chrome.tokens.bgPillActive
                    : chrome.tokens.bgCard,
                  borderColor: chrome.ring(
                    definition.id,
                    active
                      ? chrome.tokens.borderActive
                      : chrome.tokens.borderControl,
                  ),
                },
              ]}
            >
              <Icon
                source={definition.icon}
                size={24}
                color={
                  active ? chrome.flat.textOnFill : chrome.flat.textSecondary
                }
              />
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.label,
                  active && styles.labelActive,
                  {
                    color: active
                      ? chrome.tokens.textOnFill
                      : chrome.tokens.textPrimary,
                  },
                ]}
              >
                {definition.label}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        );
      })}

      {onAdd ? (
        <Pressable
          style={tile}
          disabled={disabled}
          onPress={chrome.tap(onAdd)}
          {...chrome.press('add-place')}
          accessibilityRole="button"
          accessibilityLabel="Add a sleep place"
          accessibilityHint="Names a new place, such as the pram"
        >
          <Animated.View
            style={[
              styles.card,
              styles.addCard,
              {
                borderColor: chrome.ring(
                  'add-place',
                  chrome.tokens.borderHairline,
                ),
              },
            ]}
          >
            <Icon source="plus" size={24} color={chrome.flat.textTertiary} />
            <Animated.Text
              numberOfLines={1}
              style={[styles.label, { color: chrome.tokens.textTertiary }]}
            >
              Add
            </Animated.Text>
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  // Before the grid has been measured: close enough to four across.
  cellFallback: { flexBasis: 70, flexGrow: 1 },
  card: {
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addCard: { borderStyle: 'dashed' },
  label: { fontSize: 13, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
