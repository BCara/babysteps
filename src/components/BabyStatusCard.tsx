import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useCarePalette } from '../hooks/useCarePalette';
import { useAppearance } from '../providers/AppearanceProvider';
import type { eventColors } from '../theme/eventColors';
import type { BabyStatus, BabyStatusPose } from '../utils/babyStatus';

const koalas: Record<BabyStatusPose, ImageSourcePropType> = {
  sleep: require('../../assets/koala/sleep.png'),
  breastfeed: require('../../assets/koala/breastfeed.png'),
  bottle: require('../../assets/koala/bottle_feed.png'),
  pumping: require('../../assets/koala/pumping.png'),
  awake: require('../../assets/koala/tummy_time.png'),
  hello: require('../../assets/koala/milestones.png'),
  nappy: require('../../assets/koala/nappy.png'),
  solids: require('../../assets/koala/solids.png'),
  measurement: require('../../assets/koala/growth.png'),
  potty: require('../../assets/koala/potty.png'),
  temperature: require('../../assets/koala/temperature.png'),
  medicine: require('../../assets/koala/medicine.png'),
  tummyTime: require('../../assets/koala/tummy_time.png'),
  bath: require('../../assets/koala/bath.png'),
  milestone: require('../../assets/koala/milestones.png'),
  observation: require('../../assets/koala/observations.png'),
  appointment: require('../../assets/koala/appointments.png'),
  immunisation: require('../../assets/koala/immunisations.png'),
  teething: require('../../assets/koala/teething.png'),
};

const tints: Record<BabyStatusPose, keyof typeof eventColors> = {
  sleep: 'sleep',
  breastfeed: 'feed',
  bottle: 'feed',
  pumping: 'pumping',
  awake: 'tummyTime',
  hello: 'milestone',
  nappy: 'diaper',
  solids: 'solids',
  measurement: 'growth',
  potty: 'potty',
  temperature: 'temperature',
  medicine: 'medication',
  tummyTime: 'tummyTime',
  bath: 'bath',
  milestone: 'milestone',
  observation: 'symptom',
  appointment: 'appointment',
  immunisation: 'immunization',
  teething: 'teething',
};

/**
 * Each pose gets a small idle loop that suits it: a sleeping koala breathes
 * slowly, a feeding one rocks, everything else bobs as if pleased with itself.
 */
type Motion = 'breathe' | 'rock' | 'bob';
const motionFor = (pose: BabyStatusPose): Motion =>
  pose === 'sleep'
    ? 'breathe'
    : pose === 'breastfeed' || pose === 'bottle' || pose === 'pumping'
      ? 'rock'
      : 'bob';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => mounted && setReduce(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function AnimatedKoala({ pose }: { pose: BabyStatusPose }) {
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const motion = motionFor(pose);

  // A fresh pose pops in so the change of status is noticed.
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const anim = Animated.spring(enter, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [pose, reduceMotion, enter]);

  useEffect(() => {
    idle.setValue(0);
    if (reduceMotion) return;
    const duration = motion === 'breathe' ? 1800 : motion === 'rock' ? 1100 : 700;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
        // The bob rests between hops instead of bouncing nonstop.
        Animated.delay(motion === 'bob' ? 1600 : 0),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion, reduceMotion, idle]);

  const idleTransform =
    motion === 'breathe'
      ? [
          { translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) },
          { scale: idle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
        ]
      : motion === 'rock'
        ? [{ rotate: idle.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }]
        : [{ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }];

  return (
    <Animated.Image
      source={koalas[pose]}
      resizeMode="contain"
      style={[
        styles.koala,
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            ...idleTransform,
          ],
        },
      ]}
    />
  );
}

interface BabyStatusCardProps {
  status: BabyStatus;
  /** How old the baby is, shown under the status. */
  age?: string | null;
  /** The date and other controls, along the top of the card. */
  header?: React.ReactNode;
  /** The day's overview, set into the bottom of the card. */
  children?: React.ReactNode;
}

/**
 * The top of Home: who is being cared for, what they are doing now, and how
 * the day is going, on the colour of the current activity.
 */
export default function BabyStatusCard({ status, age, header, children }: BabyStatusCardProps) {
  const theme = useTheme();
  const { mode } = useAppearance();
  const { colors, careInk } = useCarePalette();

  return (
    <Surface
      style={[
        styles.card,
        { backgroundColor: colors[tints[status.pose]], borderColor: theme.colors.outlineVariant },
      ]}
      elevation={0}
    >
      {header ? <View style={styles.header}>{header}</View> : null}
      <View
        style={styles.statusRow}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={[status.title, status.detail, age && `${age} old`].filter(Boolean).join('. ')}
      >
        <AnimatedKoala pose={status.pose} />
        <View style={styles.copy}>
          <Text variant="headlineSmall" style={[styles.title, { color: careInk }]} numberOfLines={3}>
            {status.title}
          </Text>
          {status.detail ? (
            <Text variant="bodyMedium" style={[styles.detail, { color: careInk }]}>
              {status.detail}
            </Text>
          ) : null}
          {age ? (
            <Text variant="labelLarge" style={[styles.age, { color: careInk }]}>
              {age} old
            </Text>
          ) : null}
        </View>
      </View>
      {children ? (
        <View
          style={[
            styles.overview,
            // Follows the care palette rather than the app theme: the card
            // stays pastel in dark mode and only darkens at night.
            { backgroundColor: mode === 'night' ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.6)' },
          ]}
        >
          {children}
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  koala: {
    width: 156,
    height: 140,
  },
  overview: {
    marginTop: 4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontWeight: '700',
  },
  detail: {
    lineHeight: 20,
    opacity: 0.8,
  },
  age: {
    marginTop: 4,
    opacity: 0.7,
  },
});
