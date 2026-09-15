import { useCarePalette } from '../hooks/useCarePalette';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, Surface, Switch, Text, useTheme } from 'react-native-paper';
import {
  orderHomeCareActionsForCustomising,
  type HomeActionKey,
} from '../constants/careActions';

interface Props {
  visible: boolean;
  actions: HomeActionKey[];
  saving?: boolean;
  onChange: (actions: HomeActionKey[]) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function HomeActionsModal({ visible, actions, saving, onChange, onClose, onSave }: Props) {
  const theme = useTheme();
  const { careColor, careInk } = useCarePalette();
  if (!visible) return null;

  const orderedActions = orderHomeCareActionsForCustomising(actions);
  const toggle = (type: HomeActionKey) => {
    onChange(actions.includes(type) ? actions.filter(item => item !== type) : [...actions, type]);
  };
  const move = (type: HomeActionKey, offset: -1 | 1) => {
    const index = actions.indexOf(type);
    const nextIndex = index + offset;
    if (index < 0 || nextIndex < 0 || nextIndex >= actions.length) return;
    const next = [...actions];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Surface style={[styles.sheet, { backgroundColor: theme.colors.surface }]} elevation={5}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text variant="titleLarge" style={styles.title}>Customise Home</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Choose quick actions and arrange enabled items with the arrows.
              </Text>
            </View>
            <IconButton icon="close" onPress={onClose} disabled={saving} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {orderedActions.map(action => {
              const enabled = actions.includes(action.type);
              const index = actions.indexOf(action.type);
              return (
                <View key={action.type} style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: careColor(action.color) }]}>
                    <Icon source={action.icon} size={22} color={careInk} />
                  </View>
                  <View style={styles.copy}>
                    <Text variant="titleSmall">{action.label}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{action.category}</Text>
                  </View>
                  {enabled ? (
                    <View style={styles.orderButtons}>
                      <IconButton icon="chevron-up" size={19} onPress={() => move(action.type, -1)} disabled={index === 0} />
                      <IconButton icon="chevron-down" size={19} onPress={() => move(action.type, 1)} disabled={index === actions.length - 1} />
                    </View>
                  ) : null}
                  <Switch value={enabled} onValueChange={() => toggle(action.type)} />
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Text variant="bodySmall" style={[styles.footerHint, { color: theme.colors.onSurfaceVariant }]}>
              At least one action is required.
            </Text>
            <Button mode="contained" onPress={onSave} loading={saving} disabled={saving || actions.length === 0}>Save layout</Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  header: { paddingLeft: 20, paddingTop: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  title: { fontWeight: '800', marginBottom: 3 },
  content: { paddingHorizontal: 16, paddingBottom: 10 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  orderButtons: { flexDirection: 'row' },
  footer: { padding: 16, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerHint: { flex: 1 },
});
