import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text, useTheme } from 'react-native-paper';
import { careActionByType } from '../constants/careActions';
import type { BabyEvent } from '../services/firebase/events';
import { isSameLocalDay } from '../utils/eventSummary';
import { describeBreastTiming } from '../utils/breastFeed';
import {
  blockHeight,
  canDragPlaced,
  canResizePlaced,
  clampDragDelta,
  DAY_HEIGHT,
  dragDeltaMinutes,
  draggedEventTimes,
  formatClock,
  formatHourLabel,
  minutesToOffset,
  offsetToMinutes,
  placeEvents,
  timelineEventLabel,
  timelineEventTiming,
  type PlacedEvent,
  type TimelineDragMode,
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
/** How long a block is held before it lifts off the rail, as in a calendar. */
const LIFT_DELAY_MS = 350;
/** A hold this close to a block's foot stretches it instead of moving it. */
const RESIZE_ZONE = 16;

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
  /** Opens a logged event for editing. */
  onSelectEvent?: (event: BabyEvent) => void;
  /** Bare track tapped: the hour touched, as a time on this day. */
  onAddAt?: (startTime: Date) => void;
  /** A held block let go somewhere new: the times to save for it. */
  onMoveEvent?: (
    event: BabyEvent,
    updates: Partial<Pick<BabyEvent, 'startTime' | 'endTime' | 'durationMinutes'>>,
  ) => void;
  /** A block lifted or put down, so the screen can hold its scroll still. */
  onDragActiveChange?: (active: boolean) => void;
}

interface DragState {
  key: string;
  mode: TimelineDragMode;
  delta: number;
}

