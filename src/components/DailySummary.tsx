import React, { useState } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Icon, Menu, Text, Surface, useTheme } from 'react-native-paper';
import { BabyEvent } from '../services/firebase/events';
import { summarizeEvents } from '../utils/eventSummary';
import { useCarePalette } from '../hooks/useCarePalette';
import { careActionByType } from '../constants/careActions';
import {
  averageNursingSessionSeconds,
  formatNursingDuration,
  summarizeNursingSides,
} from '../utils/breastFeed';
import type { EventSummaryPeriod } from '../utils/eventSummary';

interface DailySummaryProps {
  events: BabyEvent[];
  onPress?: () => void;
  compact?: boolean;
  period?: EventSummaryPeriod;
  onPeriodChange?: (period: EventSummaryPeriod) => void;
  /** Sits inside another card, which supplies the frame and background. */
  embedded?: boolean;
  /** Text colour to use instead of the theme's, to read on that card. */
  ink?: string;
}

const formatSleep = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatNursingTime = (seconds: number) => {
  if (seconds > 0 && seconds < 60) return '<1m';
  return formatSleep(Math.floor(seconds / 60));
};

const eventName = (event: BabyEvent) => {
  if (event.type === 'diaper') return 'Nappy';
  if (event.type === 'sleep') return 'Sleep';
  if (event.type === 'feed') return event.metadata?.feedType === 'bottle' ? 'Bottle' : 'Feed';
  return careActionByType[event.type].label;
};

