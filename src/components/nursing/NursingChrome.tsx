import { careScreenTokens } from '../../theme/careScreenTheme';
import { ActivityHeaderVoice, ActivityHeaderVoiceProvider } from '../ActivityHeaderVoice';
import { useRouter } from 'expo-router';
import { useEvents } from '../../providers/EventProvider';
import { lastActivityAgo, lastCareActivity } from '../../utils/lastCareActivity';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { Icon, IconButton } from 'react-native-paper';
import {
  HEADER_ICON_OPACITY,
  activityTokens,
  type ActivityHue,
  type NursingTokens,
} from '../../theme/nursingTheme';
import {
  useAnimatedActivityTokens,
  type AnimatedNursingTokens,
} from '../../hooks/useNursingAppearance';
import { useAppearance } from '../../providers/AppearanceProvider';

/**
 * The shared chrome for every nursing screen.
 *
 * The running timer set the design: a pill header, hairline-bordered cards on
 * a near-black page, tabular numerals, one filled pill for the main action and
 * quiet text actions below a divider. Everything a caregiver reaches for
 * one-handed at 3am keeps a 44pt target, and a press only moves a border
 * colour — nothing grows, shifts or brightens.
 */
export interface NursingChrome {
  tokens: AnimatedNursingTokens;
  /** The same palette without animation, for props that take a plain colour. */
  flat: NursingTokens;
  /** Wraps a handler so night mode confirms the tap with a short buzz. */
  tap: (action: () => void) => () => void;
  /** Press handlers that drive the border ring for `key`. */
  press: (key: string) => {
    onPressIn: () => void;
    onPressOut: () => void;
  };
  /** The border colour for `key`: the accent while held, `resting` otherwise. */
  ring: (
    key: string,
    resting: string | Animated.AnimatedInterpolation<string>,
  ) => string | Animated.AnimatedInterpolation<string>;
}

/**
 * Whether this build may vibrate.
 *
 * Without android.permission.VIBRATE the platform throws a SecurityException
 * on the native module thread, which a JavaScript try/catch cannot intercept —
 * it crashes the app. So the call has to be skipped, not guarded. The
 * permission is declared in the manifest, but an already-installed build made
 * before that change still lacks it, hence the runtime check rather than a
 * constant.
 */
const checkHaptics = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(
      'android.permission.VIBRATE' as Parameters<
        typeof PermissionsAndroid.check
      >[0],
    );
  } catch {
    return false;
  }
};

/**
 * The chrome for one activity. Every primitive below is hue-agnostic — it reads
 * whatever palette this returns — so nursing and sleep share one design and
 * differ only in the colours that name them.
 */
