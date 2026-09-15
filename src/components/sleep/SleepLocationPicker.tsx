import { selectedSleepLocations, toggleSleepLocation } from '../../utils/sleepLocation';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import type { NursingChrome } from '../nursing/NursingChrome';
import type {
  SleepType,
  SleepLocationDefinition,
} from '../../utils/sleepLocation';

/**
 * Where the baby is sleeping.
 *
 * Nursing has two sides and gives each a tall card. Sleep can have eight
 * places once a caregiver adds their own, so this wraps a row of shorter cards
 * instead — same borders, same press ring, same active fill, just sized to a
 * list that grows. Nothing here is required: a sleep with no place chosen is a
 * perfectly good sleep, so the selection can be cleared by tapping again.
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
  return (
    <View style={styles.grid}>
      {definitions.map(definition => {
        const active = selectedSleepLocations(value).includes(definition.id);
        return (
          <Pressable
            key={definition.id}
            style={styles.cell}
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
                  backgroundColor: active
                    ? chrome.tokens.bgCardActive
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
                size={20}
                color={active ? chrome.flat.accent : chrome.flat.textSecondary}
              />
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: active
                      ? chrome.tokens.accent
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
          style={styles.cell}
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
            <Icon source="plus" size={20} color={chrome.flat.textTertiary} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Three to a row at the usual width, and the cards keep their height as the
  // list wraps onto a second and third row.
  cell: { flexGrow: 1, flexBasis: 96 },
  card: {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addCard: { borderStyle: 'dashed' },
  label: { fontSize: 13, fontWeight: '500' },
});
