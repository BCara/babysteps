import type { ComponentProps } from 'react';
import { useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Icon, Text } from 'react-native-paper';
import type QuickLogButton from './QuickLogButton';
import { useAppearance } from '../providers/AppearanceProvider';
import { careCardColors } from '../theme/careColors';

type Props = ComponentProps<typeof QuickLogButton> & {
  status?: string;
  onEditLast?: () => void;
  /** Swiping the other way reaches the form, for a log the quick action cannot make. */
  onManualEntry?: () => void;
};

// Every card is held to the height Nursing needs at its fullest — live timer
// plus both side totals — so the column reads as one stack instead of a ragged
// one. Keeping the summary to three single lines is what lets that height stay
// near what a card needed before it was fixed; 104 is the floor before the
// fullest case clips. Both are scaled with the reader's font size, and dropped
// entirely once the card stacks.
const CARD_HEIGHT = 110;
const ACTION_HEIGHT = 74;

/** Home's summary and action controls are separate touch targets. */
export default function HomeCareCard({
  title, icon, color, onPress, onLongPress, hint, summaryLabel, summaryLine,
  emphasizeSummary, stats, accessibilityHint, disabled, selected,
  quickActions = [], roundAction, status, onEditLast, onManualEntry,
}: Props) {
  const { mode } = useAppearance();
  const { width, fontScale } = useWindowDimensions();
  const swipeable = useRef<Swipeable>(null);
  const card = careCardColors(color, mode);
  const stacked = width < 380 || fontScale > 1.2;
  const actions = roundAction
    ? [...quickActions, { ...roundAction, label: 'Finish', detail: undefined, lastUsed: false }]
    : quickActions;
  const ink = { color: card.foreground };
  // Three actions share the same strip two get, so their tiles run narrower.
  const tight = actions.length > 2 && !stacked;
  const scale = Math.min(Math.max(fontScale, 1), 1.2);
  const editLast = onEditLast ?? onLongPress;
  // A running timer already says the card is live; the label under it would
  // only repeat that, and it costs a line the fixed height cannot spare.
  const showSummaryLabel = summaryLabel && !(emphasizeSummary && summaryLine);

  const body = (
    <View style={[styles.card, { backgroundColor: card.background,
      borderColor: selected ? card.selectedBorder : 'transparent' },
      stacked ? styles.stacked : { height: CARD_HEIGHT * scale }]}>
      <View style={styles.copy}>
        <Pressable onPress={onPress} onLongPress={onLongPress} disabled={disabled}
          accessibilityRole="button" accessibilityLabel={title}
          accessibilityHint={accessibilityHint} accessibilityState={{ disabled: Boolean(disabled), expanded: selected }}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
          <View style={styles.heading}>
            <View style={[styles.badge, { backgroundColor: card.badge }]}>
              <Icon source={icon} size={20} color={card.foreground} />
            </View>
            <Text style={[styles.title, ink]} numberOfLines={1}>{title}</Text>
            {status ? <View style={[styles.status, { backgroundColor: card.iconWell }]}>
              <Text style={[styles.statusText, ink]} numberOfLines={1}>{status}</Text>
            </View> : null}
          </View>
          {summaryLine ? <Text style={[styles.value, ink, emphasizeSummary && styles.largeValue]}
            numberOfLines={1}>{summaryLine}</Text> : null}
          {hint ? <Text style={[styles.hint, ink]} numberOfLines={1}>{hint}</Text> : null}
          {showSummaryLabel ? <Text style={[styles.hint, ink]} numberOfLines={1}>{summaryLabel}</Text> : null}
          {stats?.length ? <Text style={[styles.stat, ink]} numberOfLines={1}>
            {stats.map(stat =>
              `${stat.label ? `${stat.label} ` : ''}${stat.value}${stat.status ? ` · ${stat.status}` : ''}`,
            ).join('  ·  ')}
          </Text> : null}
        </Pressable>
      </View>
      {actions.length ? <View style={[styles.actions, stacked && styles.stackedActions,
        actions.length > 1 && !stacked && styles.multipleActions, tight && styles.tightActions]}>
        {actions.map((action, index) => {
          // Finishing is a different kind of act from picking a side, so it
          // gets a different shape: the same size, but round, with a tick.
          const round = Boolean(roundAction) && index === actions.length - 1;
          return <Pressable key={`${action.label}-${index}`} onPress={action.onPress}
          disabled={disabled || action.disabled} accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          accessibilityState={{ disabled: Boolean(disabled || action.disabled), selected: action.selected }}
          style={({ pressed }) => [styles.action,
            { backgroundColor: action.selected ? card.tileActive : card.tile },
            // The side in play, or the one the last feed ended on, is ringed in
            // the card's own ink. Fill alone reads as a shade of the card; a
            // border is the thing the eye finds without looking for it.
            (action.selected || action.lastUsed) && { borderColor: card.selectedBorder },
            stacked ? styles.stackedAction
              // A strip of three is square: flex sets the width, aspectRatio
              // takes the height from it. One line of copy is all that fits.
              : tight ? styles.squareAction : { height: ACTION_HEIGHT * scale },
            actions.length > 1 && styles.verticalAction, tight && styles.tightAction,
            round && styles.roundAction,
            (disabled || action.disabled) && styles.disabled, pressed && styles.pressed]}>
          <Icon
            source={action.icon}
            size={tight ? (round ? 26 : 16) : action.selected ? 24 : 21}
            color={card.foreground}
          />
          <View style={styles.actionCopy}>
            <Text style={[styles.actionLabel, ink, tight && styles.tightActionText]} numberOfLines={tight ? 1 : undefined}>{action.label}</Text>
            {action.detail ? <Text style={[styles.actionDetail, ink, tight && styles.tightActionText, tight && styles.tightDetail]} numberOfLines={tight ? 1 : undefined}>{action.detail}</Text> : null}
          </View>
          {action.lastUsed ? <View style={styles.lastUsed}><Icon source="star" size={11} color={card.foreground} /></View> : null}
        </Pressable>;
        })}
      </View> : null}
    </View>
  );

  if ((!editLast && !onManualEntry) || disabled) return body;

  // A swipe is the whole gesture, not the first half of one: the panel shows
  // what is about to happen, then it happens on release. Stopping at a button
  // to be tapped would make the shortcut slower than the card it sits on.
  const runSwipeAction = (direction: 'left' | 'right') => {
    // Act first: the screen it opens covers the row while it settles back.
    // Closing first plays that settle in full before anything happens, which
    // reads as the card bouncing and then changing its mind.
    if (direction === 'left') editLast?.();
    else onManualEntry?.();
    swipeable.current?.close();
  };

  const swipePanel = (
    key: 'edit' | 'manual',
    icon: string,
    label: string,
    accessibilityLabel: string,
    accessibilityHint: string,
  ) => (
    <Pressable accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // The panel stays pressable for anyone who swipes, pauses and then taps,
      // and for screen readers, which never open it by gesture at all.
      onPress={() => runSwipeAction(key === 'edit' ? 'left' : 'right')}
      style={({ pressed }) => [styles.swipeAction, key === 'manual' && styles.swipeActionRight,
        { backgroundColor: card.tile }, pressed && styles.pressed]}>
      <Icon source={icon} size={24} color={card.foreground} />
      <Text style={[styles.swipeActionText, ink]}>{label}</Text>
    </Pressable>
  );

  // Swiping the card aside reaches the entry it is summarising — the place to
  // add what the quick action could not ask for, such as how heavy a nappy was.
  // Swiping the other way reaches the form for a fresh one.
  return (
    <Swipeable ref={swipeable} friction={2}
      leftThreshold={42} overshootLeft={false}
      rightThreshold={42} overshootRight={false}
      onSwipeableWillOpen={runSwipeAction}
      renderLeftActions={editLast ? () => swipePanel(
        'edit',
        'pencil-outline',
        'Edit last',
        `Edit the last ${title.toLowerCase()} entry`,
        'Opens that entry so its details can be changed',
      ) : undefined}
      renderRightActions={onManualEntry ? () => swipePanel(
        'manual',
        'clock-edit-outline',
        'Log manually',
        `Log a ${title.toLowerCase()} by hand`,
        'Opens the form so times and details can be entered',
      ) : undefined}>
      {body}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 2, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 92, overflow: 'hidden' },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  summary: { minHeight: 44, gap: 3 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '800', flexShrink: 1 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, flexShrink: 1 },
  statusText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  value: { fontSize: 20, lineHeight: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  largeValue: { fontSize: 22, lineHeight: 28 },
  stat: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  swipeAction: { width: 104, marginRight: 10, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeActionRight: { marginRight: 0, marginLeft: 10 },
  swipeActionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  actions: { width: '43%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  multipleActions: { width: '52%' },
  stackedActions: { width: '100%' },
  // Three tiles get more of the card than one does: each is a square big
  // enough for an icon, a side and that side's running time.
  tightActions: { gap: 5, width: '62%' },
  tightAction: { padding: 3 },
  squareAction: { aspectRatio: 1 },
  roundAction: { borderRadius: 999 },
  tightActionText: { fontSize: 12, lineHeight: 14 },
  tightDetail: { fontSize: 14, lineHeight: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  // Every tile in a strip is the same size, running or not. Which one is
  // active is said with fill, not by taking width off the ones beside it.
  // The border is always there, transparent until it is earned, so marking a
  // tile never changes its size. Padding pays for it out of the fixed height.
  action: { flex: 1, minWidth: 0, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', padding: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stackedAction: { minHeight: 64 },
  verticalAction: { flexDirection: 'column', gap: 2 },
  actionCopy: { flexShrink: 1, alignItems: 'center' },
  actionLabel: { fontSize: 14, lineHeight: 18, fontWeight: '800', textAlign: 'center' },
  actionDetail: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  lastUsed: { position: 'absolute', top: 5, right: 6 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
