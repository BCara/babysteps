import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Surface, Text } from 'react-native-paper';
import { careCardColors } from '../theme/careColors';
import { useAppearance } from '../providers/AppearanceProvider';

interface QuickCareStat {
  label?: string;
  value: string;
  status?: string;
  highlighted?: boolean;
}

interface QuickCareAction {
  label: string;
  detail?: string;
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  selected?: boolean;
  /**
   * Marks the choice the previous session finished on — the same star the
   * nursing screen puts on a side card, so the two agree about "last".
   */
  lastUsed?: boolean;
}

interface QuickLogButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
  hint?: string;
  summaryLabel?: string;
  summaryLabelBelow?: boolean;
  summaryLine?: string;
  emphasizeSummary?: boolean;
  stats?: QuickCareStat[];
  accessibilityHint?: string;
  disabled?: boolean;
  selected?: boolean;
  quickActions?: QuickCareAction[];
  /** Circular icon with a full-height touch area at the card's right edge. */
  roundAction?: Omit<QuickCareAction, 'label' | 'detail'>;
  compactActions?: boolean;
}

export default function QuickLogButton({
  title,
  icon,
  color,
  onPress,
  onLongPress,
  hint,
  summaryLabel = '',
  summaryLabelBelow = false,
  summaryLine,
  emphasizeSummary = false,
  stats,
  accessibilityHint,
  disabled = false,
  selected = false,
  quickActions,
  roundAction,
  compactActions = false,
}: QuickLogButtonProps) {
  const longPressTriggered = useRef(false);
  const { mode } = useAppearance();
  const card = careCardColors(color, mode);
  const ink = card.foreground;

  return (
    <Pressable
      onPressIn={() => {
        longPressTriggered.current = false;
      }}
      onPress={() => {
        if (!longPressTriggered.current) onPress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              longPressTriggered.current = true;
              onLongPress();
            }
          : undefined
      }
      delayLongPress={400}
      disabled={disabled}
      style={styles.wrapper}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, expanded: selected }}
    >
      {({ pressed }) => (
        <Surface
          style={[
            styles.card,
            selected && { borderColor: card.selectedBorder },
            {
              backgroundColor: card.background,
              opacity: disabled ? 0.55 : pressed ? 0.86 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          elevation={pressed || selected ? 1 : 2}
        >
          <View style={styles.summaryColumn}>
            <View style={styles.titleRow}>
              <View style={[styles.iconBadge, { backgroundColor: card.badge }]}>
                <Icon source={icon} size={21} color={ink} />
              </View>
              <Text variant="titleMedium" style={[styles.title, { color: ink }]}>
                {title}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              {summaryLabel && !summaryLabelBelow ? (
                <Text
                  variant="labelSmall"
                  style={[styles.summaryLabel, { color: ink }]}
                >
                  {summaryLabel.toUpperCase()}
                </Text>
              ) : null}
              {summaryLine ? (
                <Text
                  variant="labelMedium"
                  style={[
                    styles.summaryLine,
                    { color: ink },
                    emphasizeSummary && styles.emphasizedSummaryLine,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {summaryLine}
                </Text>
              ) : null}
              {hint ? (
                <Text
                  variant="bodyMedium"
                  style={[styles.hint, { color: ink }]}
                  numberOfLines={2}
                >
                  {hint}
                </Text>
              ) : null}
              {stats?.length
                ? stats.map(stat => (
                  <View
                    key={stat.label || stat.value}
                    style={[
                      styles.stat,
                      stat.highlighted && styles.highlightedStat,
                    ]}
                  >
                    {stat.label ? (
                      <Text
                        variant="labelMedium"
                        style={[styles.statLabel, { color: ink }]}
                      >
                        {stat.label}
                      </Text>
                    ) : null}
                    <Text
                      variant="labelMedium"
                      style={[styles.statValue, { color: ink }]}
                      numberOfLines={2}
                    >
                      {stat.value}
                    </Text>
                    {stat.status ? (
                      <Text
                        variant="labelSmall"
                        style={[styles.statStatus, { color: ink }]}
                      >
                        {stat.status}
                      </Text>
                    ) : null}
                  </View>
                  ))
                : null}
              {summaryLabel && summaryLabelBelow ? (
                <Text
                  variant="labelSmall"
                  style={[
                    styles.summaryLabel,
                    styles.summaryLabelBelow,
                    { color: ink },
                  ]}
                >
                  {summaryLabel.toUpperCase()}
                </Text>
              ) : null}
            </View>
          </View>

          {quickActions?.length ? (
            <View
              style={[
                styles.quickActions,
                quickActions.length === 2 && styles.quickActionsPair,
                quickActions.length === 3 && styles.quickActionsTriple,
                quickActions.length > 3 && styles.quickActionsMany,
                roundAction && styles.quickActionsWithRound,
                compactActions && styles.compactQuickActions,
              ]}
            >
              {quickActions.map(action => (
                <Pressable
                  key={action.label}
                  onPress={event => {
                    event.stopPropagation();
                    action.onPress();
                  }}
                  disabled={disabled || action.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel}
                  accessibilityState={{
                    disabled: disabled || action.disabled,
                    selected: action.selected,
                  }}
                  style={({ pressed: actionPressed }) => [
                    styles.quickAction,
                    { backgroundColor: card.tile },
                    quickActions.length === 2 && styles.quickActionPair,
                    quickActions.length === 3 && styles.quickActionTriple,
                    quickActions.length > 3 && styles.quickActionMany,
                    compactActions && styles.compactQuickAction,
                    action.selected && { backgroundColor: card.tileActive },
                    (disabled || action.disabled) && styles.disabledQuickAction,
                    actionPressed && styles.pressedQuickAction,
                  ]}
                >
                  {action.lastUsed ? (
                    <View
                      style={styles.lastMark}
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                    >
                      <Icon source="star" size={11} color={ink} />
                    </View>
                  ) : null}
                  {quickActions.length <= 2 && !compactActions ? (
                    <View
                      style={[
                        styles.quickActionIcon,
                        { backgroundColor: card.iconWell },
                      ]}
                    >
                      <Icon source={action.icon} size={20} color={ink} />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.quickActionCopy,
                      quickActions.length === 3 && styles.quickActionTripleCopy,
                      compactActions && styles.compactQuickActionCopy,
                    ]}
                  >
                    {compactActions ? (
                      <View style={styles.compactQuickActionHeader}>
                        <View
                          style={[
                            styles.quickActionIcon,
                            { backgroundColor: card.iconWell },
                          ]}
                        >
                          <Icon source={action.icon} size={20} color={ink} />
                        </View>
                        <Text
                          variant="labelMedium"
                          style={[
                            styles.quickActionLabel,
                            { color: ink },
                            styles.compactQuickActionLabel,
                          ]}
                          numberOfLines={1}
                        >
                          {action.label}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        variant="labelMedium"
                        style={[styles.quickActionLabel, { color: ink }]}
                        numberOfLines={1}
                      >
                        {action.label}
                      </Text>
                    )}
                    {action.detail ? (
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.quickActionDetail,
                          { color: ink },
                          compactActions && styles.compactQuickActionDetail,
                        ]}
                        numberOfLines={1}
                      >
                        {action.detail}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {roundAction ? (
            <Pressable
              onPress={event => {
                event.stopPropagation();
                roundAction.onPress();
              }}
              disabled={disabled || roundAction.disabled}
              accessibilityRole="button"
              accessibilityLabel={roundAction.accessibilityLabel}
              accessibilityState={{
                disabled: disabled || roundAction.disabled,
                selected: roundAction.selected,
              }}
              style={({ pressed: actionPressed }) => [
                styles.roundActionTouchArea,
                (disabled || roundAction.disabled) && styles.disabledQuickAction,
                actionPressed && styles.pressedQuickAction,
              ]}
            >
              <View pointerEvents="none" style={[
                styles.roundAction,
                { backgroundColor: roundAction.selected ? card.tileActive : card.tile },
              ]}>
                <Icon source={roundAction.icon} size={30} color={ink} />
              </View>
            </Pressable>
          ) : null}
        </Surface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  card: {
    width: '100%',
    // Nursing and Growth need the most copy space. Use that as the shared
    // height so every Quick Care card lines up without clipping their details.
    height: 100,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 9,
  },
  selectedCard: {
  },
  summaryColumn: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconBadge: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontWeight: '800',
  },
  summaryRow: {
    minHeight: 20,
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 7,
    rowGap: 2,
  },
  summaryLabel: {
    fontSize: 9,
    letterSpacing: 0.55,
    fontWeight: '800',
    opacity: 0.62,
  },
  summaryLabelBelow: {
    width: '100%',
  },
  summaryLine: {
    width: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  emphasizedSummaryLine: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  hint: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  stat: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  highlightedStat: {
    opacity: 0.9,
  },
  statLabel: {
    fontWeight: '900',
  },
  statStatus: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  statValue: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  quickActions: {
    width: 140,
    justifyContent: 'center',
    gap: 5,
  },
  quickActionsPair: {
    width: 182,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsTriple: {
    width: 182,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsWithRound: {
    width: 152,
  },
  compactQuickActions: {
    width: 140,
  },
  roundAction: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundActionTouchArea: {
    alignSelf: 'stretch',
    width: 74,
    marginTop: -9,
    marginBottom: -9,
    marginRight: -12,
    marginLeft: -4,
    paddingLeft: 4,
    paddingRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionsMany: {
    width: 138,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
  },
  quickAction: {
    flex: 1,
    minHeight: 58,
    maxHeight: 64,
    borderRadius: 13,
    paddingHorizontal: 7,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Pinned rather than laid out, so marking an action as "last" never reflows
  // the pill's label or shifts its twin beside it.
  lastMark: {
    position: 'absolute',
    top: 3,
    right: 5,
    opacity: 0.75,
  },
  quickActionPair: {
    minWidth: 0,
  },
  compactQuickAction: {
    minHeight: 58,
    maxHeight: 58,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  quickActionTriple: {
    minWidth: 0,
    minHeight: 58,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  quickActionMany: {
    flex: 0,
    width: 66,
    minHeight: 44,
  },
  quickActionIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickActionTripleCopy: {
    alignItems: 'center',
  },
  compactQuickActionCopy: {
    alignItems: 'center',
  },
  compactQuickActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  selectedQuickAction: {
  },
  disabledQuickAction: {
    opacity: 0.5,
  },
  pressedQuickAction: {
    opacity: 0.72,
  },
  quickActionLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  compactQuickActionLabel: {
    fontSize: 16,
    lineHeight: 19,
  },
  quickActionDetail: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    opacity: 0.76,
  },
  compactQuickActionDetail: {
    fontSize: 19,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    opacity: 1,
  },
});