export const useActivityChrome = (hue: ActivityHue, pastel?: string): NursingChrome => {
  const { mode } = useAppearance();
  const palette = pastel ? careScreenTokens(pastel) : activityTokens[hue];
  const tokens = useAnimatedActivityTokens(hue, mode, palette);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [hapticsReady, setHapticsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkHaptics().then(available => {
      if (!cancelled) setHapticsReady(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flat = palette[mode];
  const still = mode === 'night';

  return {
    tokens,
    flat,
    tap: action => () => {
      // Night mode confirms with haptics; the visual confirmation is the quiet
      // press ring, never a flash or a brightness change.
      if (still && hapticsReady) Vibration.vibrate(10);
      action();
    },
    press: key => ({
      onPressIn: () => setPressedKey(key),
      onPressOut: () => setPressedKey(null),
    }),
    ring: (key, resting) => (pressedKey === key ? flat.accent : resting),
  };
};

export const useNursingChrome = () => useActivityChrome('nursing');

export function NursingPage({
  chrome,
  accessibilityLabel,
  children,
}: {
  chrome: NursingChrome;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  return (
    <Animated.View
      style={[styles.page, { backgroundColor: chrome.tokens.bgPage }]}
      accessibilityLabel={accessibilityLabel}
    >
      <ActivityHeaderVoiceProvider color={chrome.flat.textOnHeader}>
        {children}
      </ActivityHeaderVoiceProvider>
    </Animated.View>
  );
}

/**
 * The quick care hero, in the nursing palette.
 *
 * It bleeds to the edges of the page and keeps the rounded bottom corners, so
 * a nursing screen is recognisably the same banner whether it was opened from
 * home, a widget or the timeline.
 */
export function NursingHeader({
  chrome,
  title,
  icon,
  onBack,
  backLabel = 'Back',
  eyebrow = 'QUICK CARE',
  trailing,
  bleedPagePadding = true,
}: {
  chrome: NursingChrome;
  title: string;
  icon: string;
  onBack: () => void;
  backLabel?: string;
  eyebrow?: string;
  /** Optional control on the right, such as the options menu. */
  trailing?: ReactNode;
  /** Cancel NursingPage's padding; disable in containers without page padding. */
  bleedPagePadding?: boolean;
}) {
  const router = useRouter();
  const { events, loading } = useEvents();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const last = lastCareActivity(events, icon, now);
  const lastTime = last
    ? lastActivityAgo(last.startTime, now)
    : 'Not logged yet';
  return (
    <Animated.View
      style={[styles.header, bleedPagePadding && styles.headerBleed, { backgroundColor: chrome.tokens.bgHeader }]}
    >
      <View style={styles.headerNav}>
        <Pressable
          onPress={chrome.tap(onBack)}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Icon
            source="chevron-left"
            size={24}
            color={chrome.flat.textOnHeader}
          />
          <Animated.Text
            style={[styles.headerBackLabel, { color: chrome.tokens.textOnHeader }]}
          >
            {backLabel}
          </Animated.Text>
        </Pressable>
        {trailing}
      </View>
      <View style={styles.headerIdentity}>
        <View style={styles.headerBadge}>
          <Icon source={icon} size={29} color={chrome.flat.textOnHeader} />
        </View>
        <View style={styles.headerCopy}>
          <Animated.Text
            style={[styles.headerEyebrow, { color: chrome.tokens.textOnHeader }]}
          >
            {eyebrow}
          </Animated.Text>
          <Animated.Text
            style={[styles.headerTitle, { color: chrome.tokens.textOnHeader }]}
          >
            {title}
          </Animated.Text>
          <Animated.View style={[styles.headerLastActivity, {
            backgroundColor: 'rgba(0,0,0,0.12)',
            borderColor: 'rgba(0,0,0,0.08)',
          }]}>
            <Animated.Text style={[styles.headerLastActivityText, { color: chrome.tokens.textOnHeader }]}>
              {loading ? 'Loading last activity…' : `Last activity: ${lastTime}`}
            </Animated.Text>
          </Animated.View>
        </View>
        <View style={styles.headerMicrophone}>
          <ActivityHeaderVoice part="button" fallback={
            <IconButton icon="microphone-outline" size={30}
              mode="contained-tonal"
              style={{ margin: 0, width: 56, height: 56, borderRadius: 28 }}
              containerColor="rgba(255,255,255,0.12)"
              iconColor={chrome.flat.textOnHeader}
              accessibilityLabel="Log activity with voice"
              onPress={() => {
                onBack();
                requestAnimationFrame(() => router.push({ pathname: '/(app)/quick-care', params: { action: 'voice' } }));
              }} />
          } />
        </View>
      </View>
      <ActivityHeaderVoice part="message" />
    </Animated.View>
  );
}

/** The header's own icon button, so a trailing control matches the back arrow. */
export function NursingHeaderAction({
  chrome,
  icon,
  onPress,
  accessibilityLabel,
}: {
  chrome: NursingChrome;
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={chrome.tap(onPress)}
      style={styles.headerTarget}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ opacity: HEADER_ICON_OPACITY }}>
        <Icon source={icon} size={22} color={chrome.flat.textOnHeader} />
      </View>
    </Pressable>
  );
}

/** A labelled value on a card, optionally tappable to edit it. */
export function NursingFieldCard({
  chrome,
  pressKey,
  icon,
  label,
  value,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  trailingIcon = 'pencil',
}: {
  chrome: NursingChrome;
  pressKey: string;
  icon?: string;
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  trailingIcon?: string | null;
}) {
  const card = (
    <Animated.View
      style={[
        styles.fieldCard,
        {
          backgroundColor: chrome.tokens.bgCard,
          borderColor: chrome.ring(pressKey, chrome.tokens.borderControl),
        },
      ]}
    >
      {icon ? (
        <Icon source={icon} size={20} color={chrome.flat.textSecondary} />
      ) : null}
      <View style={styles.fieldCopy}>
        <Animated.Text
          style={[styles.fieldLabel, { color: chrome.tokens.textSecondary }]}
        >
          {label}
        </Animated.Text>
        <Animated.Text
          style={[styles.fieldValue, { color: chrome.tokens.textPrimary }]}
        >
          {value}
        </Animated.Text>
      </View>
      {onPress && trailingIcon ? (
        <Icon source={trailingIcon} size={18} color={chrome.flat.accent} />
      ) : null}
    </Animated.View>
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={chrome.tap(onPress)}
      {...chrome.press(pressKey)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
      accessibilityHint={accessibilityHint}
    >
      {card}
    </Pressable>
  );
}

/** The headline figure a screen is about — a running total, or a saved one. */
export function NursingTotal({
  chrome,
  value,
  caption,
}: {
  chrome: NursingChrome;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.totalBlock}>
      <Animated.Text
        style={[styles.totalValue, { color: chrome.tokens.textPrimary }]}
      >
        {value}
      </Animated.Text>
      <Animated.Text
        style={[styles.totalCaption, { color: chrome.tokens.textSecondary }]}
      >
        {caption}
      </Animated.Text>
    </View>
  );
}

export function NursingSideRow({ children }: { children: ReactNode }) {
  return <View style={styles.sideRow}>{children}</View>;
}

/** One breast: its label, its minutes, and what a tap will do. */
export function NursingSideCard({
  chrome,
  side,
  label,
  value,
  pillText,
  active = false,
  lastUsed = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: {
  chrome: NursingChrome;
  side: 'left' | 'right';
  label: string;
  /** The minutes on this side. Omitted before a feed has any. */
  value?: string;
  pillText: string;
  active?: boolean;
  /** The side the previous feed finished on — where the next one usually starts. */
  lastUsed?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={styles.sidePressable}
      {...chrome.press(side)}
      disabled={disabled}
      onPress={chrome.tap(onPress)}
      accessibilityRole="button"
      accessibilityLabel={lastUsed ? `${accessibilityLabel}. Last used side.` : accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.sideCard,
          {
            backgroundColor: active
              ? chrome.tokens.bgCardActive
              : chrome.tokens.bgCard,
            borderWidth: lastUsed ? 3 : 1,
            paddingVertical: lastUsed ? 14 : 16,
            paddingHorizontal: lastUsed ? 10 : 12,
            borderColor: chrome.ring(
              side,
              lastUsed
                ? chrome.tokens.accent
                : active ? chrome.tokens.borderActive : chrome.tokens.borderControl,
            ),
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.sideLabel,
            {
              color: active ? chrome.tokens.accent : chrome.tokens.textPrimary,
            },
          ]}
        >
          {label}
        </Animated.Text>
        <View
          style={[styles.lastMark, !lastUsed && styles.lastMarkPlaceholder]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Animated.Text
            style={[styles.lastMarkLabel, { color: chrome.tokens.accent }]}
          >
            Last used
          </Animated.Text>
        </View>
        {value ? (
          <Animated.Text
            style={[
              styles.sideTimer,
              {
                color: active
                  ? chrome.tokens.textPrimary
                  : chrome.tokens.textTertiary,
              },
            ]}
          >
            {value}
          </Animated.Text>
        ) : null}
        <Animated.View
          style={[
            styles.sidePill,
            active
              ? {
                  backgroundColor: chrome.tokens.bgPillActive,
                  borderColor: chrome.tokens.bgPillActive,
                }
              : { borderColor: chrome.tokens.borderControl },
          ]}
        >
          <Animated.Text
            style={[
              styles.sidePillLabel,
              {
                color: active
                  ? chrome.tokens.textOnFill
                  : chrome.tokens.textPrimary,
              },
            ]}
          >
            {pillText}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Pushes whatever follows it to the bottom of the page. */
export function NursingSpacer() {
  return <View style={styles.spacer} />;
}

/** The one filled action a screen is built around. */
export function NursingPrimaryAction({
  chrome,
  label,
  onPress,
  pressKey = 'primary',
  disabled = false,
  accessibilityLabel,
}: {
  chrome: NursingChrome;
  label: string;
  onPress: () => void;
  pressKey?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={chrome.tap(onPress)}
      {...chrome.press(pressKey)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Animated.View
        style={[
          styles.primary,
          {
            backgroundColor: chrome.tokens.bgPrimary,
            borderColor: chrome.ring(pressKey, chrome.tokens.bgPrimary),
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Animated.Text
          style={[styles.primaryLabel, { color: chrome.tokens.textOnFill }]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/** An outlined action for the second choice on a screen. */
export function NursingSecondaryAction({
  chrome,
  label,
  onPress,
  pressKey = 'secondary',
  disabled = false,
  accessibilityLabel,
}: {
  chrome: NursingChrome;
  label: string;
  onPress: () => void;
  pressKey?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={chrome.tap(onPress)}
      {...chrome.press(pressKey)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Animated.View
        style={[
          styles.secondary,
          {
            borderColor: chrome.ring(pressKey, chrome.tokens.borderControl),
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Animated.Text
          style={[styles.primaryLabel, { color: chrome.tokens.textPrimary }]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export interface NursingBottomAction {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
  /** Quiet actions sit a step back in the palette. */
  muted?: boolean;
  /** Discarding: the pill and its label carry the danger colour. */
  danger?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Where a row of action pills sits across the width of the page. */
type ActionAlign = 'flex-start' | 'center' | 'flex-end' | 'space-between';

/**
 * One quiet action, shaped like the date and time fields.
 *
 * A bordered pill rather than bare text: the same 44pt target the rest of the
 * screen keeps, and a press moves its border like every other control.
 */
export function NursingActionPill({
  chrome,
  action,
}: {
  chrome: NursingChrome;
  action: NursingBottomAction;
}) {
  const tint = action.danger
    ? chrome.tokens.danger
    : action.muted
      ? chrome.tokens.textTertiary
      : chrome.tokens.textPrimary;
  const flatTint = action.danger
    ? chrome.flat.danger
    : action.muted
      ? chrome.flat.textTertiary
      : chrome.flat.textPrimary;
  return (
    <Pressable
      onPress={chrome.tap(action.onPress)}
      {...chrome.press(action.key)}
      disabled={action.disabled}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
    >
      <Animated.View
        style={[
          styles.actionPill,
          {
            borderColor: chrome.ring(
              action.key,
              action.danger ? chrome.tokens.danger : chrome.tokens.borderControl,
            ),
            opacity: action.disabled ? 0.6 : 1,
          },
        ]}
      >
        <Icon source={action.icon} size={16} color={flatTint} />
        <Animated.Text style={[styles.bottomLabel, { color: tint }]}>
          {action.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/** The quiet actions, as a band of pills placed above the main action. */
export function NursingActionRow({
  chrome,
  actions,
  align = 'center',
  divider = false,
}: {
  chrome: NursingChrome;
  actions: NursingBottomAction[];
  align?: ActionAlign;
  /** Keeps the hairline that separates the quiet actions from the rest. */
  divider?: boolean;
}) {
  return (
    <>
      {divider ? (
        <Animated.View
          style={[
            styles.divider,
            { backgroundColor: chrome.tokens.borderHairline },
          ]}
        />
      ) : null}
      <View style={[styles.actionRow, { justifyContent: align }]}>
        {actions.map(action => (
          <NursingActionPill key={action.key} chrome={chrome} action={action} />
        ))}
      </View>
    </>
  );
}

/** The divider and the quiet action pills that close every nursing screen. */
export function NursingBottomRow({
  chrome,
  actions,
  align = 'center',
}: {
  chrome: NursingChrome;
  actions: NursingBottomAction[];
  align?: ActionAlign;
}) {
  return (
    <>
      <Animated.View
        style={[styles.divider, { backgroundColor: chrome.tokens.borderHairline }]}
      />
      <View style={[styles.bottomRow, { justifyContent: align }]}>
        {actions.map(action => (
          <NursingActionPill key={action.key} chrome={chrome} action={action} />
        ))}
      </View>
    </>
  );
}

/** Supporting copy under a heading: one step down, never a second heading. */
export function NursingHint({
  chrome,
  children,
}: {
  chrome: NursingChrome;
  children: ReactNode;
}) {
  return (
    <Animated.Text
      style={[styles.hint, { color: chrome.tokens.textSecondary }]}
    >
      {children}
    </Animated.Text>
  );
}

/** A failed save or start, stated in the accent rather than a new red. */
export function NursingError({
  chrome,
  message,
}: {
  chrome: NursingChrome;
  message: string;
}) {
  if (!message) return null;
  return (
    <Animated.Text style={[styles.hint, { color: chrome.tokens.accent }]}>
      {message}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 16 },
  spacer: { flex: 1 },
  header: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerBleed: {
    // Only NursingPage supplies the padding these margins cancel.
    marginTop: -16,
    marginHorizontal: -16,
  },
  headerNav: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBack: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 10,
  },
  headerBackLabel: { fontSize: 15, fontWeight: '500' },
  headerIdentity: {
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBadge: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerCopy: { flex: 1 },
  headerMicrophone: { alignSelf: 'center', flexShrink: 0 },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    opacity: 0.64,
  },
  headerTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', marginTop: 1 },
  headerLastActivity: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerLastActivityText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fieldCopy: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '400' },
  fieldValue: { fontSize: 16, fontWeight: '500' },
  totalBlock: { alignItems: 'center', gap: 2 },
  totalValue: {
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  totalCaption: { fontSize: 13, fontWeight: '400' },
  sideRow: { flexDirection: 'row', gap: 10 },
  sidePressable: { flex: 1 },
  sideCard: {
    // Grows to match its twin, but never shrinks: `flex: 1` gave it a zero
    // basis and a shrink factor, so a page that ran even slightly tall
    // collapsed the card and Android clipped the label and the timer inside
    // its rounded bounds, leaving only the pill.
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    minHeight: 148,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  sideLabel: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  lastMark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastMarkPlaceholder: { opacity: 0 },
  lastMarkLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  sideTimer: { fontSize: 28, fontWeight: '500', fontVariant: ['tabular-nums'] },
  sidePill: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  sidePillLabel: { fontSize: 13, fontWeight: '500' },
  primary: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondary: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryLabel: { fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth },
  actionRow: { flexDirection: 'row', gap: 12 },
  bottomRow: { flexDirection: 'row', gap: 12 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  bottomLabel: { fontSize: 13, fontWeight: '400' },
  hint: { fontSize: 13, fontWeight: '400', lineHeight: 19 },
});