export default function DayTimeline({
  events,
  day,
  eventColor,
  emptyLabel = 'Nothing logged on this day yet.',
  onSelectEvent,
  onAddAt,
  onMoveEvent,
  onDragActiveChange,
}: DayTimelineProps) {
  const theme = useTheme();
  const now = new Date();
  const nowMinutes = isSameLocalDay(day, now)
    ? now.getHours() * 60 + now.getMinutes()
    : null;

  const placed = useMemo(() => placeEvents(events, day), [events, day]);

  // Kept in a ref as well, so letting go reads the last snapped position
  // rather than the one from the render the gesture was created in.
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const lift = (item: PlacedEvent, mode: TimelineDragMode) => {
    setDrag({ key: item.key, mode, delta: 0 });
    onDragActiveChange?.(true);
  };

  const follow = (item: PlacedEvent, translationY: number) => {
    const current = dragRef.current;
    if (!current || current.key !== item.key) return;
    const delta = clampDragDelta(
      item,
      current.mode,
      dragDeltaMinutes(translationY),
      day,
    );
    // Only re-render when the block crosses a five-minute mark.
    if (delta !== current.delta) setDrag({ ...current, delta });
  };

  const drop = (item: PlacedEvent) => {
    const current = dragRef.current;
    if (!current || current.key !== item.key || current.delta === 0) return;
    onMoveEvent?.(item.event, draggedEventTimes(item, current.mode, current.delta));
  };

  const release = () => {
    if (!dragRef.current) return;
    setDrag(null);
    onDragActiveChange?.(false);
  };

  // The lifted block, redrawn at its new times so its label reads true.
  const dragged = drag ? placed.find(item => item.key === drag.key) : undefined;
  const preview = useMemo(() => {
    if (!drag || !dragged) return null;
    const updates = draggedEventTimes(dragged, drag.mode, drag.delta);
    return placeEvents([{ ...dragged.event, ...updates }], day)[0] ?? null;
  }, [drag, dragged, day]);

  // The hour tapped, rounded to the nearest five minutes: precise enough to
  // land on the right part of the day, loose enough not to pretend a fingertip
  // picked 09:37 on purpose.
  const addAtOffset = (offset: number) => {
    if (!onAddAt) return;
    const minutes = Math.round(offsetToMinutes(offset) / 5) * 5;
    const startTime = new Date(day);
    startTime.setHours(0, minutes, 0, 0);
    onAddAt(startTime);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height: DAY_HEIGHT }]}>
        {onAddAt ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={pressEvent => addAtOffset(pressEvent.nativeEvent.locationY)}
            accessibilityRole="button"
            accessibilityLabel="Add an activity"
            accessibilityHint="Adds an activity at the hour you touch"
          />
        ) : null}
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
          const isDragged = item.key === drag?.key;
          // Other blocks stay put while one is lifted; the lifted one keeps
          // its gesture so the drag is not cut off mid-way.
          const draggable =
            Boolean(onMoveEvent) &&
            (!drag || isDragged) &&
            canDragPlaced(item, day);
          const resizable =
            draggable &&
            canResizePlaced(item) &&
            blockHeight(item.spanMinutes) >= TIMING_HEIGHT;
          return (
            <TimelineBlock
              key={item.key}
              item={item}
              color={eventColor(item.event)}
              ghost={isDragged}
              draggable={draggable}
              resizable={resizable}
              onSelect={onSelectEvent}
              onLift={lift}
              onFollow={follow}
              onDrop={drop}
              onRelease={release}
            />
          );
        })}

        {drag && preview ? (
          <>
            <TimelineBlock
              item={{ ...preview, key: `${preview.key}-lifted`, lane: 0, laneCount: 1 }}
              color={eventColor(preview.event)}
              lifted
              resizable={drag.mode === 'resize'}
            />
            <View
              pointerEvents="none"
              style={[
                styles.dragRow,
                {
                  top: minutesToOffset(
                    drag.mode === 'resize'
                      ? preview.startMinutes + preview.durationMinutes
                      : preview.startMinutes,
                  ),
                },
              ]}
            >
              <View
                style={[
                  styles.dragBubble,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  style={[styles.dragBubbleText, { color: theme.colors.onPrimary }]}
                >
                  {formatClock(
                    drag.mode === 'resize' && preview.endTime
                      ? preview.endTime
                      : preview.event.startTime,
                  ).replace(/\s?([ap])\.?m\.?$/i, (_match, half: string) =>
                    half.toLowerCase(),
                  )}
                </Text>
              </View>
              <View
                style={[styles.dragLine, { backgroundColor: theme.colors.primary }]}
              />
            </View>
          </>
        ) : null}

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

interface TimelineBlockProps {
  item: PlacedEvent;
  color: string;
  /** Left behind at the old spot while its lifted copy is dragged. */
  ghost?: boolean;
  /** The copy following the finger. */
  lifted?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  onSelect?: (event: BabyEvent) => void;
  onLift?: (item: PlacedEvent, mode: TimelineDragMode) => void;
  onFollow?: (item: PlacedEvent, translationY: number) => void;
  onDrop?: (item: PlacedEvent) => void;
  onRelease?: () => void;
}

function TimelineBlock({
  item,
  color,
  ghost = false,
  lifted = false,
  draggable = false,
  resizable = false,
  onSelect,
  onLift,
  onFollow,
  onDrop,
  onRelease,
}: TimelineBlockProps) {
  const theme = useTheme();
  const height = blockHeight(item.spanMinutes);
  const laneWidth = 100 / item.laneCount;
  const timing = timelineEventTiming(item);
  const nursingTiming = describeBreastTiming(item.event);
  const showTiming = height >= TIMING_HEIGHT;
  const showNursing = Boolean(nursingTiming) && height >= NURSING_HEIGHT;
  // A block sharing its row has no room for a title and a time.
  const showStartTime = !showTiming && item.laneCount === 1;
  const label = timelineEventLabel(item.event);

  // Hold still to lift, then drag. Moving before the hold lands leaves the
  // touch to the scroll view, so the day still scrolls past the blocks.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(draggable)
    .activateAfterLongPress(LIFT_DELAY_MS)
    .onStart(gesture => {
      const mode =
        resizable && gesture.y >= height - RESIZE_ZONE ? 'resize' : 'move';
      onLift?.(item, mode);
    })
    .onUpdate(gesture => onFollow?.(item, gesture.translationY))
    .onEnd((_gesture, success) => {
      if (success) onDrop?.(item);
    })
    .onFinalize(() => onRelease?.());

  const nudge = (minutes: number) => {
    onLift?.(item, 'move');
    onFollow?.(item, minutesToOffset(minutes));
    onDrop?.(item);
    onRelease?.();
  };

  const body = (
    <Pressable
      onPress={onSelect && !lifted ? () => onSelect(item.event) : undefined}
      // Claims the hold, so lifting a block never also opens it.
      onLongPress={draggable ? () => {} : undefined}
      delayLongPress={LIFT_DELAY_MS}
      disabled={!onSelect || lifted}
      accessibilityRole={onSelect ? 'button' : undefined}
      accessibilityLabel={`${label}, ${timing}${nursingTiming ? `, ${nursingTiming}` : ''}`}
      accessibilityHint={
        onSelect
          ? draggable
            ? 'Opens this entry for editing. Hold and drag to move it'
            : 'Opens this entry for editing'
          : undefined
      }
      accessibilityActions={
        draggable
          ? [
              { name: 'earlier', label: 'Move 15 minutes earlier' },
              { name: 'later', label: 'Move 15 minutes later' },
            ]
          : undefined
      }
      onAccessibilityAction={actionEvent => {
        if (actionEvent.nativeEvent.actionName === 'earlier') nudge(-15);
        if (actionEvent.nativeEvent.actionName === 'later') nudge(15);
      }}
      pointerEvents={lifted ? 'none' : 'auto'}
      style={[
        styles.blockSlot,
        {
          top: minutesToOffset(item.startMinutes),
          height,
          left: `${item.lane * laneWidth}%`,
          width: `${laneWidth}%`,
        },
        ghost && styles.blockGhost,
        lifted && styles.blockLifted,
      ]}
    >
      <View
        style={[
          styles.block,
          {
            backgroundColor: lifted ? theme.colors.surface : `${color}1F`,
            borderColor: lifted ? color : `${color}59`,
            borderStyle: ghost ? 'dashed' : 'solid',
            // A clipped block runs on past midnight, so leave it open.
            borderBottomWidth: item.clipped ? 0 : 1,
            borderBottomLeftRadius: item.clipped ? 0 : 10,
            borderBottomRightRadius: item.clipped ? 0 : 10,
          },
          lifted && { shadowColor: color },
        ]}
      >
        {lifted ? (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: `${color}2E` }]}
          />
        ) : null}
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
            <Text variant="labelMedium" numberOfLines={1} style={styles.blockLabel}>
              {label}
            </Text>
            {showStartTime || (lifted && !showTiming) ? (
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={[styles.blockDetail, { color: theme.colors.onSurfaceVariant }]}
              >
                {formatClock(item.event.startTime)}
              </Text>
            ) : null}
          </View>
          {showTiming ? (
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={[styles.blockDetail, { color: theme.colors.onSurfaceVariant }]}
            >
              {timing}
            </Text>
          ) : null}
          {showNursing ? (
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={[styles.blockDetail, { color: theme.colors.onSurfaceVariant }]}
            >
              {nursingTiming}
            </Text>
          ) : null}
        </View>
        {resizable && !ghost ? (
          <View pointerEvents="none" style={styles.resizeGrip}>
            <View
              style={[
                styles.resizeGripBar,
                { backgroundColor: color, opacity: lifted ? 0.9 : 0.4 },
              ]}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return lifted ? body : <GestureDetector gesture={pan}>{body}</GestureDetector>;
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
  blockGhost: {
    opacity: 0.35,
  },
  blockLifted: {
    left: 0,
    width: '100%',
    zIndex: 10,
    elevation: 8,
  },
  blockAccent: {
    width: 3,
  },
  resizeGrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    alignItems: 'center',
  },
  resizeGripBar: {
    width: 22,
    height: 3,
    borderRadius: 2,
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
  dragRow: {
    position: 'absolute',
    left: -(GUTTER_WIDTH + RAIL_WIDTH),
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -10,
    height: 20,
    zIndex: 11,
  },
  dragBubble: {
    width: GUTTER_WIDTH,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragBubbleText: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dragLine: {
    flex: 1,
    height: 1.5,
    marginLeft: 4,
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
