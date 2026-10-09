import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import type { NursingChrome } from '../nursing/NursingChrome';
import { SleepFieldLabel } from './SleepScreenLayout';
import { NursingTextField } from '../nursing/NursingFields';
import {
  SETTLING_DIFFICULTY_DEFINITIONS,
  SETTLING_MINUTE_CHIPS,
  settlingChipSelected,
  toggleSettlingChip,
  toggleSettlingDifficulty,
  type SettlingDifficulty,
} from '../../utils/sleepSettling';

/**
 * How the baby went down.
 *
 * Two questions, both optional, both about the part of bedtime that happens
 * before the sleep being recorded actually starts: how hard it was, and how
 * long it took. The chips carry the usual answers so a 3am log is one tap;
 * "Other" opens a field for the night that was nothing like usual, and stays
 * shut otherwise so the usual night is not asked to read past it.
 */
export default function SleepSettlingFields({
  chrome,
  minutes,
  onMinutesChange,
  difficulty,
  onDifficultyChange,
  disabled = false,
}: {
  chrome: NursingChrome;
  minutes: string;
  onMinutesChange: (next: string) => void;
  difficulty?: SettlingDifficulty;
  onDifficultyChange: (next: SettlingDifficulty | undefined) => void;
  disabled?: boolean;
}) {
  const typed = minutes.trim();
  const onAChip = SETTLING_MINUTE_CHIPS.some(chip =>
    settlingChipSelected(minutes, chip),
  );
  // A value no chip matches can only have been typed, so its field stays open.
  const custom = Boolean(typed) && !onAChip;
  const [otherOpen, setOtherOpen] = useState(custom);
  const showField = otherOpen || custom;

  return (
    <View style={styles.block}>
      <SleepFieldLabel chrome={chrome}>Settling</SleepFieldLabel>

      <View style={styles.grid}>
        {SETTLING_DIFFICULTY_DEFINITIONS.map(definition => {
          const active = difficulty === definition.id;
          return (
            <Pressable
              key={definition.id}
              style={styles.cell}
              disabled={disabled}
              onPress={chrome.tap(() =>
                onDifficultyChange(
                  toggleSettlingDifficulty(difficulty, definition.id),
                ),
              )}
              {...chrome.press(`settling-${definition.id}`)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active, disabled }}
              accessibilityLabel={`Settling was ${definition.label.toLowerCase()}`}
              accessibilityHint={
                active
                  ? 'Clears how hard settling was'
                  : `Records that settling was ${definition.label.toLowerCase()}`
              }
            >
              <Animated.View
                style={[
                  styles.card,
                  {
                    // The same filled pill the places above and the minute
                    // chips below use. Three ways of saying "chosen" on one
                    // screen is two too many.
                    backgroundColor: active
                      ? chrome.tokens.bgPillActive
                      : chrome.tokens.bgCard,
                    borderColor: chrome.ring(
                      `settling-${definition.id}`,
                      active
                        ? chrome.tokens.borderActive
                        : chrome.tokens.borderControl,
                    ),
                  },
                ]}
              >
                <Icon
                  source={definition.icon}
                  size={28}
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
      </View>

      <SleepFieldLabel chrome={chrome}>Took to settle</SleepFieldLabel>
      <View style={styles.chips}>
        {SETTLING_MINUTE_CHIPS.map(chipMinutes => {
          const active = settlingChipSelected(minutes, chipMinutes);
          return (
            <Pressable
              key={chipMinutes}
              style={styles.chipCell}
              disabled={disabled}
              onPress={chrome.tap(() => {
                setOtherOpen(false);
                onMinutesChange(toggleSettlingChip(minutes, chipMinutes));
              })}
              {...chrome.press(`settling-minutes-${chipMinutes}`)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active, disabled }}
              accessibilityLabel={`Settling took ${chipMinutes} minutes`}
              accessibilityHint={
                active
                  ? 'Clears how long settling took'
                  : `Records that settling took about ${chipMinutes} minutes`
              }
            >
              <Animated.View
                style={[
                  styles.chip,
                  active
                    ? {
                        backgroundColor: chrome.tokens.bgPillActive,
                        borderColor: chrome.ring(
                          `settling-minutes-${chipMinutes}`,
                          chrome.tokens.borderActive,
                        ),
                      }
                    : {
                        borderColor: chrome.ring(
                          `settling-minutes-${chipMinutes}`,
                          chrome.tokens.borderControl,
                        ),
                      },
                ]}
              >
                <Animated.Text
                  style={[
                    styles.chipLabel,
                    active && styles.labelActive,
                    {
                      color: active
                        ? chrome.tokens.textOnFill
                        : chrome.tokens.textPrimary,
                    },
                  ]}
                >
                  {chipMinutes}m
                </Animated.Text>
              </Animated.View>
            </Pressable>
          );
        })}
        <Pressable
          style={styles.chipCell}
          disabled={disabled}
          onPress={chrome.tap(() => {
            if (showField) {
              setOtherOpen(false);
              if (custom) onMinutesChange('');
            } else {
              setOtherOpen(true);
              if (onAChip) onMinutesChange('');
            }
          })}
          {...chrome.press('settling-minutes-other')}
          accessibilityRole="button"
          accessibilityState={{ expanded: showField, disabled }}
          accessibilityLabel="Other settling time"
          accessibilityHint={
            showField ? 'Closes the minutes field' : 'Opens a field to type the minutes'
          }
        >
          <Animated.View
            style={[
              styles.chip,
              showField
                ? {
                    backgroundColor: chrome.tokens.bgPillActive,
                    borderColor: chrome.ring(
                      'settling-minutes-other',
                      chrome.tokens.borderActive,
                    ),
                  }
                : {
                    borderColor: chrome.ring(
                      'settling-minutes-other',
                      chrome.tokens.borderControl,
                    ),
                  },
            ]}
          >
            <Animated.Text
              style={[
                styles.chipLabel,
                showField && styles.labelActive,
                {
                  color: showField
                    ? chrome.tokens.textOnFill
                    : chrome.tokens.textPrimary,
                },
              ]}
            >
              Other
            </Animated.Text>
          </Animated.View>
        </Pressable>
      </View>

      {showField ? (
        <NursingTextField
          chrome={chrome}
          label="Minutes to settle"
          value={onAChip ? '' : minutes}
          onChangeText={onMinutesChange}
          placeholder="Type the minutes"
          disabled={disabled}
          accessibilityLabel="Minutes it took to settle"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  // The same wrapping card row the sleep places use, so the two questions on
  // this screen are visibly the same kind of question.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: 96 },
  card: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  label: { fontSize: 13, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipCell: { flexGrow: 1, flexBasis: 44 },
  chip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
});
