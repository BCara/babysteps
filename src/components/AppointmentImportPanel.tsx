import { ActivityTextInput as TextInput, ActivityButton as Button } from './ActivityStyle';
import { useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import {
  Checkbox,
  HelperText,
  Icon,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import {
  HealthRecordExtraction,
  HealthRecordImportType,
  extractHealthRecordDetails,
  friendlyHealthRecordImportError,
} from '../services/appointmentImport';
import { useAiAssistant } from '../providers/AiAssistantProvider';
import { hasGrowthMeasurements, parseGrowthImportText } from '../utils/growthImport';

interface Props {
  disabled?: boolean;
  recordType: HealthRecordImportType;
  onApply: (extraction: HealthRecordExtraction) => void;
}

interface SelectedImage {
  uri: string;
  name: string;
}

const pickImage = async (camera: boolean, recordLabel: string) => {
  const ImagePicker = await import('expo-image-picker');
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error(`Camera permission is needed to photograph the ${recordLabel}.`);
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(`Photo permission is needed to choose a ${recordLabel} image.`);
    }
  }

  const result = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || (camera ? `New ${recordLabel} photo` : `${recordLabel} photo`),
  };
};

export default function AppointmentImportPanel({ disabled, recordType, onApply }: Props) {
  const theme = useTheme();
  const recordLabel = recordType === 'immunization'
    ? 'immunisation'
    : recordType === 'growth'
      ? 'growth record'
      : 'appointment';
  const pasteLabel = recordType === 'growth'
    ? 'Paste measurements or report text here'
    : `Paste ${recordLabel} details or email text here`;
  const { status, setConsent } = useAiAssistant();
  const [sourceText, setSourceText] = useState('');
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const usesOnDeviceTextParsing = recordType === 'growth' && !image;

  const chooseImage = async (camera: boolean) => {
    setError('');
    try {
      const selected = await pickImage(camera, recordLabel);
      if (selected) setImage(selected);
    } catch (nextError) {
      setError(friendlyHealthRecordImportError(nextError, recordLabel));
    }
  };

  const interpret = async () => {
    const text = sourceText.trim();
    if (!image && !text) {
      setError(`Add a photo or paste the ${recordLabel} text first.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (usesOnDeviceTextParsing) {
        const extraction = parseGrowthImportText(text);
        if (!hasGrowthMeasurements(extraction)) {
          setError('No growth measurements were recognised. Include a label and unit, such as “weight 7.2 kg” or “length 68 cm”.');
          return;
        }
        onApply(extraction);
        return;
      }
      if (!status?.consented) {
        if (!consentChecked) {
          setError('Confirm the optional AI processing notice first.');
          return;
        }
        await setConsent(true);
      }
      let imageDataUrl: string | undefined;
      if (image) {
        const ImageManipulator = await import('expo-image-manipulator');
        const resized = await ImageManipulator.manipulateAsync(
          image.uri,
          [{ resize: { width: 1600 } }],
          {
            base64: true,
            compress: 0.68,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );
        if (resized.base64) imageDataUrl = `data:image/jpeg;base64,${resized.base64}`;
      }
      const extraction = await extractHealthRecordDetails({
        recordType,
        text: text || undefined,
        imageDataUrl,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: Intl.DateTimeFormat().resolvedOptions().locale || 'en-AU',
      });
      onApply(extraction);
    } catch (nextError) {
      setError(friendlyHealthRecordImportError(nextError, recordLabel));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface
      elevation={0}
      style={[
        styles.panel,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <View style={styles.heading}>
        <Icon source="text-box-search-outline" size={22} />
        <View style={styles.headingCopy}>
          <Text variant="titleSmall">Add from a photo or pasted text</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Optional — we’ll fill the form for you to review.
          </Text>
        </View>
      </View>
      <View style={styles.sourceButtons}>
        <Button
          mode="outlined"
          icon="camera-outline"
          onPress={() => void chooseImage(true)}
          disabled={disabled || busy}
        >
          Take photo
        </Button>
        <Button
          mode="outlined"
          icon="image-outline"
          onPress={() => void chooseImage(false)}
          disabled={disabled || busy}
        >
          Choose photo
        </Button>
      </View>
      {image ? (
        <View style={styles.selectedImage}>
          <Image source={{ uri: image.uri }} style={styles.thumbnail} />
          <Text variant="bodySmall" numberOfLines={2} style={styles.imageName}>
            {image.name}
          </Text>
          <Button compact onPress={() => setImage(null)} disabled={busy}>
            Remove
          </Button>
        </View>
      ) : null}
      <TextInput
        label={pasteLabel}
        mode="outlined"
        multiline
        numberOfLines={Platform.OS === 'android' ? 4 : undefined}
        value={sourceText}
        onChangeText={setSourceText}
        disabled={disabled || busy}
        style={styles.textInput}
      />
      <Text variant="bodySmall" style={styles.pasteHint}>
        Copy the details from a text message or email, then tap and hold here to paste.
      </Text>
      <HelperText type="info" padding="none" style={styles.privacy}>
        {usesOnDeviceTextParsing
          ? 'Pasted text is interpreted on this device and is not attached to the saved growth record.'
          : `The source is used for one-time extraction and is not attached to the saved ${recordLabel}.`}
      </HelperText>
      {!usesOnDeviceTextParsing && !status?.consented ? (
        <Surface
          elevation={0}
          style={[styles.consent, { backgroundColor: theme.colors.surface }]}
        >
          <Text variant="bodySmall" style={styles.consentCopy}>
            OpenAI processes the selected photo or pasted text, which may include
            provider and {recordLabel} details. API storage is disabled, but
            abuse-monitoring data may be retained for up to 30 days. You can
            turn this optional processing off in Settings.
          </Text>
          <Checkbox.Item
            label="I’m an adult caregiver and consent to this processing"
            status={consentChecked ? 'checked' : 'unchecked'}
            onPress={() => setConsentChecked(value => !value)}
            disabled={busy}
            position="leading"
            style={styles.consentCheckbox}
            labelStyle={styles.consentLabel}
          />
        </Surface>
      ) : null}
      {error ? <HelperText type="error" padding="none">{error}</HelperText> : null}
      <View style={styles.actions}>
        <Button
          mode="contained-tonal"
          icon="auto-fix"
          onPress={() => void interpret()}
          loading={busy}
          disabled={
            disabled ||
            busy ||
            (!image && !sourceText.trim()) ||
            (!usesOnDeviceTextParsing && !status?.consented && !consentChecked)
          }
        >
          {usesOnDeviceTextParsing ? 'Read measurements' : 'Interpret details'}
        </Button>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 14, borderRadius: 16, marginBottom: 16 },
  heading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  headingCopy: { flex: 1, gap: 2 },
  sourceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  selectedImage: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  thumbnail: { width: 52, height: 52, borderRadius: 8 },
  imageName: { flex: 1 },
  textInput: { marginTop: 12 },
  pasteHint: { marginTop: 5, opacity: 0.65 },
  privacy: { marginTop: 8, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  consent: { borderRadius: 12, padding: 10, marginTop: 10 },
  consentCopy: { lineHeight: 18 },
  consentCheckbox: { paddingHorizontal: 0, paddingVertical: 4 },
  consentLabel: { fontSize: 13, lineHeight: 18 },
});
