import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { careActionByType } from '../constants/careActions';
import type { BabyEvent } from '../services/firebase/events';
import { isSameLocalDay } from '../utils/eventSummary';
import { describeBreastTiming } from '../utils/breastFeed';
import {
  blockHeight,
  DAY_HEIGHT,
  formatClock,
  formatHourLabel,
  minutesToOffset,
  placeEvents,
  timelineEventLabel,
  timelineEventTiming,
} from '../utils/dayTimeline';

/**
 * A to-scale day timeline: each block sits at its start time and covers the
 * time it actually took, so a half-hour sleep is half an hour tall. Overlapping
 * entries split the width between them.
 */

const GUTTER_WIDTH = 52;
const RAIL_WIDTH = 12;
const LANE_GAP = 5;
/** Below this height only the title fits; above it the times fit as well. */
const TIMING_HEIGHT = 40;
const NURSING_HEIGHT = 58;
/** Taller than this and the copy reads better pinned to the start time. */
const TOP_ALIGN_HEIGHT = 56;

/** Every hour line, plus the closing midnight line at the foot of the day. */
const hourLines = Array.from({ length: 25 }, (_, index) => index);
const nightBands = [
  { top: 0, height: minutesToOffset(6 * 60) },
  { top: minutesToOffset(18 * 60), height: minutesToOffset(6 * 60) },
];

const timelineEventIcon = (event: BabyEvent) =>
  event.type === 'feed'
    ? event.metadata?.feedType === 'breast'
      ? ('mother-nurse' as const)
      : ('baby-bottle-outline' as const)
    : event.type === 'diaper'
      ? ('human-baby-changing-table' as const)
      : event.type === 'sleep'
        ? ('sleep' as const)
        : careActionByType[event.type].icon;

interface DayTimelineProps {
  events: BabyEvent[];
  day: Date;
  /** Keeps block colours in step with the summary legend. */
  eventColor: (event: BabyEvent) => string;
  emptyLabel?: string;
}

