import type { TimelineReview } from '../utils/timelineReview';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { Button, Icon, IconButton, Text, Surface, useTheme } from 'react-native-paper';
import { BabyEvent } from '../services/firebase/events';
import { useCarePalette } from '../hooks/useCarePalette';
import { careActionByType } from '../constants/careActions';
import { describeBreastTiming } from '../utils/breastFeed';
import { sleepLocationLabel } from '../utils/sleepLocation';
import { describeSettling } from '../utils/sleepSettling';
import { formatDiaperAmountDetail } from '../utils/diaperAmounts';

interface EventCardProps {
  review?: TimelineReview;
  onReviewMerge?: () => void;
  event: BabyEvent;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectable?: boolean;
  /** 'timeline' is the flat, time-gutter row the Activity list is built from. */
  variant?: 'card' | 'timeline';
  firstInDay?: boolean;
  lastInDay?: boolean;
}

const eventLabel = (event: BabyEvent) => {
  if (event.type === 'diaper') {
    // Home, the forms and Stats all say Wet, Mixed and Poo; the stored values
    // are older words for the same three nappies.
    const condition = event.metadata?.diaperCondition;
    return condition === 'both'
      ? 'Mixed nappy'
      : condition === 'dirty'
        ? 'Poo nappy'
        : condition === 'wet'
          ? 'Wet nappy'
          : 'Nappy';
  }
  if (event.type === 'feed') {
    // The sides and their minutes are the line underneath; the title only
    // has to say what kind of feed it was.
    return event.metadata?.feedType === 'breast' ? 'Nursing' : 'Bottle feed';
  }
  if (event.type === 'sleep') {
    return sleepLocationLabel(event.metadata?.sleepType).toLowerCase();
  }
  if (event.type === 'solids' && event.metadata?.food) return event.metadata.food;
  if (event.type === 'medication' && event.metadata?.medicineName) return event.metadata.medicineName;
  if (event.type === 'milestone' && event.metadata?.milestone) return event.metadata.milestone;
  if (event.type === 'symptom' && event.metadata?.observation) return event.metadata.observation;
  if (event.type === 'appointment' && event.metadata?.appointmentType) return event.metadata.appointmentType;
  if (event.type === 'immunization' && event.metadata?.immunization) return event.metadata.immunization;
  if (event.type === 'teething' && event.metadata?.tooth) return event.metadata.tooth;
  return careActionByType[event.type].label;
};

const eventIcon = (event: BabyEvent) =>
  event.type === 'feed' && event.metadata?.feedType === 'breast'
    ? 'mother-nurse'
    : careActionByType[event.type].icon;

const eventDetail = (event: BabyEvent) => {
  if (event.type === 'feed') {
    if (event.metadata?.feedType === 'breast') {
      const details = [];
      if (!event.endTime) details.push('In progress');
      details.push(describeBreastTiming(event));
      return details.join(' · ');
    }
    const amount = event.metadata?.amount;
    const unit = event.metadata?.unit;
    const details = [];
    if (!event.endTime) details.push('In progress');
    if (amount && unit) details.push(`${amount} ${unit}`);
    if (event.durationMinutes) details.push(`${event.durationMinutes} min`);
    return details.join(' · ');
  }
  if (event.type === 'sleep') {
    const settling = describeSettling(event.metadata);
    const details = [];
    if (!event.endTime) details.push('In progress');
    else if (event.durationMinutes) details.push(`${event.durationMinutes} min`);
    if (settling) details.push(settling);
    if (details.length) return details.join(' · ');
  }
  const metadata = event.metadata || {};
  const details: string[] = [];
  if (!event.endTime) details.push('In progress');
  if (event.durationMinutes) details.push(`${event.durationMinutes} min`);
  if (event.type === 'diaper') {
    const amountDetail = formatDiaperAmountDetail(metadata);
    if (amountDetail) details.push(amountDetail);
  }
  if (event.type === 'pumping') {
    if (metadata.pumpingSide) details.push(metadata.pumpingSide);
    if (metadata.amount && metadata.unit) details.push(`${metadata.amount} ${metadata.unit}`);
    if (metadata.storageLocation) details.push(metadata.storageLocation.replace('usedNow', 'used now'));
  }
  if (event.type === 'solids') {
    if (metadata.foodAmount) details.push(metadata.foodAmount);
    if (metadata.texture) details.push(metadata.texture.replace('fingerFood', 'finger food'));
    if (metadata.firstExposure) details.push('first exposure');
    if (metadata.allergen) details.push('allergen noted');
  }
  if (event.type === 'growth') {
    if (metadata.weightKg) details.push(`${metadata.weightKg} kg`);
    if (metadata.heightCm) details.push(`${metadata.heightCm} cm`);
    if (metadata.headCircumferenceCm) details.push(`head ${metadata.headCircumferenceCm} cm`);
  }
  if (event.type === 'potty') {
    if (metadata.pottyType) details.push(metadata.pottyType);
    if (metadata.pottyOutcome) details.push(metadata.pottyOutcome);
  }
  if (event.type === 'temperature' && metadata.temperature) details.push(`${metadata.temperature} °${metadata.temperatureUnit || 'C'}`, metadata.temperatureMethod || '');
  if (event.type === 'medication' && metadata.doseAmount) details.push(`${metadata.doseAmount} ${metadata.doseUnit || ''}`.trim());
  if ((event.type === 'appointment' || event.type === 'immunization') && metadata.provider) details.push(metadata.provider);
  if (event.type === 'appointment') {
    if (metadata.appointmentLocation) details.push(metadata.appointmentLocation);
    else if (metadata.appointmentAddress) details.push(metadata.appointmentAddress);
  }
  if (event.type === 'immunization' && metadata.immunizationLocation) {
    details.push(metadata.immunizationLocation);
  }
  return details.filter(Boolean).join(' · ');
};

