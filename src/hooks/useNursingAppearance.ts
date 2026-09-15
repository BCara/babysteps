import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import {
  MODE_FADE_MS,
  activityTokens,
  nursingTokenKeys,
  type ActivityHue,
  type NursingMode,
  type NursingTokens,
} from '../theme/nursingTheme';

/** Animated colour for every token, interpolated between the two palettes. */
export type AnimatedNursingTokens = Record<
  keyof NursingTokens,
  Animated.AnimatedInterpolation<string>
>;

/**
 * Cross-fades one activity's palette over MODE_FADE_MS when the mode changes.
 *
 * Interpolating each token on one driver means colour is the only thing that
 * can move: layout, radii and shape are structurally identical in both modes.
 * The hue never animates — an activity does not change identity mid-session.
 */
export const useAnimatedActivityTokens = (
  hue: ActivityHue,
  mode: NursingMode,
  palette = activityTokens[hue],
) => {
  const progress = useRef(
    new Animated.Value(mode === 'night' ? 1 : 0),
  ).current;

  const previousMode = useRef(mode);
  useEffect(() => {
    // The initial Animated.Value already matches the palette. Starting an
    // identical 400 ms animation on mount only occupies the JS thread.
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const animation = Animated.timing(progress, {
      toValue: mode === 'night' ? 1 : 0,
      duration: MODE_FADE_MS,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [mode, progress]);

  return useMemo(
    () =>
      Object.fromEntries(
        nursingTokenKeys.map(key => [
          key,
          progress.interpolate({
            inputRange: [0, 1],
            outputRange: [
              palette.standard[key],
              palette.night[key],
            ],
          }),
        ]),
      ) as AnimatedNursingTokens,
    [palette, progress],
  );
};

export const useAnimatedNursingTokens = (mode: NursingMode) =>
  useAnimatedActivityTokens('nursing', mode);
