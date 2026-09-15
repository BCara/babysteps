import { useCarePalette } from '../../src/hooks/useCarePalette';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  Checkbox,
  Icon,
  IconButton,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuickCareConfigModal from '../../src/components/QuickCareConfigModal';
import {
  homeCareActions,
} from '../../src/constants/careActions';
import {
  ConfigurableQuickCareKey,
  QuickCarePreference,
  sanitizeQuickCarePreferences,
} from '../../src/constants/quickCarePreferences';
import { useBabies } from '../../src/providers/BabyProvider';
import {
  DashboardWidgetAction,
  defaultDashboardWidgetActions,
  defaultWatchTileActions,
  getDashboardWidgetActions,
  getWatchTileActions,
  requestWidgetPin,
  saveDashboardWidgetActions,
  saveWatchTileActions,
  supportedDashboardWidgetActions,
  supportedWatchTileActions,
  WatchTileAction,
  widgetsAreAvailable,
} from '../../src/services/widgetSettings';

const configurableQuickCareKeys = new Set<ConfigurableQuickCareKey>([
  'nursing',
  'bottle',
  'sleep',
  'diaper',
  'pumping',
]);

const isConfigurableQuickCareKey = (
  action: DashboardWidgetAction,
): action is ConfigurableQuickCareKey =>
  configurableQuickCareKeys.has(action as ConfigurableQuickCareKey);

const actionDefinition = (action: DashboardWidgetAction) => {
  const definition = homeCareActions.find(item => item.type === action);
  if (!definition) throw new Error(`Missing widget action: ${action}`);
  return definition;
};

const actionLabel = (action: DashboardWidgetAction) =>
  actionDefinition(action).label;

