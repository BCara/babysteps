import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Icon, IconButton } from 'react-native-paper';
import { ActivityHeaderVoiceProvider } from '../ActivityHeaderVoice';
import type { NursingChrome } from '../nursing/NursingChrome';
import NursingStartTimeFields from '../nursing/NursingStartTimeFields';

/**
 * The row under the main button always takes this much room, whether or not a
 * screen has anything to put in it. The clock is centred with the button and
 * this row as one group, so a screen with actions and a screen without them
 * would otherwise centre it at two different heights.
 */
const ACTIONS_HEIGHT = 48;

/** How far down the page the timer has to travel before the mini bar takes over. */
const MINI_BAR_THRESHOLD = 0.4;

export function SleepFieldLabel({
  chrome,
  children,
}: {
  chrome: NursingChrome;
  children: ReactNode;
}) {
  return (
    <Animated.Text style={[styles.fieldLabel, { color: chrome.tokens.textSecondary }]}>
      {children}
    </Animated.Text>
  );
}

/**
 * When the baby woke. Empty means the sleep is still going; filling it in turns
 * the timer into a finished sleep, and clearing it turns it back.
 */
export function WokeUpFields({
  chrome,
  value,
  onChange,
  disabled = false,
}: {
  chrome: NursingChrome;
  value?: Date;
  onChange: (next: Date | undefined) => void;
  disabled?: boolean;
}) {
  if (!value) {
    return (
      <Pressable
        onPress={chrome.tap(() => onChange(new Date()))}
        {...chrome.press('woke-up')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Woke up: still asleep"
        accessibilityHint="Sets a woke-up time, so this saves as a finished sleep"
      >
        <Animated.View
          style={[
            styles.placeholderField,
            {
              backgroundColor: chrome.tokens.bgCard,
              borderColor: chrome.ring('woke-up', chrome.tokens.borderControl),
              opacity: disabled ? 0.6 : 1,
            },
          ]}
        >
          <Animated.Text
            style={[styles.placeholderText, { color: chrome.tokens.textSecondary }]}
          >
            Still asleep
          </Animated.Text>
          <Icon source="pencil" size={18} color={chrome.flat.accent} />
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <View style={styles.wokeRow}>
      <View style={styles.wokeFields}>
        <NursingStartTimeFields
          chrome={chrome}
          label="Woke up"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </View>
      <IconButton
        icon="close-circle"
        size={22}
        iconColor={chrome.flat.textSecondary}
        onPress={chrome.tap(() => onChange(undefined))}
        disabled={disabled}
        accessibilityLabel="Clear the woke-up time"
        style={styles.clear}
      />
    </View>
  );
}

/** The big number, with one line under it that never changes height. */
export function SleepClock({
  chrome,
  value,
  caption,
  onPress,
  accessibilityLabel,
}: {
  chrome: NursingChrome;
  value: string;
  caption: string;
  /** Present when the number is a duration that can be typed. */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <View style={styles.clock}>
      <Animated.Text
        style={[
          styles.clockValue,
          { color: chrome.tokens.textPrimary },
          onPress ? { textDecorationLine: 'underline' } : null,
        ]}
      >
        {value}
      </Animated.Text>
      <View style={styles.clockCaptionRow}>
        {onPress ? <Icon source="pencil" size={14} color={chrome.flat.accent} /> : null}
        <Animated.Text style={[styles.clockCaption, { color: chrome.tokens.textSecondary }]}>
          {caption}
        </Animated.Text>
      </View>
    </View>
  );

  return onPress ? (
    <Pressable
      onPress={chrome.tap(onPress)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

export interface SleepMiniAction {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * One screen for sleep, started or running.
 *
 * The first screenful is the timer: when it began, when it ended if it has,
 * the clock, and the button under it. Everything optional lives one scroll
 * further down on the same page. Scrolling there — or tapping "More details",
 * which does the scrolling for you — shrinks the timer into a bar at the top,
 * so its button is never more than one tap away while the details are open.
 */
export default function SleepScreenLayout({
  chrome,
  accessibilityLabel,
  header,
  fields,
  clock,
  primary,
  actions,
  notice,
  mini,
  detailsSummary,
  details,
  overlays,
}: {
  chrome: NursingChrome;
  accessibilityLabel: string;
  header: ReactNode;
  fields: ReactNode;
  clock: ReactNode;
  primary: ReactNode;
  actions?: ReactNode;
  /** A rare warning under the actions; it is allowed to move things. */
  notice?: ReactNode;
  mini: { value: string; caption: string; action: SleepMiniAction };
  detailsSummary?: string;
  details: ReactNode;
  /** Dialogs, rendered outside the scroll. */
  overlays?: ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [detailsY, setDetailsY] = useState(0);
  const [miniShown, setMiniShown] = useState(false);
  const miniProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(miniProgress, {
      toValue: miniShown ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [miniShown, miniProgress]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next =
      viewport > 0 &&
      event.nativeEvent.contentOffset.y > viewport * MINI_BAR_THRESHOLD;
    setMiniShown(current => (current === next ? current : next));
  };

  const scrollToDetails = () =>
    scrollRef.current?.scrollTo({ y: Math.max(0, detailsY - 72), animated: true });
  const scrollToTimer = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  return (
    <Animated.View
      style={[styles.page, { backgroundColor: chrome.tokens.bgPage }]}
      accessibilityLabel={accessibilityLabel}
    >
      <ActivityHeaderVoiceProvider color={chrome.flat.textOnHeader}>
        {header}
        <View
          style={styles.body}
          onLayout={event => setViewport(event.nativeEvent.layout.height)}
        >
          <ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.firstPage, viewport ? { minHeight: viewport } : null]}>
              <View style={styles.fields}>{fields}</View>

              <View style={styles.centre}>
                {clock}
                <View style={styles.primary}>{primary}</View>
                <View style={styles.actions}>{actions}</View>
                {notice}
              </View>

              <Pressable
                style={[styles.handle, { borderTopColor: chrome.flat.borderHairline }]}
                onPress={chrome.tap(scrollToDetails)}
                accessibilityRole="button"
                accessibilityLabel={`More details${detailsSummary ? `: ${detailsSummary}` : ''}`}
                accessibilityHint="Scrolls down to where and how settling went"
              >
                <View style={styles.handleRow}>
                  <Icon source="tune-variant" size={16} color={chrome.flat.textSecondary} />
                  <Animated.Text
                    style={[styles.handleText, { color: chrome.tokens.textSecondary }]}
                  >
                    More details
                  </Animated.Text>
                  {detailsSummary ? (
                    <Animated.Text
                      numberOfLines={1}
                      style={[styles.handleSummary, { color: chrome.tokens.textPrimary }]}
                    >
                      · {detailsSummary}
                    </Animated.Text>
                  ) : null}
                </View>
                <Icon source="chevron-double-down" size={20} color={chrome.flat.textSecondary} />
              </Pressable>
            </View>

            <View
              style={styles.details}
              onLayout={event => setDetailsY(event.nativeEvent.layout.y)}
            >
              {details}
            </View>
          </ScrollView>

          <Animated.View
            pointerEvents={miniShown ? 'auto' : 'none'}
            accessibilityElementsHidden={!miniShown}
            importantForAccessibility={miniShown ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.mini,
              {
                // Flat colours: this view's opacity runs on the native driver,
                // and the animated palette cannot share a node with it.
                backgroundColor: chrome.flat.bgCard,
                borderColor: chrome.flat.borderControl,
                opacity: miniProgress,
                transform: [
                  {
                    translateY: miniProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              style={styles.miniClock}
              onPress={chrome.tap(scrollToTimer)}
              accessibilityRole="button"
              accessibilityLabel={`${mini.value}, ${mini.caption}. Back to the timer`}
            >
              <Animated.Text style={[styles.miniValue, { color: chrome.tokens.textPrimary }]}>
                {mini.value}
              </Animated.Text>
              <Animated.Text
                numberOfLines={1}
                style={[styles.miniCaption, { color: chrome.tokens.textSecondary }]}
              >
                {mini.caption}
              </Animated.Text>
            </Pressable>
            <Pressable
              onPress={chrome.tap(mini.action.onPress)}
              disabled={mini.action.disabled}
              accessibilityRole="button"
              accessibilityLabel={mini.action.label}
              style={[
                styles.miniButton,
                {
                  backgroundColor: chrome.flat.bgPrimary,
                  opacity: mini.action.disabled ? 0.6 : 1,
                },
              ]}
            >
              <Icon source={mini.action.icon} size={18} color={chrome.flat.textOnFill} />
              <Animated.Text
                style={[styles.miniButtonText, { color: chrome.tokens.textOnFill }]}
              >
                {mini.action.label}
              </Animated.Text>
            </Pressable>
          </Animated.View>
        </View>
        {overlays}
      </ActivityHeaderVoiceProvider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  body: { flex: 1 },
  firstPage: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  fields: { gap: 8 },
  centre: { flex: 1, justifyContent: 'center', paddingVertical: 8 },
  primary: { marginTop: 18 },
  actions: { height: ACTIONS_HEIGHT, marginTop: 10, justifyContent: 'center' },
  handle: {
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    gap: 2,
  },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  handleText: { fontSize: 14 },
  handleSummary: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  details: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 12 },
  fieldLabel: { fontSize: 15, fontWeight: '600', marginBottom: -2 },
  placeholderField: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderText: { fontSize: 20, fontStyle: 'italic' },
  wokeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wokeFields: { flex: 1 },
  clear: { margin: 0 },
  clock: { alignItems: 'center' },
  clockValue: {
    fontSize: 56,
    fontWeight: '500',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  clockCaptionRow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  clockCaption: { fontSize: 14 },
  mini: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniClock: { flex: 1 },
  miniValue: { fontSize: 26, fontWeight: '500', fontVariant: ['tabular-nums'] },
  miniCaption: { fontSize: 12 },
  miniButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  miniButtonText: { fontSize: 15, fontWeight: '600' },
});
