import { ActivityButton as Button } from './ActivityStyle';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Icon,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { useCarePalette } from '../hooks/useCarePalette';
import { TIMER_LIMIT_MINUTES, timerLimitLabel } from '../utils/timerLimits';
import { formatNursingDuration } from '../utils/breastFeed';
import { formatElapsedMinutes, formatTimerSeconds } from '../utils/feedTiming';
import EventTimeEditor from './EventTimeEditor';
import NursingTimerScreen from './NursingTimerScreen';
import NursingSavedScreen from './nursing/NursingSavedScreen';

interface ActiveFeedTimerProps {
  startTime: Date;
  endTime?: Date;
  feedType: 'breast' | 'bottle';
  breastSide?: 'left' | 'right' | 'both';
  lastBreastSide?: 'left' | 'right';
  /** The side the feed before this one finished on. */
  previousFeedSide?: 'left' | 'right';
  leftBreastDurationSeconds?: number;
  rightBreastDurationSeconds?: number;
  breastSideStartedAtMs?: number;
  completed?: boolean;
  showCloseButton?: boolean;
  onStop: () => void;
  onPause: () => void;
  onContinue: (side?: 'left' | 'right') => void;
  onClose: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  onSwitchToManual: () => void;
  onChangeBreastSide: (breastSide: 'left' | 'right') => void;
  onChangeStartTime?: (startTime: Date) => void;
  stopping?: boolean;
  cancelling?: boolean;
  switching?: boolean;
  savingSideChange?: boolean;
  changingStartTime?: boolean;
  /** Whether a sleep session is also running. */
  sleepSessionActive?: boolean;
}

