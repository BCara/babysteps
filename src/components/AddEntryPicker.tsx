import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import {
  homeCareActions,
  sanitizeHomeActions,
  type HomeActionDefinition,
  type HomeActionKey,
} from '../constants/careActions';
import { useBabies } from '../providers/BabyProvider';
import { useAppearance } from '../providers/AppearanceProvider';
import { careCardColors } from '../theme/careColors';

const COLUMNS = 3;
const GAP = 10;
/** Long enough for the sheet's slide-out to finish on Android. */
const ANDROID_CLOSE_MS = 320;

/**
 * Chooses what to add.
 *
 * The caregiver's own Home cards come first, as the same coloured tiles they
 * already know — what they log every day is one tap away. Everything else is
 * behind "More", present but out of the way.
 */
export default function AddEntryPicker({
  visible,
  title,
  onPick,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  onPick: (key: HomeActionKey) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { mode } = useAppearance();
  const { profile } = useBabies();
  const [showMore, setShowMore] = useState(false);
  const [tileWidth, setTileWidth] = useState<number>();
  // The chosen entry waits here until this sheet has fully gone. Every form
  // opens in its own native Modal, and asking for that one while this one is
  // still sliding away leaves it never shown (Android) or refused (iOS).
  const [closingWith, setClosingWith] = useState<HomeActionKey | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const activeKeys = sanitizeHomeActions(profile?.homeActions);
  const byKey = new Map(homeCareActions.map(action => [action.type, action]));
  const active = activeKeys
    .map(key => byKey.get(key))
    .filter((action): action is HomeActionDefinition => Boolean(action));
  const more = homeCareActions.filter(action => !activeKeys.includes(action.type));

  const close = () => {
    setShowMore(false);
    onDismiss();
  };

  const handOver = (key: HomeActionKey | null) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosingWith(null);
    setShowMore(false);
    if (key) onPick(key);
  };

  const pick = (key: HomeActionKey) => {
    if (closingWith) return;
    setClosingWith(key);
    // iOS reports the end of the slide through onDismiss; Android does not.
    if (Platform.OS !== 'ios') {
      closeTimer.current = setTimeout(() => handOver(key), ANDROID_CLOSE_MS);
    }
  };

  const tile = (action: HomeActionDefinition, emphasised: boolean) => {
    const card = careCardColors(action.color, mode);
    return (
      <Pressable
        key={action.type}
        onPress={() => pick(action.type)}
        accessibilityRole="button"
        accessibilityLabel={`Add ${action.label.toLowerCase()}`}
        style={({ pressed }) => [
          styles.tile,
          tileWidth ? { width: tileWidth } : styles.tileFallback,
          emphasised
            ? { backgroundColor: card.background }
            : {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.outlineVariant,
                borderWidth: StyleSheet.hairlineWidth,
              },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.badge,
            { backgroundColor: emphasised ? card.badge : card.background },
          ]}
        >
          <Icon source={action.icon} size={22} color={card.foreground} />
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.tileLabel,
            { color: emphasised ? card.foreground : theme.colors.onSurface },
          ]}
        >
          {action.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible && !closingWith}
      transparent
      animationType="slide"
      onRequestClose={close}
      onDismiss={() => {
        if (closingWith) handOver(closingWith);
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.grab, { backgroundColor: theme.colors.outlineVariant }]} />
        <Text variant="titleLarge" style={styles.title}>
          {title}
        </Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={styles.grid}
            onLayout={event =>
              setTileWidth(
                Math.floor(
                  (event.nativeEvent.layout.width - GAP * (COLUMNS - 1)) / COLUMNS,
                ),
              )
            }
          >
            {active.map(action => tile(action, true))}
          </View>

          {more.length ? (
            <Pressable
              onPress={() => setShowMore(value => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showMore }}
              style={styles.moreRow}
            >
              <Text style={[styles.moreText, { color: theme.colors.onSurfaceVariant }]}>
                {showMore ? 'Fewer' : `More (${more.length})`}
              </Text>
              <Icon
                source={showMore ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
          ) : null}

          {showMore ? (
            <View style={styles.grid}>{more.map(action => tile(action, false))}</View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 10 },
  title: { fontWeight: '800', marginTop: 12, marginBottom: 14 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tileFallback: { flexBasis: 96, flexGrow: 1 },
  tile: {
    minHeight: 84,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 14, fontWeight: '700' },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  moreText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
