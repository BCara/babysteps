import { createContext, useContext, useMemo, type ComponentProps, type PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { PaperProvider, TextInput as PaperInput, SegmentedButtons as PaperSegments, Button as PaperButton } from 'react-native-paper';
import { useAppearance } from '../providers/AppearanceProvider';
import { buildAppTheme } from '../theme/appTheme';
import { careScreenTokens } from '../theme/careScreenTheme';
import { NursingPrimaryAction, NursingBottomRow, useActivityChrome, type NursingChrome } from './nursing/NursingChrome';
import { NursingTextField, NursingChoice } from './nursing/NursingFields';

const ActivityStyleContext = createContext<NursingChrome | null>(null);
export const useCareScreenStyle = () => useContext(ActivityStyleContext);

export function ActivityStyle({ color, children }: PropsWithChildren<{ color: string }>) {
  const { mode } = useAppearance();
  const chrome = useActivityChrome('nursing', color);
  const theme = useMemo(() => ({ ...buildAppTheme(careScreenTokens(color)[mode]), roundness: 16 }), [color, mode]);
  return <ActivityStyleContext.Provider value={chrome}><PaperProvider theme={theme}>{children}</PaperProvider></ActivityStyleContext.Provider>;
}

export function ActivityTextInput(props: ComponentProps<typeof PaperInput>) {
  const chrome = useCareScreenStyle();
  if (!chrome || typeof props.label !== 'string' || props.left || props.right) return <PaperInput {...props} />;
  return <View style={props.style as StyleProp<ViewStyle>}>
    <NursingTextField chrome={chrome} label={props.label} value={props.value || ''}
      onChangeText={props.onChangeText || (() => {})} keyboardType={props.keyboardType || 'default'}
      multiline={props.multiline} disabled={props.disabled || props.editable === false}
      placeholder={props.placeholder} accessibilityLabel={props.accessibilityLabel} />
  </View>;
}
ActivityTextInput.Icon = PaperInput.Icon;

export function ActivitySegments(props: ComponentProps<typeof PaperSegments>) {
  const chrome = useCareScreenStyle();
  if (!chrome || props.multiSelect || props.buttons.some(button => typeof button.label !== 'string' || button.disabled)) {
    return <PaperSegments {...props} />;
  }
  return <View style={props.style}><NursingChoice chrome={chrome} label="" value={props.value as string}
    options={props.buttons.map(button => ({ value: button.value, label: button.label as string }))}
    onChange={value => props.onValueChange(value)} /></View>;
}

export function ActivityButton(props: ComponentProps<typeof PaperButton>) {
  const chrome = useCareScreenStyle();
  const primary = chrome && props.mode === 'contained';
  return <PaperButton {...props}
    buttonColor={primary ? chrome.flat.bgPrimary : props.buttonColor}
    textColor={primary ? chrome.flat.textOnFill : props.textColor}
    style={[props.style, chrome && { borderRadius: 999 }]}
    contentStyle={[props.contentStyle, primary && { minHeight: 52 }]}
    labelStyle={[props.labelStyle, chrome && { fontSize: 16, fontWeight: '700' }]} />;
}

export function ActivityActions({ onSave, onClose, onDelete, saving, label = 'Save changes' }: {
  onSave: () => void; onClose: () => void; onDelete?: () => void; saving: boolean; label?: string;
}) {
  const chrome = useCareScreenStyle();
  if (!chrome) return <View>
    <PaperButton mode="contained" onPress={onSave} loading={saving} disabled={saving}>{label}</PaperButton>
    <PaperButton onPress={onClose} disabled={saving}>Cancel</PaperButton>
    {onDelete ? <PaperButton onPress={onDelete} disabled={saving}>Delete</PaperButton> : null}
  </View>;
  return <View style={{ marginTop: 16, gap: 12 }}>
    <NursingPrimaryAction chrome={chrome} pressKey="save" label={saving ? 'Saving...' : label} onPress={onSave} disabled={saving} />
    <NursingBottomRow chrome={chrome} align={onDelete ? 'space-between' : 'center'} actions={[
      ...(onDelete ? [{ key: 'delete', icon: 'trash-can-outline', label: 'Delete', danger: true, onPress: onDelete, disabled: saving }] : []),
      { key: 'cancel', icon: 'close', label: 'Cancel', muted: true, onPress: onClose, disabled: saving },
    ]} />
  </View>;
}
