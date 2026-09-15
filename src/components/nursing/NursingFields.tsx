import { useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import type { NursingChrome } from './NursingChrome';

/**
 * Form fields in the nursing palette.
 *
 * Same card as the read-only fields on the timer, so a screen that edits a
 * feed and a screen that reports one are built from the same shapes. The
 * border is the only thing that moves on focus.
 */
export function NursingTextField({
  chrome,
  label,
  value,
  onChangeText,
  keyboardType = 'decimal-pad',
  placeholder,
  multiline = false,
  disabled = false,
  accessibilityLabel,
}: {
  chrome: NursingChrome;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Animated.View
      style={[
        styles.field,
        multiline && styles.fieldMultiline,
        {
          backgroundColor: chrome.tokens.bgCard,
          borderColor: focused
            ? chrome.flat.accent
            : chrome.tokens.borderControl,
        },
      ]}
    >
      <Animated.Text
        style={[styles.label, { color: chrome.tokens.textSecondary }]}
      >
        {label}
      </Animated.Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={chrome.flat.textTertiary}
        editable={!disabled}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { color: chrome.flat.textPrimary },
        ]}
        selectionColor={chrome.flat.accent}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </Animated.View>
  );
}

/** A short list of choices as pills — the segmented control, in the palette. */
export function NursingChoice<Value extends string>({
  chrome,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  chrome: NursingChrome;
  label: string;
  value: Value;
  options: Array<{ value: Value; label: string }>;
  onChange: (next: Value) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.choiceBlock}>
      {label ? <Animated.Text
        style={[styles.label, { color: chrome.tokens.textSecondary }]}
      >
        {label}
      </Animated.Text> : null}
      <View style={styles.choiceRow}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={styles.choiceItem}
              onPress={chrome.tap(() => onChange(option.value))}
              {...chrome.press(`choice-${label}-${option.value}`)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label ? `${label}: ${option.label}` : option.label}
            >
              <Animated.View
                style={[
                  styles.choicePill,
                  selected
                    ? {
                        backgroundColor: chrome.tokens.bgPillActive,
                        borderColor: chrome.ring(
                          `choice-${label}-${option.value}`,
                          chrome.tokens.borderActive,
                        ),
                      }
                    : {
                        borderColor: chrome.ring(
                          `choice-${label}-${option.value}`,
                          chrome.tokens.borderControl,
                        ),
                      },
                ]}
              >
                <Animated.Text
                  style={[
                    styles.choiceLabel,
                    {
                      color: selected
                        ? chrome.tokens.textOnFill
                        : chrome.tokens.textPrimary,
                    },
                  ]}
                >
                  {option.label}
                </Animated.Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Two fields side by side, for the left and right minutes. */
export function NursingFieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function NursingFieldHalf({ children }: { children: ReactNode }) {
  return <View style={styles.half}>{children}</View>;
}

/**
 * The scrolling middle of a form screen.
 *
 * The header stays put and the actions stay on the bottom edge, so the one
 * thing that moves under a keyboard is the fields.
 */
export function NursingScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 12,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  fieldMultiline: { paddingBottom: 10 },
  label: { fontSize: 12, fontWeight: '400' },
  input: {
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 6,
    minHeight: 34,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  choiceBlock: { gap: 8 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceItem: { flex: 1 },
  choicePill: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceLabel: { fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { gap: 16, paddingBottom: 4 },
});
