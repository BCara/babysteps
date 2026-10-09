import { ActivityActions } from './ActivityStyle';
import { ActivityTextInput as TextInput, ActivitySegments as SegmentedButtons, ActivityButton as Button } from './ActivityStyle';
import ExpandedQuickCareView from './ExpandedQuickCareView';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Checkbox, Surface, Text, useTheme } from 'react-native-paper';
import { careActionByType } from '../constants/careActions';
import type { BabyEvent, BabyEventMetadata, BabyEventType } from '../services/firebase/events';
import { parseGrowthMeasurements } from '../utils/growthMeasurements';
import EventTimeEditor from './EventTimeEditor';
import ContextualVoiceButton from './ContextualVoiceButton';
import type { VoiceEntryValues } from '../utils/voiceCommand';
import AppointmentImportPanel from './AppointmentImportPanel';
import AppointmentLocationField from './AppointmentLocationField';
import type { HealthRecordExtraction } from '../services/appointmentImport';
import { addAppointmentToDeviceCalendar } from '../services/deviceCalendar';

export type AdditionalCareType = Exclude<BabyEventType, 'feed' | 'sleep' | 'diaper'>;
export interface CareLogInput { type: AdditionalCareType; startTime?: Date; durationMinutes?: number; notes?: string; metadata: BabyEventMetadata }

interface Props {
  visible: boolean;
  type: AdditionalCareType | null;
  event?: BabyEvent | null;
  embedded?: boolean;
  onClose: () => void;
  onSave: (input: CareLogInput) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  /** Where a new entry's time starts, such as the hour tapped on a timeline. */
  initialStartTime?: Date;
}

const numberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export default function CareLogModal({ visible, type, event, embedded = false, onClose, onSave, onDelete, initialStartTime }: Props) {
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState(new Date());
  const [firstExposure, setFirstExposure] = useState(false);
  const [allergen, setAllergen] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [healthRecordPage, setHealthRecordPage] = useState<'details' | 'import'>('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!visible || !type) return;
    const metadata = event?.metadata || {};
    setStartTime(event?.startTime || initialStartTime || new Date());
    setValues({
      notes: event?.notes || '', duration: event?.durationMinutes?.toString() || '',
      amount: metadata.amount?.toString() || '', unit: metadata.unit || 'ml', pumpingSide: metadata.pumpingSide || 'both', storageLocation: metadata.storageLocation || 'usedNow',
      food: metadata.food || '', foodAmount: metadata.foodAmount || '', texture: metadata.texture || 'mashed',
      weightKg: metadata.weightKg?.toString() || '', heightCm: metadata.heightCm?.toString() || '', headCircumferenceCm: metadata.headCircumferenceCm?.toString() || '', measuredBy: metadata.measuredBy || '',
      pottyType: metadata.pottyType || 'wee', pottyOutcome: metadata.pottyOutcome || 'success',
      temperature: metadata.temperature?.toString() || '', temperatureUnit: metadata.temperatureUnit || 'C', temperatureMethod: metadata.temperatureMethod || 'armpit',
      medicineName: metadata.medicineName || '', doseAmount: metadata.doseAmount?.toString() || '', doseUnit: metadata.doseUnit || 'mL', administeredBy: metadata.administeredBy || '',
      milestone: metadata.milestone || '', observation: metadata.observation || '', appointmentType: metadata.appointmentType || '', provider: metadata.provider || '',
      appointmentLocation: metadata.appointmentLocation || '', appointmentAddress: metadata.appointmentAddress || '', appointmentPhone: metadata.appointmentPhone || '', appointmentReference: metadata.appointmentReference || '',
      immunization: metadata.immunization || '', immunizationLocation: metadata.immunizationLocation || '', tooth: metadata.tooth || '',
    });
    setFirstExposure(Boolean(metadata.firstExposure));
    setAllergen(Boolean(metadata.allergen));
    setAddToCalendar(false);
    setShowAppointmentDetails(false);
    setHealthRecordPage('details');
    setError('');
  }, [event, type, visible, initialStartTime]);

  if (!visible || !type) return null;
  const definition = careActionByType[type];
  const isImportableHealthRecord = type === 'appointment' || type === 'immunization' || type === 'growth';
  const healthRecordLabel = type === 'immunization'
    ? 'immunisation'
    : type === 'growth'
      ? 'growth measurements'
      : 'appointment';
  const field = (key: string, label: string, keyboardType: 'default' | 'decimal-pad' | 'number-pad' = 'default') => (
    <TextInput label={label} mode="outlined" value={values[key] || ''} onChangeText={value => set(key, value)} keyboardType={keyboardType} style={styles.input} />
  );
  const segments = (key: string, buttons: { value: string; label: string }[]) => (
    <SegmentedButtons value={values[key]} onValueChange={value => set(key, value)} buttons={buttons} style={styles.input} />
  );

  const formatVoiceNumber = (value: number) =>
    Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

  const handleVoiceFill = (voiceValues: VoiceEntryValues) => {
    setValues(current => ({
      ...current,
      ...(voiceValues.fields || {}),
      ...(voiceValues.durationMinutes !== undefined
        ? { duration: formatVoiceNumber(voiceValues.durationMinutes) }
        : {}),
      ...(voiceValues.amount !== undefined
        ? { amount: formatVoiceNumber(voiceValues.amount) }
        : {}),
      ...(voiceValues.unit ? { unit: voiceValues.unit } : {}),
      ...(voiceValues.pumpingSide
        ? { pumpingSide: voiceValues.pumpingSide }
        : {}),
      ...(voiceValues.storageLocation
        ? { storageLocation: voiceValues.storageLocation }
        : {}),
    }));
    if (voiceValues.firstExposure !== undefined) {
      setFirstExposure(voiceValues.firstExposure);
    }
    if (voiceValues.allergen !== undefined) setAllergen(voiceValues.allergen);
    setError('');
  };

  const handleHealthRecordExtraction = (extraction: HealthRecordExtraction) => {
    setValues(current => ({
      ...current,
      ...(extraction.appointmentType ? { appointmentType: extraction.appointmentType } : {}),
      ...(extraction.immunization ? { immunization: extraction.immunization } : {}),
      ...(extraction.provider ? { provider: extraction.provider } : {}),
      ...(extraction.durationMinutes
        ? { duration: formatVoiceNumber(extraction.durationMinutes) }
        : {}),
      ...(extraction.location && type !== 'growth'
        ? type === 'immunization'
          ? { immunizationLocation: extraction.location }
          : { appointmentLocation: extraction.location }
        : {}),
      ...(extraction.address && type === 'appointment' ? { appointmentAddress: extraction.address } : {}),
      ...(extraction.phone ? { appointmentPhone: extraction.phone } : {}),
      ...(extraction.reference ? { appointmentReference: extraction.reference } : {}),
      ...(extraction.weightKg !== undefined
        ? { weightKg: formatVoiceNumber(extraction.weightKg) }
        : {}),
      ...(extraction.heightCm !== undefined
        ? { heightCm: formatVoiceNumber(extraction.heightCm) }
        : {}),
      ...(extraction.headCircumferenceCm !== undefined
        ? { headCircumferenceCm: formatVoiceNumber(extraction.headCircumferenceCm) }
        : {}),
      ...(extraction.measuredBy ? { measuredBy: extraction.measuredBy } : {}),
      ...(extraction.notes ? { notes: extraction.notes } : {}),
    }));
    if (extraction.dateTime) {
      const extractedDate = new Date(extraction.dateTime);
      if (!Number.isNaN(extractedDate.getTime())) setStartTime(extractedDate);
    }
    setHealthRecordPage('details');
    setError('');
  };

  const submit = async () => {
    if (type !== 'appointment' && (event || type === 'growth' || type === 'immunization') && startTime.getTime() > Date.now()) {
      setError('Choose a time that is not in the future.');
      return;
    }
    const required: Partial<Record<AdditionalCareType, string>> = {
      solids: 'food', temperature: 'temperature', medication: 'medicineName', milestone: 'milestone', symptom: 'observation', appointment: 'appointmentType', immunization: 'immunization', teething: 'tooth',
    };
    const requiredKey = required[type];
    if (requiredKey && !values[requiredKey]?.trim()) { setError('Complete the main field before saving.'); return; }
    const growthMeasurements = parseGrowthMeasurements(values);
    if (
      type === 'growth' &&
      !growthMeasurements.weightKg &&
      !growthMeasurements.heightCm &&
      !growthMeasurements.headCircumferenceCm
    ) {
      setError('Add one valid measurement, such as weight.');
      return;
    }
    setSaving(true); setError('');
    try {
      const metadata: BabyEventMetadata = type === 'pumping' ? { pumpingSide: values.pumpingSide as BabyEventMetadata['pumpingSide'], amount: numberOrUndefined(values.amount), unit: values.unit as 'ml' | 'oz', storageLocation: values.storageLocation as BabyEventMetadata['storageLocation'] }
        : type === 'solids' ? { food: values.food.trim(), foodAmount: values.foodAmount.trim() || undefined, texture: values.texture as BabyEventMetadata['texture'], firstExposure, allergen }
        : type === 'growth' ? { ...growthMeasurements, measuredBy: values.measuredBy.trim() || undefined }
        : type === 'potty' ? { pottyType: values.pottyType as BabyEventMetadata['pottyType'], pottyOutcome: values.pottyOutcome as BabyEventMetadata['pottyOutcome'] }
        : type === 'temperature' ? { temperature: numberOrUndefined(values.temperature), temperatureUnit: values.temperatureUnit as 'C' | 'F', temperatureMethod: values.temperatureMethod as BabyEventMetadata['temperatureMethod'] }
        : type === 'medication' ? { medicineName: values.medicineName.trim(), doseAmount: numberOrUndefined(values.doseAmount), doseUnit: values.doseUnit.trim() || undefined, administeredBy: values.administeredBy.trim() || undefined }
        : type === 'milestone' ? { milestone: values.milestone.trim() }
        : type === 'symptom' ? { observation: values.observation.trim() }
        : type === 'appointment' ? {
          appointmentType: values.appointmentType.trim(),
          provider: values.provider.trim() || undefined,
          appointmentLocation: values.appointmentLocation.trim() || undefined,
          appointmentAddress: values.appointmentAddress.trim() || undefined,
          appointmentPhone: values.appointmentPhone.trim() || undefined,
          appointmentReference: values.appointmentReference.trim() || undefined,
        }
        : type === 'immunization' ? {
          immunization: values.immunization.trim(),
          provider: values.provider.trim() || undefined,
          immunizationLocation: values.immunizationLocation.trim() || undefined,
        }
        : type === 'teething' ? { tooth: values.tooth.trim() }
        : {};
      const durationMinutes = ['pumping', 'tummyTime', 'bath', 'appointment'].includes(type)
        ? numberOrUndefined(values.duration)
        : undefined;
      await onSave({
        type,
        startTime: event || type === 'growth' || type === 'appointment' || type === 'immunization' ? startTime : undefined,
        durationMinutes,
        notes: values.notes.trim() || undefined,
        metadata,
      });
      if (type === 'appointment' && addToCalendar) {
        try {
          await addAppointmentToDeviceCalendar({
            title: values.appointmentType.trim(),
            startDate: startTime,
            durationMinutes,
            location: [values.appointmentLocation, values.appointmentAddress]
              .map(value => value.trim())
              .filter(Boolean)
              .join(', ') || undefined,
            notes: [
              values.provider.trim() ? `Provider: ${values.provider.trim()}` : '',
              values.appointmentPhone.trim() ? `Phone: ${values.appointmentPhone.trim()}` : '',
              values.appointmentReference.trim() ? `Reference: ${values.appointmentReference.trim()}` : '',
              values.notes.trim(),
            ].filter(Boolean).join('\n') || undefined,
          });
        } catch {
          Alert.alert(
            'Appointment saved',
            'The PitterPatter record was saved, but the device calendar could not be opened.',
          );
        }
      }
      onClose();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to save this record.'); }
    finally { setSaving(false); }
  };

  const deleteEvent = async () => {
    if (!event?.id || !onDelete) return;
    setSaving(true);
    try { await onDelete(event.id); onClose(); } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to delete this record.'); }
    finally { setSaving(false); }
  };

  const form = (
      <Surface style={[styles.sheet, embedded ? styles.embeddedSheet : styles.fullScreenSheet, { backgroundColor: 'transparent' }]} elevation={0}>
        <View style={styles.header}><View style={styles.headerCopy}>{embedded ? <Text variant="titleLarge" style={styles.title}>{isImportableHealthRecord && healthRecordPage === 'import' ? `Import ${healthRecordLabel}` : `${event ? 'Edit' : 'Log'} ${definition.label.toLowerCase()}`}</Text> : null}<Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{type === 'medication' ? 'Record what was given. PitterPatter does not calculate doses.' : isImportableHealthRecord ? healthRecordPage === 'import' ? 'Fill the form from a photo or pasted text.' : type === 'immunization' ? 'Record when it was given. Provider and location are optional.' : type === 'growth' ? 'Add measurements manually or import them from a record.' : 'Add the basic information. Extra details are optional.' : 'Add this record to the shared timeline.'}</Text></View></View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!embedded}
          nestedScrollEnabled
        >
          {healthRecordPage === 'details' ? (
            <ContextualVoiceButton
              context={type}
              onFill={handleVoiceFill}
              disabled={saving}
            />
          ) : null}
          {(event || type === 'growth') && healthRecordPage === 'details' && type !== 'appointment' && type !== 'immunization' ? (
            <EventTimeEditor
              value={startTime}
              onChange={setStartTime}
              label={type === 'growth'
                ? 'Measurement date and time'
                : undefined}
            />
          ) : null}
          {type === 'pumping' ? <>{segments('pumpingSide', [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }])}{field('duration', 'Duration (minutes)', 'number-pad')}{field('amount', `Amount (${values.unit || 'ml'})`, 'decimal-pad')}{segments('unit', [{ value: 'ml', label: 'ml' }, { value: 'oz', label: 'oz' }])}{segments('storageLocation', [{ value: 'usedNow', label: 'Now' }, { value: 'fridge', label: 'Fridge' }, { value: 'freezer', label: 'Freezer' }, { value: 'discarded', label: 'Discard' }])}</> : null}
          {type === 'solids' ? <>{field('food', 'Food or meal')}{field('foodAmount', 'Amount (optional)')}{segments('texture', [{ value: 'puree', label: 'Purée' }, { value: 'mashed', label: 'Mashed' }, { value: 'fingerFood', label: 'Finger food' }, { value: 'mixed', label: 'Mixed' }])}<Checkbox.Item label="First exposure" status={firstExposure ? 'checked' : 'unchecked'} onPress={() => setFirstExposure(value => !value)} /><Checkbox.Item label="Contains a common allergen" status={allergen ? 'checked' : 'unchecked'} onPress={() => setAllergen(value => !value)} /></> : null}
          {type === 'growth' && healthRecordPage === 'details' ? <><Text variant="bodySmall" style={styles.growthHint}>Add any one measurement, or add more if you have them.</Text>{field('weightKg', 'Weight (kg) — optional', 'decimal-pad')}{field('heightCm', 'Length / height (cm) — optional', 'decimal-pad')}{field('headCircumferenceCm', 'Head circumference (cm) — optional', 'decimal-pad')}{field('measuredBy', 'Measured by (optional)')}<Button mode="text" icon="text-box-search-outline" onPress={() => setHealthRecordPage('import')} disabled={saving} style={styles.importButton}>Import measurements instead</Button></> : null}
          {type === 'potty' ? <>{segments('pottyType', [{ value: 'wee', label: 'Wee' }, { value: 'poo', label: 'Poo' }, { value: 'both', label: 'Both' }])}{segments('pottyOutcome', [{ value: 'success', label: 'Success' }, { value: 'attempt', label: 'Attempt' }, { value: 'accident', label: 'Accident' }])}</> : null}
          {type === 'temperature' ? <>{field('temperature', `Temperature (°${values.temperatureUnit || 'C'})`, 'decimal-pad')}{segments('temperatureUnit', [{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }])}{segments('temperatureMethod', [{ value: 'armpit', label: 'Armpit' }, { value: 'ear', label: 'Ear' }, { value: 'forehead', label: 'Forehead' }, { value: 'other', label: 'Other' }])}<Text variant="bodySmall" style={styles.safety}>For recording only. Seek qualified medical advice if you are concerned about your child.</Text></> : null}
          {type === 'medication' ? <>{field('medicineName', 'Medicine name')}{field('doseAmount', 'Recorded dose', 'decimal-pad')}{field('doseUnit', 'Dose unit (for example mL or mg)')}{field('administeredBy', 'Given by (optional)')}</> : null}
          {type === 'tummyTime' || type === 'bath' ? field('duration', 'Duration (minutes)', 'number-pad') : null}
          {type === 'milestone' ? field('milestone', 'Milestone or first') : null}
          {type === 'symptom' ? field('observation', 'Symptom or observation') : null}
          {isImportableHealthRecord && healthRecordPage === 'import' ? <>
              <Button
                mode="text"
                icon="arrow-left"
                onPress={() => setHealthRecordPage('details')}
                disabled={saving}
                style={styles.importBack}
              >
                Back to {healthRecordLabel}
              </Button>
              <AppointmentImportPanel
                recordType={type}
                onApply={handleHealthRecordExtraction}
                disabled={saving}
              />
          </> : null}
          {type === 'appointment' && healthRecordPage === 'details' ? <>
              {field('appointmentType', 'What is the appointment for?')}
              <EventTimeEditor
                value={startTime}
                onChange={setStartTime}
                label="Date and time"
                allowFuture
              />
              {field('provider', 'Clinic or provider (optional)')}
              <AppointmentLocationField
                location={values.appointmentLocation || ''}
                address={values.appointmentAddress || ''}
                disabled={saving}
                onLocationChange={value => set('appointmentLocation', value)}
              />
              <Button
                mode="text"
                icon="text-box-search-outline"
                onPress={() => setHealthRecordPage('import')}
                disabled={saving}
                style={styles.importButton}
              >
                Import details instead
              </Button>
              <Button
                mode="text"
                icon={showAppointmentDetails ? 'chevron-up' : 'tune-variant'}
                onPress={() => setShowAppointmentDetails(current => !current)}
                disabled={saving}
                contentStyle={styles.detailsToggleContent}
              >
                {showAppointmentDetails ? 'Hide extra details' : 'Add more details'}
              </Button>
              {showAppointmentDetails ? <>
                {field('duration', 'Duration in minutes (optional)', 'number-pad')}
                {field('appointmentAddress', 'Separate street address (optional)')}
                {field('appointmentPhone', 'Phone (optional)', 'default')}
                {field('appointmentReference', 'Booking or referral reference (optional)')}
                <Checkbox.Item
                  label="Also add to device calendar"
                  status={addToCalendar ? 'checked' : 'unchecked'}
                  onPress={() => setAddToCalendar(value => !value)}
                  disabled={saving}
                  style={styles.calendarCheckbox}
                />
              </> : null}
          </> : null}
          {type === 'immunization' && healthRecordPage === 'details' ? <>
            {field('immunization', 'Immunisation or vaccine')}
            <EventTimeEditor
              value={startTime}
              onChange={setStartTime}
              label="Date and time"
            />
            {field('provider', 'Provider or clinic (optional)')}
            <AppointmentLocationField
              location={values.immunizationLocation || ''}
              address=""
              disabled={saving}
              onLocationChange={value => set('immunizationLocation', value)}
            />
            <Button
              mode="text"
              icon="text-box-search-outline"
              onPress={() => setHealthRecordPage('import')}
              disabled={saving}
              style={styles.importButton}
            >
              Import details instead
            </Button>
          </> : null}
          {type === 'teething' ? field('tooth', 'Tooth or teething update') : null}
          {!isImportableHealthRecord || healthRecordPage === 'details'
            ? field('notes', isImportableHealthRecord ? 'Notes (optional)' : 'Notes')
            : null}
          {error ? <Text variant="bodySmall" style={{ color: theme.colors.error }}>{error}</Text> : null}
          {!isImportableHealthRecord || healthRecordPage === 'details' ? (
            <ActivityActions onSave={() => void submit()} onClose={onClose}
              onDelete={event && onDelete ? () => void deleteEvent() : undefined}
              saving={saving} label={event ? 'Save changes' : 'Save activity'} />
          ) : null}
        </ScrollView>
      </Surface>
  );

  if (embedded) return form;

  return (
    <ExpandedQuickCareView
      visible={visible}
      title={`${event ? 'Edit' : 'Log'} ${definition.label.toLowerCase()}`}
      icon={definition.icon}
      color={definition.color}
      onClose={onClose}
      backLabel="Back"
      scrollable={false}
    >
      {form}
    </ExpandedQuickCareView>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  fullScreenSheet: { flex: 1, marginHorizontal: 16, marginVertical: 12, borderRadius: 22, overflow: 'hidden' },
  embeddedSheet: { maxHeight: undefined, marginHorizontal: 16, marginVertical: 8, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, overflow: 'hidden' },
  header: { paddingHorizontal: 20, paddingTop: 17, flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1 }, title: { fontWeight: '800', marginBottom: 3 }, content: { padding: 20 }, input: { marginBottom: 14 },
  growthHint: { marginBottom: 14, lineHeight: 18 },
  safety: { marginTop: -3, marginBottom: 16, lineHeight: 18 }, importButton: { alignSelf: 'flex-start', marginBottom: 14 }, importBack: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: 8 }, detailsToggleContent: { justifyContent: 'flex-start' }, actions: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, saveActions: { flexDirection: 'row', gap: 10 },
  calendarCheckbox: { marginTop: -4, marginBottom: 8, paddingHorizontal: 0 },
});