export default function ActiveFeedTimer({
  startTime,
  endTime,
  feedType,
  breastSide,
  lastBreastSide,
  previousFeedSide,
  leftBreastDurationSeconds = 0,
  rightBreastDurationSeconds = 0,
  breastSideStartedAtMs,
  completed = false,
  showCloseButton = true,
  onStop,
  onPause,
  onContinue,
  onClose,
  onEdit,
  onDiscard,
  onCancel,
  onSwitchToManual,
  onChangeBreastSide,
  onChangeStartTime,
  stopping = false,
  cancelling = false,
  switching = false,
  savingSideChange = false,
  changingStartTime = false,
  sleepSessionActive = false,
}: ActiveFeedTimerProps) {
  const theme = useTheme();
  const { colors: eventColors, careInk } = useCarePalette();
  const [elapsed, setElapsed] = useState(Date.now() - startTime.getTime());

  useEffect(() => {
    if (completed) {
      setElapsed((endTime?.getTime() || Date.now()) - startTime.getTime());
      return;
    }

    setElapsed(Date.now() - startTime.getTime());
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [completed, endTime, startTime]);

  const selectedSide =
    breastSide === 'left' || breastSide === 'right'
      ? breastSide
      : lastBreastSide || '';
  const formatBreastDuration = (seconds: number) => {
    return completed
      ? formatNursingDuration(seconds)
      : formatTimerSeconds(seconds);
  };
  const activeSide =
    !completed && breastSideStartedAtMs !== undefined ? selectedSide : '';
  const paused =
    !completed &&
    feedType === 'breast' &&
    breastSideStartedAtMs === undefined;
  const liveSideSeconds =
    !completed && breastSideStartedAtMs
      ? Math.max(0, Math.floor((Date.now() - breastSideStartedAtMs) / 1000))
      : 0;
  const displayedLeftSeconds =
    leftBreastDurationSeconds + (activeSide === 'left' ? liveSideSeconds : 0);
  const displayedRightSeconds =
    rightBreastDurationSeconds +
    (activeSide === 'right' ? liveSideSeconds : 0);
  const hasTrackedSideTime =
    breastSideStartedAtMs !== undefined ||
    leftBreastDurationSeconds > 0 ||
    rightBreastDurationSeconds > 0;
  const displayedTotalElapsed =
    feedType === 'breast' && hasTrackedSideTime
      ? (displayedLeftSeconds + displayedRightSeconds) * 1_000
      : elapsed;

  // Nursing keeps its own low-light design from the moment a feed starts to
  // the moment it is saved. Bottle feeds keep the original card.
  if (feedType === 'breast' && completed) {
    return (
      <NursingSavedScreen
        startTime={startTime}
        leftSeconds={displayedLeftSeconds}
        rightSeconds={displayedRightSeconds}
        busy={stopping || cancelling || switching || savingSideChange}
        onContinue={onContinue}
        onDone={onClose}
        onEdit={onEdit}
        onDiscard={onDiscard}
      />
    );
  }

  if (feedType === 'breast' && !completed) {
    return (
      <NursingTimerScreen
        startTime={startTime}
        leftSeconds={displayedLeftSeconds}
        rightSeconds={displayedRightSeconds}
        activeSide={activeSide}
        paused={paused}
        previousFeedSide={previousFeedSide}
        sleepSessionActive={sleepSessionActive}
        busy={stopping || cancelling || switching || savingSideChange || changingStartTime}
        onBack={onClose}
        onPause={onPause}
        onSwitchSide={onChangeBreastSide}
        onFinish={onStop}
        onEditTimes={onSwitchToManual}
        onDiscard={onCancel}
        onChangeStartTime={onChangeStartTime}
      />
    );
  }

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      elevation={1}
    >
      <View style={styles.header}>
        <View>
          <Text
            variant="labelMedium"
            style={[styles.statusLabel, { color: theme.colors.primary }]}
          >
            {completed
              ? stopping
                ? 'SAVING FEED'
                : 'FEED SAVED'
              : paused
                ? 'FEED PAUSED'
                : 'FEED IN PROGRESS'}
          </Text>
          <Text variant="titleLarge" style={styles.feedTitle}>
            {feedType === 'breast' ? 'Nursing' : 'Bottle feed'}
          </Text>
        </View>
        {showCloseButton ? (
          <IconButton
            icon="close"
            size={22}
            onPress={onClose}
            accessibilityLabel="Close feed card"
            style={styles.closeButton}
          />
        ) : null}
      </View>

      {!completed && onChangeStartTime ? (
        <EventTimeEditor
          value={startTime}
          onChange={onChangeStartTime}
          label="Started"
          showDate={false}
          disabled={
            stopping ||
            cancelling ||
            switching ||
            savingSideChange ||
            changingStartTime
          }
        />
      ) : null}

      <View
        style={[
          styles.totalTimer,
          { backgroundColor: `${eventColors.feed}26` },
        ]}
      >
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          TOTAL TIME
        </Text>
        <Text variant="displaySmall" style={styles.time}>
          {completed
            ? feedType === 'breast'
              ? formatNursingDuration(displayedTotalElapsed / 1000)
              : formatElapsedMinutes(displayedTotalElapsed / 1000)
            : formatTimerSeconds(displayedTotalElapsed / 1000)}
        </Text>
        {!completed ? (
          <Text
            variant="bodySmall"
            style={[styles.limitHint, { color: theme.colors.onSurfaceVariant }]}
          >
            Stops automatically after {timerLimitLabel(TIMER_LIMIT_MINUTES.feed)}
          </Text>
        ) : null}
      </View>

      {feedType === 'breast' ? (
        <View>
          {paused ? (
            <Text variant="titleMedium" style={styles.sideHeading}>
              Nursing paused
            </Text>
          ) : null}
          <Text
            variant="bodySmall"
            style={[styles.sideHint, { color: theme.colors.onSurfaceVariant }]}
          >
            {completed
              ? 'Tap either side to continue the timer.'
              : paused
                ? 'Choose either side to continue this same feed.'
                : 'Tap the active side to pause it, or the other side to switch.'}
          </Text>
          <View style={styles.sideRow}>
            {(['left', 'right'] as const).map(side => {
              const isActive = !completed && activeSide === side;
              const sideTextColor = isActive
                ? careInk
                : theme.colors.onSurface;
              const seconds =
                side === 'left' ? displayedLeftSeconds : displayedRightSeconds;
              return (
                <Pressable
                  key={side}
                  onPress={
                    completed
                      ? () => onContinue(side)
                      : isActive
                        ? onPause
                        : () => onChangeBreastSide(side)
                  }
                  disabled={stopping || cancelling || switching}
                  accessibilityRole="button"
                  accessibilityLabel={
                    completed
                      ? `Continue nursing on the ${side} side`
                      : isActive
                        ? `Pause nursing on the ${side} side`
                        : paused
                          ? `Continue nursing on the ${side} side`
                          : `Switch to the ${side} side`
                  }
                  style={styles.sidePressable}
                >
                  {({ pressed }) => (
                    <Surface
                      style={[
                        styles.sideButton,
                        {
                          backgroundColor: isActive
                            ? eventColors.feed
                            : theme.colors.surface,
                          borderColor: isActive
                            ? eventColors.feed
                            : theme.colors.outlineVariant,
                          opacity:
                            stopping || switching ? 0.55 : pressed ? 0.8 : 1,
                        },
                      ]}
                      elevation={isActive && !pressed ? 2 : 0}
                    >
                      <View style={styles.sideNameRow}>
                        <Icon
                          source={
                            completed
                              ? 'play-circle-outline'
                              : isActive
                                ? 'record-circle'
                                : 'circle-outline'
                          }
                          size={18}
                          color={
                            isActive
                              ? careInk
                              : completed
                                ? theme.colors.primary
                                : theme.colors.onSurfaceVariant
                          }
                        />
                        <Text
                          variant="titleMedium"
                          style={[styles.sideName, { color: sideTextColor }]}
                        >
                          {side === 'left' ? 'Left' : 'Right'}
                        </Text>
                      </View>
                      <Text
                        variant="headlineMedium"
                        style={[styles.sideTime, { color: sideTextColor }]}
                      >
                        {formatBreastDuration(seconds)}
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.sideAction,
                          {
                            color: isActive
                              ? careInk
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {completed
                          ? 'TAP TO CONTINUE'
                          : isActive
                            ? 'FEEDING · TAP TO PAUSE'
                            : paused
                              ? 'TAP TO CONTINUE'
                              : 'TAP TO SWITCH'}
                      </Text>
                    </Surface>
                  )}
                </Pressable>
              );
            })}
          </View>
          {!completed ? (
            <Button
              mode="contained"
              icon="check-circle-outline"
              buttonColor={eventColors.feed}
              textColor={careInk}
              onPress={onStop}
              loading={stopping}
              disabled={
                stopping || cancelling || switching || savingSideChange
              }
              style={styles.finishNursing}
              contentStyle={styles.finishNursingContent}
            >
              Finish nursing
            </Button>
          ) : null}
        </View>
      ) : !completed ? (
        <Button
          mode="contained"
          icon="stop-circle-outline"
          buttonColor={eventColors.feed}
          textColor={careInk}
          onPress={onStop}
          loading={stopping}
          disabled={stopping || cancelling || switching || savingSideChange}
          contentStyle={styles.stopBottleContent}
        >
          Stop bottle feed
        </Button>
      ) : null}

      {completed ? (
        <View style={styles.completedActions}>
          <View style={styles.completedPrimaryActions}>
            {feedType === 'breast' ? (
              <Button
                mode="outlined"
                icon="pencil-outline"
                onPress={onEdit}
                style={styles.completedButton}
                disabled={
                  stopping || cancelling || switching || savingSideChange
                }
              >
                Edit nursing
              </Button>
            ) : null}
            <Button
              mode="outlined"
              onPress={onClose}
              style={styles.completedButton}
              disabled={
                stopping || cancelling || switching || savingSideChange
              }
            >
              Done
            </Button>
            {feedType === 'bottle' ? (
              <Button
                mode="contained"
                icon="play-circle-outline"
                buttonColor={eventColors.feed}
                textColor={careInk}
                onPress={() => onContinue()}
                style={styles.completedButton}
                loading={switching}
                disabled={stopping || cancelling || switching}
              >
                Continue bottle
              </Button>
            ) : null}
          </View>
          <Button
            mode="text"
            icon="delete-outline"
            textColor={theme.colors.error}
            onPress={onDiscard}
            loading={cancelling}
            disabled={
              stopping || cancelling || switching || savingSideChange
            }
          >
            Discard feed
          </Button>
        </View>
      ) : (
        <View style={styles.runningActions}>
          {paused ? (
            <Button
              mode="outlined"
              icon="pencil-outline"
              onPress={onEdit}
              disabled={
                stopping || cancelling || switching || savingSideChange
              }
            >
              Edit nursing
            </Button>
          ) : null}
          {!paused ? (
            <Button
              mode="outlined"
              icon="pencil-outline"
              onPress={onSwitchToManual}
              accessibilityLabel="Edit nursing times"
              disabled={
                stopping || cancelling || switching || savingSideChange
              }
            >
              Edit
            </Button>
          ) : null}
          <Button
            mode="text"
            icon="close-circle-outline"
            textColor={theme.colors.error}
            onPress={onCancel}
            loading={cancelling}
            disabled={
              stopping || cancelling || switching || savingSideChange
            }
          >
            Cancel feed
          </Button>
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusLabel: {
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  feedTitle: {
    marginTop: 2,
    fontWeight: '700',
  },
  closeButton: {
    margin: -6,
  },
  totalTimer: {
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 16,
    marginBottom: 18,
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginTop: 1,
  },
  limitHint: {
    marginTop: 4,
  },
  sideHeading: {
    fontWeight: '700',
  },
  sideHint: {
    marginTop: 2,
    lineHeight: 18,
  },
  sideRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  sidePressable: {
    flex: 1,
  },
  sideButton: {
    minHeight: 128,
    padding: 13,
    borderWidth: 2,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideName: {
    fontWeight: '700',
  },
  sideTime: {
    marginTop: 4,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  sideAction: {
    marginTop: 5,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  stopBottleContent: {
    minHeight: 54,
  },
  finishNursing: {
    marginTop: 16,
  },
  finishNursingContent: {
    minHeight: 50,
  },
  runningActions: {
    marginTop: 18,
    gap: 4,
  },
  completedActions: {
    marginTop: 18,
    gap: 4,
  },
  completedPrimaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  completedButton: {
    flex: 1,
  },
});
