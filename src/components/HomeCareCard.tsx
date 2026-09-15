import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type QuickLogButton from './QuickLogButton';
import { useAppearance } from '../providers/AppearanceProvider';
import { careCardColors } from '../theme/careColors';

type Props = ComponentProps<typeof QuickLogButton> & {
  status?: string;
  onEditLast?: () => void;
};

/** Home's summary and action controls are separate touch targets. */
export default function HomeCareCard({
  title, icon, color, onPress, onLongPress, hint, summaryLabel, summaryLine,
  emphasizeSummary, stats, accessibilityHint, disabled, selected,
  quickActions = [], roundAction, status, onEditLast,
}: Props) {
  const { mode } = useAppearance();
  const { width, fontScale } = useWindowDimensions();
  const card = careCardColors(color, mode);
  const stacked = title === 'Nursing' || width < 380 || fontScale > 1.2;
  const actions = roundAction
    ? [...quickActions, { ...roundAction, label: 'Finish', icon: 'stop', detail: undefined, lastUsed: false }]
    : quickActions;
  const ink = { color: card.foreground };

  return (
    <View style={[styles.card, { backgroundColor: card.background,
      borderColor: selected ? card.selectedBorder : 'transparent' },
      stacked && styles.stacked]}>
      <View style={styles.copy}>
        <Pressable onPress={onPress} onLongPress={onLongPress} disabled={disabled}
          accessibilityRole="button" accessibilityLabel={title}
          accessibilityHint={accessibilityHint} accessibilityState={{ disabled: Boolean(disabled), expanded: selected }}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
          <View style={styles.heading}>
            <View style={[styles.badge, { backgroundColor: card.badge }]}>
              <Icon source={icon} size={22} color={card.foreground} />
            </View>
            <Text style={[styles.title, ink]}>{title}</Text>
            {status ? <View style={[styles.status, { backgroundColor: card.iconWell }]}>
              <Text style={[styles.statusText, ink]}>{status}</Text>
            </View> : null}
          </View>
          {summaryLine ? <Text style={[styles.value, ink, emphasizeSummary && styles.largeValue]}>{summaryLine}</Text> : null}
          {hint ? <Text style={[styles.hint, ink]}>{hint}</Text> : null}
          {summaryLabel ? <Text style={[styles.hint, ink]}>{summaryLabel}</Text> : null}
          {stats?.length ? <View style={styles.stats}>
            {stats.map(stat => <Text key={stat.label || stat.value} style={[styles.stat, ink]}>
              {stat.label ? `${stat.label} ` : ''}{stat.value}{stat.status ? ` · ${stat.status}` : ''}
            </Text>)}
          </View> : null}
        </Pressable>
        {onEditLast ? <Pressable onPress={onEditLast} disabled={disabled}
          accessibilityRole="button" accessibilityLabel={`Edit last ${title.toLowerCase()} entry`}
          accessibilityState={{ disabled: Boolean(disabled) }}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}>
          <Icon source="pencil-outline" size={17} color={card.foreground} />
          <Text style={[styles.editText, ink]}>Edit last</Text>
        </Pressable> : null}
      </View>
      {actions.length ? <View style={[styles.actions, stacked && styles.stackedActions,
        actions.length > 1 && !stacked && styles.multipleActions]}>
        {actions.map((action, index) => <Pressable key={`${action.label}-${index}`} onPress={action.onPress}
          disabled={disabled || action.disabled} accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          accessibilityState={{ disabled: Boolean(disabled || action.disabled), selected: action.selected }}
          style={({ pressed }) => [styles.action,
            { backgroundColor: action.selected ? card.tileActive : card.tile },
            actions.length > 1 && styles.verticalAction,
            (disabled || action.disabled) && styles.disabled, pressed && styles.pressed]}>
          <Icon source={action.icon} size={23} color={card.foreground} />
          <View style={styles.actionCopy}>
            <Text style={[styles.actionLabel, ink]}>{action.label}</Text>
            {action.detail ? <Text style={[styles.actionDetail, ink]}>{action.detail}</Text> : null}
          </View>
          {action.lastUsed ? <View style={styles.lastUsed}><Icon source="star" size={11} color={card.foreground} /></View> : null}
        </Pressable>)}
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 2, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 108 },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  copy: { flex: 1, minWidth: 0 },
  summary: { minHeight: 48, gap: 5 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', flexShrink: 1 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  statusText: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  value: { fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  largeValue: { fontSize: 28 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { fontSize: 14, fontWeight: '600' },
  edit: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  editText: { fontSize: 13, fontWeight: '700' },
  actions: { width: '43%', flexDirection: 'row', gap: 6 },
  multipleActions: { width: '55%' },
  stackedActions: { width: '100%' },
  action: { flex: 1, minWidth: 0, minHeight: 64, borderRadius: 16, padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  verticalAction: { flexDirection: 'column', gap: 4 },
  actionCopy: { flexShrink: 1, alignItems: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  actionDetail: { fontSize: 13, textAlign: 'center' },
  lastUsed: { position: 'absolute', top: 5, right: 6 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