export default function WidgetSettingsScreen() {
  const theme = useTheme();
  const { careColor, careInk } = useCarePalette();
  const { profile, updateQuickCarePreference } = useBabies();
  const [actions, setActions] = useState<DashboardWidgetAction[]>(
    defaultDashboardWidgetActions,
  );
  const [watchActions, setWatchActions] = useState<WatchTileAction[]>(
    defaultWatchTileActions,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState<string | null>(null);
  const [configuring, setConfiguring] =
    useState<ConfigurableQuickCareKey | null>(null);
  const [message, setMessage] = useState('');
  const preferences = sanitizeQuickCarePreferences(
    profile?.quickCarePreferences,
  );
  const orderedActions = useMemo(
    () => [
      ...actions,
      ...supportedDashboardWidgetActions.filter(
        action => !actions.includes(action),
      ),
    ],
    [actions],
  );
  const orderedWatchActions = useMemo(
    () => [
      ...watchActions,
      ...supportedWatchTileActions.filter(
        action => !watchActions.includes(action),
      ),
    ],
    [watchActions],
  );

  useEffect(() => {
    let active = true;
    void getDashboardWidgetActions()
      .then(nextActions => {
        if (active) setActions(nextActions);
      })
      .catch(error => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load widget settings.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getWatchTileActions()
      .then(nextActions => {
        if (active) setWatchActions(nextActions);
      })
      .catch(error => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load watch settings.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleAction = (action: DashboardWidgetAction) => {
    setActions(current => {
      if (current.includes(action)) {
        if (current.length === 1) {
          setMessage('Keep at least one card on the dashboard widget.');
          return current;
        }
        return current.filter(item => item !== action);
      }
      if (current.length >= 4) {
        setMessage('The dashboard widget can show up to four cards.');
        return current;
      }
      return [...current, action];
    });
  };

  const moveAction = (action: DashboardWidgetAction, direction: -1 | 1) => {
    setActions(current => {
      const index = current.indexOf(action);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const toggleWatchAction = (action: WatchTileAction) => {
    setWatchActions(current => {
      if (current.includes(action)) {
        if (current.length === 1) {
          setMessage('Keep at least one activity on the Watch Tile.');
          return current;
        }
        return current.filter(item => item !== action);
      }
      if (current.length >= 4) {
        setMessage('The Watch Tile can show up to four activities.');
        return current;
      }
      return [...current, action];
    });
  };

  const moveWatchAction = (action: WatchTileAction, direction: -1 | 1) => {
    setWatchActions(current => {
      const index = current.indexOf(action);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const saveWatch = async () => {
    setSaving(true);
    try {
      const saved = await saveWatchTileActions(watchActions);
      setWatchActions(saved);
      setMessage('Watch Tile updated');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to update the Watch Tile.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveDashboard = async () => {
    setSaving(true);
    try {
      const saved = await saveDashboardWidgetActions(actions);
      setActions(saved);
      setMessage('Dashboard widget updated');
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the dashboard widget.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const addWidget = async (kind: 'dashboard' | DashboardWidgetAction) => {
    setPinning(kind);
    try {
      if (kind === 'dashboard' && !(await saveDashboard())) return;
      const requested = await requestWidgetPin(kind);
      setMessage(
        requested
          ? 'Confirm the widget placement on your Home screen.'
          : 'Open your launcher widget picker and choose PitterPatter.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to add the widget.',
      );
    } finally {
      setPinning(null);
    }
  };

  const saveQuickPreference = async (
    careKey: ConfigurableQuickCareKey,
    preference: QuickCarePreference,
  ) => {
    await updateQuickCarePreference(careKey, preference);
    setMessage(`${actionLabel(careKey)} quick behaviour saved`);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <View style={styles.topBarCopy}>
          <Text variant="titleLarge" style={styles.title}>
            Watch Tiles &amp; widgets
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Choose the care controls shown on each screen
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.noticeCard} elevation={1}>
          <Text variant="titleMedium">One Quick Care widget</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            PitterPatter now appears once in the Android widget picker. Each
            widget you add can show one activity card or your configurable
            Quick Care group.
          </Text>
        </Surface>
        {Platform.OS !== 'android' ? (
          <Surface style={styles.noticeCard} elevation={1}>
            <Text variant="titleMedium">Android only for now</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              These Home screen widgets are currently available on Android.
            </Text>
          </Surface>
        ) : !widgetsAreAvailable ? (
          <Surface style={styles.noticeCard} elevation={1}>
            <Text variant="titleMedium">App rebuild required</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              The widget controls are ready in the app, but this installed build
              does not contain the new Android widget module yet.
            </Text>
          </Surface>
        ) : null}

        <View style={styles.sectionHeading}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Watch Tile
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Choose and order one to four activities. One activity gets full
            controls directly on the Tile; two to four use the compact overview.
          </Text>
        </View>

        <Surface style={styles.dashboardCard} elevation={1}>
          {orderedWatchActions.map(action => {
            const definition = actionDefinition(action);
            const selectedIndex = watchActions.indexOf(action);
            const selected = selectedIndex >= 0;
            return (
              <View key={`watch-${action}`} style={styles.actionRow}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: careColor(definition.color) },
                  ]}
                >
                  <Icon source={definition.icon} size={24} color={careInk} />
                </View>
                <Checkbox.Android
                  status={selected ? 'checked' : 'unchecked'}
                  onPress={() => toggleWatchAction(action)}
                />
                <View style={styles.actionCopy}>
                  <Text variant="titleMedium">{actionLabel(action)}</Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {selected ? `Watch position ${selectedIndex + 1}` : 'Not on watch'}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.reorderActions}>
                    <IconButton
                      icon="arrow-up"
                      size={19}
                      disabled={selectedIndex === 0}
                      onPress={() => moveWatchAction(action, -1)}
                    />
                    <IconButton
                      icon="arrow-down"
                      size={19}
                      disabled={selectedIndex === watchActions.length - 1}
                      onPress={() => moveWatchAction(action, 1)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          <Text
            variant="bodySmall"
            style={[styles.watchHint, { color: theme.colors.onSurfaceVariant }]}
          >
            You can also add separate Nursing, Bottle, Sleep and Nappy Tiles
            from the watch Tile picker, then swipe between them.
          </Text>
          <View style={styles.dashboardButtons}>
            <Button
              mode="contained"
              icon="watch-variant"
              onPress={() => void saveWatch()}
              loading={saving}
              disabled={loading || saving || Boolean(pinning)}
            >
              Save Watch Tile
            </Button>
          </View>
        </Surface>

        <View style={styles.sectionHeading}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Group widget
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Pick up to four cards. The widget shows each card's latest status
            as well as its Quick Care shortcut.
          </Text>
        </View>

        <Surface style={styles.dashboardCard} elevation={1}>
          {orderedActions.map(action => {
            const definition = actionDefinition(action);
            const selectedIndex = actions.indexOf(action);
            const selected = selectedIndex >= 0;
            return (
              <View key={action} style={styles.actionRow}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: careColor(definition.color) },
                  ]}
                >
                  <Icon source={definition.icon} size={24} color={careInk} />
                </View>
                <Checkbox.Android
                  status={selected ? 'checked' : 'unchecked'}
                  onPress={() => toggleAction(action)}
                />
                <View style={styles.actionCopy}>
                  <Text variant="titleMedium">{actionLabel(action)}</Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {selected ? `Card ${selectedIndex + 1}` : 'Not on dashboard'}
                  </Text>
                </View>
                {selected ? (
                  <View style={styles.reorderActions}>
                    <IconButton
                      icon="arrow-up"
                      size={19}
                      disabled={selectedIndex === 0}
                      onPress={() => moveAction(action, -1)}
                      accessibilityLabel={`Move ${actionLabel(action)} earlier`}
                    />
                    <IconButton
                      icon="arrow-down"
                      size={19}
                      disabled={selectedIndex === actions.length - 1}
                      onPress={() => moveAction(action, 1)}
                      accessibilityLabel={`Move ${actionLabel(action)} later`}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={styles.dashboardButtons}>
            <Button
              mode="outlined"
              icon="content-save-outline"
              onPress={() => void saveDashboard()}
              loading={saving && pinning !== 'dashboard'}
              disabled={loading || saving || Boolean(pinning)}
            >
              Save layout
            </Button>
            <Button
              mode="contained"
              icon="widgets-outline"
              onPress={() => void addWidget('dashboard')}
              loading={pinning === 'dashboard'}
              disabled={loading || saving || Boolean(pinning)}
            >
              Add group widget
            </Button>
          </View>
        </Surface>

        <View style={styles.sectionHeading}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Single activity card
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Choose the activity for each widget you add. The card includes its
            latest status, details, running timer, and available Quick Care
            controls where the widget size allows.
          </Text>
        </View>

        <View style={styles.singleWidgetList}>
          {supportedDashboardWidgetActions.map(action => {
            const definition = actionDefinition(action);
            const configurable = isConfigurableQuickCareKey(action);
            const preference = configurable ? preferences[action] : undefined;
            return (
              <Surface key={action} style={styles.singleWidgetCard} elevation={1}>
                <View
                  style={[
                    styles.singleWidgetIcon,
                    { backgroundColor: careColor(definition.color) },
                  ]}
                >
                  <Icon source={definition.icon} size={28} color={careInk} />
                </View>
                <View style={styles.actionCopy}>
                  <Text variant="titleMedium">{actionLabel(action)}</Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {configurable
                      ? preference?.mode === 'specific'
                        ? 'Specific quick action'
                        : 'Follows your latest choice'
                      : 'Opens the activity form'}
                  </Text>
                </View>
                {configurable ? (
                  <IconButton
                    icon="tune-variant"
                    onPress={() => setConfiguring(action)}
                    accessibilityLabel={`Configure ${actionLabel(action)}`}
                  />
                ) : null}
                <Button
                  mode="outlined"
                  compact
                  icon="plus"
                  onPress={() => void addWidget(action)}
                  loading={pinning === action}
                  disabled={Boolean(pinning)}
                >
                  Add
                </Button>
              </Surface>
            );
          })}
        </View>

        <Text
          variant="bodySmall"
          style={[styles.help, { color: theme.colors.onSurfaceVariant }]}
        >
          If your launcher does not show the add prompt, long-press an empty
          area of the Home screen, choose Widgets, then PitterPatter.
        </Text>
      </ScrollView>

      <QuickCareConfigModal
        visible={Boolean(configuring)}
        careKey={configuring}
        preference={configuring ? preferences[configuring] : undefined}
        onClose={() => setConfiguring(null)}
        onSave={saveQuickPreference}
      />
      <Snackbar
        visible={Boolean(message)}
        onDismiss={() => setMessage('')}
        duration={4000}
      >
        {message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    minHeight: 70,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarCopy: { flex: 1 },
  title: { fontWeight: '800' },
  content: { padding: 18, paddingBottom: 40 },
  noticeCard: { borderRadius: 18, padding: 16, gap: 5, marginBottom: 20 },
  sectionHeading: { gap: 4, marginBottom: 12 },
  sectionTitle: { fontWeight: '800' },
  dashboardCard: {
    borderRadius: 22,
    padding: 10,
    marginBottom: 28,
  },
  watchHint: { paddingHorizontal: 8, paddingTop: 8, lineHeight: 18 },
  actionRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  actionCopy: { flex: 1, minWidth: 0 },
  reorderActions: { flexDirection: 'row' },
  dashboardButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 8,
  },
  singleWidgetList: { gap: 10 },
  singleWidgetCard: {
    minHeight: 76,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  singleWidgetIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  help: { marginTop: 18, lineHeight: 19 },
});