export default function DayTimeline({
  events,
  day,
  eventColor,
  emptyLabel = 'Nothing logged on this day yet.',
}: DayTimelineProps) {
  const theme = useTheme();
  const now = new Date();
  const nowMinutes = isSameLocalDay(day, now)
    ? now.getHours() * 60 + now.getMinutes()
    : null;

  const placed = useMemo(() => placeEvents(events, day), [events, day]);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height: DAY_HEIGHT }]}>
        {nightBands.map(band => (
          <View
            key={band.top}
            pointerEvents="none"
            style={[
              styles.nightBand,
              {
                top: band.top,
                height: band.height,
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
          />
        ))}

        {hourLines.map(hour => {
          const major = hour % 6 === 0;
          return (
            <View
              key={hour}
              pointerEvents="none"
              style={[styles.hourRow, { top: minutesToOffset(hour * 60) }]}
            >
              <Text
                variant="labelSmall"
                style={[
                  styles.hourLabel,
                  {
                    color: major
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                    opacity: major ? 0.85 : 0.55,
                  },
                ]}
              >
                {formatHourLabel(hour)}
              </Text>
              <View
                style={[
                  styles.hourLine,
                  {
                    backgroundColor: major
                      ? theme.colors.outlineVariant
                      : theme.colors.surfaceVariant,
                  },
                ]}
              />
            </View>
          );
        })}

        {placed.map(item => {
          const color = eventColor(item.event);
          const height = blockHeight(item.spanMinutes);
          const laneWidth = 100 / item.laneCount;
          const timing = timelineEventTiming(item);
          const nursingTiming = describeBreastTiming(item.event);
          const showTiming = height >= TIMING_HEIGHT;
          const showNursing = Boolean(nursingTiming) && height >= NURSING_HEIGHT;
          // A block sharing its row has no room for a title and a time.
          const showStartTime = !showTiming && item.laneCount === 1;

          return (
            <View
              key={item.key}
              accessibilityLabel={`${timelineEventLabel(item.event)}, ${timing}${nursingTiming ? `, ${nursingTiming}` : ''}`}
              style={[
                styles.blockSlot,
                {
                  top: minutesToOffset(item.startMinutes),
                  height,
                  left: `${item.lane * laneWidth}%`,
                  width: `${laneWidth}%`,
                },
              ]}
            >
              <View
                style={[
                  styles.block,
                  {
                    backgroundColor: `${color}1F`,
                    borderColor: `${color}59`,
                    // A clipped block runs on past midnight, so leave it open.
                    borderBottomWidth: item.clipped ? 0 : 1,
                    borderBottomLeftRadius: item.clipped ? 0 : 10,
                    borderBottomRightRadius: item.clipped ? 0 : 10,
                  },
                ]}
              >
                <View style={[styles.blockAccent, { backgroundColor: color }]} />
                <View
                  style={[
                    styles.blockBody,
                    height >= TOP_ALIGN_HEIGHT && styles.blockBodyTall,
                  ]}
                >
                  <View style={styles.blockHeader}>
                    <MaterialCommunityIcons
                      name={
                        timelineEventIcon(
                          item.event,
                        ) as keyof typeof MaterialCommunityIcons.glyphMap
                      }
                      size={14}
                      color={color}
                    />
                    <Text
                      variant="labelMedium"
                      numberOfLines={1}
                      style={styles.blockLabel}
                    >
                      {timelineEventLabel(item.event)}
                    </Text>
                    {showStartTime ? (
                      <Text
                        variant="labelSmall"
                        numberOfLines={1}
                        style={[
                          styles.blockDetail,
                          { color: theme.colors.onSurfaceVariant },
                        ]}
                      >
                        {formatClock(item.event.startTime)}
                      </Text>
                    ) : null}
                  </View>
                  {showTiming ? (
                    <Text
                      variant="labelSmall"
                      numberOfLines={1}
                      style={[
                        styles.blockDetail,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {timing}
                    </Text>
                  ) : null}
                  {showNursing ? (
                    <Text
                      variant="labelSmall"
                      numberOfLines={1}
                      style={[
                        styles.blockDetail,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {nursingTiming}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}

        {nowMinutes === null ? null : (
          <View
            pointerEvents="none"
            style={[styles.nowRow, { top: minutesToOffset(nowMinutes) }]}
          >
            <Text
              variant="labelSmall"
              style={[styles.nowLabel, { color: theme.colors.primary }]}
            >
              NOW
            </Text>
            <View
              style={[styles.nowDot, { backgroundColor: theme.colors.primary }]}
            />
            <View
              style={[styles.nowLine, { backgroundColor: theme.colors.primary }]}
            />
          </View>
        )}

        {placed.length === 0 ? (
          <View pointerEvents="none" style={styles.emptyOverlay}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {emptyLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    // Room for the midnight line drawn at the very bottom of the track.
    paddingBottom: 18,
  },
  track: {
    position: 'relative',
    marginLeft: GUTTER_WIDTH + RAIL_WIDTH,
    marginRight: 12,
  },
  nightBand: {
    position: 'absolute',
    left: -RAIL_WIDTH,
    right: -6,
    opacity: 0.35,
    borderRadius: 8,
  },
  hourRow: {
    position: 'absolute',
    left: -(GUTTER_WIDTH + RAIL_WIDTH),
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    // Centres the label and rule on the hour itself.
    marginTop: -9,
    height: 18,
  },
  hourLabel: {
    width: GUTTER_WIDTH,
    textAlign: 'right',
    paddingRight: 8,
    fontVariant: ['tabular-nums'],
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginLeft: 4,
  },
  blockSlot: {
    position: 'absolute',
    paddingRight: LANE_GAP,
  },
  block: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 10,
  },
  blockAccent: {
    width: 3,
  },
  blockBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  blockBodyTall: {
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  blockLabel: {
    flexShrink: 1,
    fontWeight: '700',
  },
  blockDetail: {
    fontSize: 10,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
  },
  nowRow: {
    position: 'absolute',
    left: -(GUTTER_WIDTH + RAIL_WIDTH),
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -9,
    height: 18,
  },
  nowLabel: {
    width: GUTTER_WIDTH,
    textAlign: 'right',
    paddingRight: 8,
    fontWeight: '700',
  },
  nowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 4,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    opacity: 0.7,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: DAY_HEIGHT / 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