const formatAgo = (date: Date) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export default function DailySummary({
  events,
  onPress,
  compact = false,
  period = 'today',
  onPeriodChange,
  embedded = false,
  ink,
}: DailySummaryProps) {
  const theme = useTheme();
  const strong = ink ?? theme.colors.onSurface;
  const muted = ink ?? theme.colors.onSurfaceVariant;
  const accent = ink ?? theme.colors.primary;
  const mutedStyle = ink ? styles.mutedInk : null;
  const { width, fontScale } = useWindowDimensions();
  const roomy = width < 380 || fontScale > 1.2;
  const { colors: eventColors, careInk } = useCarePalette();
  const [periodMenuVisible, setPeriodMenuVisible] = useState(false);
  const summary = summarizeEvents(events, true);
  const nursingSides = summarizeNursingSides(events);
  const averageNursingSeconds = averageNursingSessionSeconds(events);
  const latestEvent = events.reduce<BabyEvent | null>(
    (latest, event) =>
      !latest || event.startTime > latest.startTime ? event : latest,
    null,
  );
  const status = latestEvent
    ? `${eventName(latestEvent)} ${formatAgo(latestEvent.startTime)}`
    : 'Nothing yet';
  const periodLabel = period === 'today' ? 'Today' : 'Last 24h';
  const periodAccessibleLabel =
    period === 'today' ? 'Today' : 'Last 24 hours';
  const stats = [
    {
      label: 'Feeds',
      value: String(summary.feeds),
      icon: 'baby-bottle-outline',
      color: eventColors.feed,
    },
    {
      label: 'Nappies',
      value: String(summary.diapers),
      icon: 'human-baby-changing-table',
      color: eventColors.diaper,
    },
    {
      label: 'Sleep',
      value: formatSleep(summary.sleepMinutes),
      icon: 'sleep',
      color: eventColors.sleep,
    },
  ];

  const selectPeriod = (nextPeriod: EventSummaryPeriod) => {
    setPeriodMenuVisible(false);
    onPeriodChange?.(nextPeriod);
  };

  return (
    <View
      style={[
        styles.pressable,
        compact && styles.compactPressable,
        embedded && styles.embeddedPressable,
      ]}
    >
      <Surface
        style={[
          styles.container,
          compact && styles.compactContainer,
          embedded
            ? styles.embeddedContainer
            : {
                backgroundColor: theme.colors.elevation.level1,
                borderColor: theme.colors.outlineVariant,
              },
        ]}
        elevation={0}
      >
        <View style={[styles.summaryRow, roomy && styles.wrappedSummary]}>
          <Menu
            visible={periodMenuVisible}
            onDismiss={() => setPeriodMenuVisible(false)}
            anchor={
              <Pressable
                onPress={() => setPeriodMenuVisible(true)}
                disabled={!onPeriodChange}
                accessibilityRole={onPeriodChange ? 'button' : undefined}
                accessibilityLabel={`Summary period: ${periodAccessibleLabel}`}
                accessibilityHint="Choose Today or Last 24 hours"
                style={({ pressed }) => [
                  styles.todayCopy,
                  compact && styles.compactTodayCopy,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.periodLabelRow}>
                  <Text
                    variant="titleSmall"
                    numberOfLines={2}
                    style={[styles.title, { color: strong }]}
                  >
                    {periodLabel}
                  </Text>
                  {onPeriodChange ? (
                    <Icon
                      source="menu-down"
                      size={17}
                      color={accent}
                    />
                  ) : null}
                </View>
            {!compact ? (
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={[styles.status, { color: muted }, mutedStyle]}
              >
                {status}
              </Text>
            ) : null}
              </Pressable>
            }
          >
            <Menu.Item
              title="Today"
              leadingIcon={period === 'today' ? 'check' : undefined}
              onPress={() => selectPeriod('today')}
            />
            <Menu.Item
              title="Last 24 hours"
              leadingIcon={period === 'last24Hours' ? 'check' : undefined}
              onPress={() => selectPeriod('last24Hours')}
            />
          </Menu>
          <Pressable
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${periodAccessibleLabel} summary. ${summary.feeds} feeds, ${summary.diapers} nappies, ${formatSleep(summary.sleepMinutes)} sleep. ${status}`}
            accessibilityHint="Opens the full summary"
            style={({ pressed }) => [
              styles.summaryNavigation,
              roomy && styles.fullWidth,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.statsRow}>
              {stats.map(stat => (
                <View key={stat.label} style={styles.stat}>
                  <View style={[styles.iconBadge, { backgroundColor: stat.color }]}>
                    <Icon source={stat.icon} size={15} color={careInk} />
                  </View>
                  <View>
                    <Text
                      variant="titleSmall"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.value, { color: strong }]}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={[{ color: muted }, mutedStyle]}
                    >
                      {stat.label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Icon
              source="chevron-right"
              size={20}
              color={accent}
            />
          </Pressable>
        </View>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={`${periodAccessibleLabel} breastfeeding. Average completed sitting ${averageNursingSeconds === null ? 'not available' : formatNursingDuration(averageNursingSeconds)}. Left side ${formatNursingTime(nursingSides.leftSeconds)}, right side ${formatNursingTime(nursingSides.rightSeconds)}`}
          accessibilityHint="Opens the full summary"
          style={({ pressed }) => [
            styles.nursingRow,
            roomy && styles.wrappedNursing,
            compact && styles.compactNursingRow,
            { borderTopColor: ink ? `${ink}33` : theme.colors.outlineVariant },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.nursingLabel, roomy && styles.fullWidth]}>
            <View style={[styles.sideIcon, { backgroundColor: eventColors.feed }]}>
              <Icon source="mother-nurse" size={15} color={careInk} />
            </View>
            <View style={styles.nursingLabelCopy}>
              <Text
                variant="labelMedium"
                numberOfLines={1}
                style={[styles.nursingTitle, { color: strong }]}
              >
                {compact
                  ? 'Breastfeeds'
                  : `Breastfeeding ${period === 'today' ? 'today' : 'in the last 24 hours'}`}
              </Text>
              {!compact ? <Text
                variant="labelSmall"
                numberOfLines={1}
                style={[{ color: muted }, mutedStyle]}
              >
                Avg sitting{' '}
                {averageNursingSeconds === null
                  ? '—'
                  : formatNursingDuration(averageNursingSeconds)}
              </Text> : null}
            </View>
          </View>
          {[
            ['Left', nursingSides.leftSeconds],
            ['Right', nursingSides.rightSeconds],
          ].map(([label, seconds]) => (
            <View
              key={String(label)}
              style={[
                styles.sideTotal,
                { backgroundColor: compact ? 'transparent' : `${eventColors.feed}26` },
                compact && styles.compactSideTotal,
              ]}
            >
              <Text
                variant="labelSmall"
                style={[{ color: muted }, mutedStyle]}
              >
                {label}
              </Text>
              <Text variant="titleSmall" style={[styles.sideTotalValue, { color: strong }]}>
                {formatNursingTime(Number(seconds))}
              </Text>
            </View>
          ))}
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginHorizontal: 16,
    marginTop: 9,
    marginBottom: 5,
    borderRadius: 17,
  },
  pressed: {
    opacity: 0.78,
  },
  wrappedSummary: { flexDirection: 'column', alignItems: 'stretch' },
  wrappedNursing: { flexWrap: 'wrap' },
  fullWidth: { flex: 0, width: '100%' },
  compactPressable: {
    marginTop: 4,
    marginBottom: 8,
  },
  embeddedPressable: {
    margin: 0,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  mutedInk: {
    opacity: 0.72,
  },
  embeddedContainer: {
    minHeight: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  container: {
    minHeight: 108,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compactContainer: {
    minHeight: 110,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryNavigation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
  },
  todayCopy: {
    width: 88,
    borderRadius: 10,
  },
  compactTodayCopy: {
    width: 60,
    minHeight: 48,
    justifyContent: 'center',
  },
  periodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  status: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  nursingRow: {
    minHeight: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactNursingRow: {
    minHeight: 48,
    marginTop: 10,
    paddingTop: 10,
  },
  nursingLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  nursingLabelCopy: {
    flex: 1,
  },
  sideIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nursingTitle: {
    fontWeight: '700',
  },
  sideTotal: {
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
  },
  compactSideTotal: { minWidth: 0, paddingHorizontal: 0, gap: 4 },
  sideTotalValue: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