export default function EventCard({
  event,
  review,
  onReviewMerge,
  onPress,
  onLongPress,
  selected = false,
  selectable = false,
  variant = 'card',
  firstInDay = false,
  lastInDay = false,
}: EventCardProps) {
  const theme = useTheme();
  const { colors: eventColors, careInk } = useCarePalette();
  const color = eventColors[event.type] || '#E0E0E0';

  // Picking a row pops a tick into its dot and washes the row in a light
  // tint, rather than repainting the whole row in a new colour.
  const selectAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [selected, selectAnim]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const reviewBlock = review ? (
    <View style={{ marginTop: 8, gap: 4 }}>
      <Text variant="labelMedium" style={{ color: review.reasons.length ? theme.colors.error : theme.colors.primary }}>
        {review.reasons.length ? 'Check this entry' : 'Possible merge'}
      </Text>
      {review.reasons.map(reason => <Text key={reason} variant="bodySmall">{reason}</Text>)}
      {review.mergeReason ? <Text variant="bodySmall">{review.mergeReason}</Text> : null}
      {review.mergeWithId && onReviewMerge ? (
        <Button compact icon="call-merge" onPress={pressEvent => { pressEvent.stopPropagation(); onReviewMerge(); }}>
          Review pair
        </Button>
      ) : null}
    </View>
  ) : null;

  const pressable = {
    onPress,
    onLongPress,
    delayLongPress: 250,
    disabled: !onPress && !onLongPress,
    accessibilityRole: (onPress || onLongPress ? 'button' : undefined) as
      | 'button'
      | undefined,
    accessibilityLabel:
      onPress || onLongPress ? `${eventLabel(event)} activity` : undefined,
    accessibilityState: selectable ? { selected } : undefined,
    accessibilityHint: selectable
      ? selected
        ? 'Tap to unselect this activity.'
        : 'Tap to add this activity to the selection.'
      : onPress && onLongPress
        ? 'Tap to edit. Hold to select activities.'
        : onLongPress
          ? 'Hold to select activities.'
          : onPress
            ? 'Opens options to edit or delete this activity.'
            : undefined,
  };

  if (variant === 'timeline') {
    // One rail down the day: the clock on the left, a dot per entry on the
    // line, and the entry itself reading as plain text beside it. In select
    // mode the dot is the checkbox, so the control sits where the eye already
    // is instead of floating at the far edge.
    return (
      <Pressable {...pressable}>
        {({ pressed }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.background },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: selectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.14],
                  }),
                },
              ]}
            />
            <Text
              variant="bodySmall"
              style={[styles.rowTime, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatTime(event.startTime)}
            </Text>
            <View style={styles.rail}>
              <View
                style={[
                  styles.railLine,
                  { backgroundColor: theme.colors.outlineVariant },
                  firstInDay && styles.railLineFromDot,
                  lastInDay && styles.railLineToDot,
                  firstInDay && lastInDay && styles.railLineHidden,
                ]}
              />
              <View
                style={[
                  styles.railDot,
                  { backgroundColor: color },
                  selectable && { borderWidth: 2, borderColor: theme.colors.outline },
                ]}
              >
                <Icon source={eventIcon(event)} size={15} color={careInk} />
                {selectable ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.checkBadge,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: selectAnim,
                        transform: [
                          {
                            scale: selectAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.4, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Icon source="check" size={17} color={theme.colors.onPrimary} />
                  </Animated.View>
                ) : null}
              </View>
            </View>
            <View
              style={[
                styles.rowContent,
                !lastInDay && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.rowHeading}>
                <Text variant="titleSmall" style={styles.label}>
                  {eventLabel(event)}
                </Text>
                {review ? (
                  <Icon
                    source={review.reasons.length ? 'alert-circle-outline' : 'call-merge'}
                    size={16}
                    color={review.reasons.length ? theme.colors.error : theme.colors.primary}
                  />
                ) : null}
              </View>
              {eventDetail(event) ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {eventDetail(event)}
                </Text>
              ) : null}
              {reviewBlock}
              {event.notes ? (
                <Text variant="bodySmall" numberOfLines={2} style={styles.notes}>
                  {event.notes}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    );
  }

  // A selected card swaps to a light container, so its contents have to swap
  // with it — text left on the page's palette all but disappears on the fill.
  const cardInk = selected
    ? theme.colors.onPrimaryContainer
    : theme.colors.onSurface;

  return (
    <Pressable {...pressable}>
      {({ pressed }) => (
        <Surface
          style={[
            styles.card,
            { borderLeftColor: color },
            review && { borderColor: review.reasons.length ? theme.colors.error : theme.colors.primary },
            selected && {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: `${theme.colors.primary}59`,
            },
            pressed && [
              styles.pressed,
              {
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
                borderColor: theme.colors.primary,
              },
            ],
          ]}
          elevation={1}
        >
          <View style={[styles.icon, { backgroundColor: color }]}>
            <Icon source={eventIcon(event)} size={24} color={careInk} />
          </View>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text
                variant="titleMedium"
                style={[styles.label, { color: cardInk }]}
              >
                {eventLabel(event)}
              </Text>
              <Text variant="bodySmall" style={[styles.time, { color: cardInk }]}>
                {formatTime(event.startTime)}
              </Text>
            </View>
            {eventDetail(event) ? (
              <Text variant="bodyMedium" style={{ color: cardInk }}>
                {eventDetail(event)}
              </Text>
            ) : null}
            {selected ? null : reviewBlock}
            {event.notes ? (
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={[styles.notes, { color: cardInk }]}
              >
                {event.notes}
              </Text>
            ) : null}
          </View>
          {selectable ? (
            <Icon
              source={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
              size={22}
              color={selected ? theme.colors.primary : theme.colors.outlineVariant}
            />
          ) : pressed && onLongPress ? (
            <View style={styles.holdIndicator}>
              <Icon
                source="gesture-tap-hold"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.primary }}
              >
                Hold
              </Text>
            </View>
          ) : onPress ? (
            <IconButton
              icon="pencil-outline"
              size={18}
              onPress={event => {
                event.stopPropagation();
                onPress();
              }}
              accessibilityLabel={`Edit ${eventLabel(event)}`}
              style={styles.editButton}
            />
          ) : null}
        </Surface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowTime: {
    width: 62,
    paddingTop: 15,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rail: {
    width: 34,
    alignItems: 'center',
  },
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  railLineFromDot: {
    top: 25,
  },
  railLineToDot: {
    height: 25,
  },
  railLineHidden: {
    display: 'none',
  },
  // Covers the dot, border and all, so the tick replaces it rather than
  // sitting on top of the icon underneath.
  checkBadge: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railDot: {
    marginTop: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    paddingLeft: 8,
    paddingVertical: 12,
    gap: 1,
  },
  rowHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    borderLeftWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.9,
  },
  holdIndicator: {
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    textTransform: 'capitalize',
  },
  time: {
    opacity: 0.62,
  },
  notes: {
    marginTop: 4,
    opacity: 0.72,
  },
  editButton: {
    margin: -6,
  },
});
