import { ActivityTextInput as TextInput, ActivitySegments as SegmentedButtons, ActivityButton as Button } from './ActivityStyle';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  HelperText,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { useCarePalette } from '../hooks/useCarePalette';
import NursingStartScreen from './nursing/NursingStartScreen';

interface FeedPanelProps {
  feedType: 'breast' | 'bottle';
  defaultBreastSide?: 'left' | 'right';
  defaultUnit: 'ml' | 'oz';
  showCloseButton?: boolean;
  onClose: () => void;
  onManualEntry: (startTime?: Date) => void;
  onStartBreastFeed: (
    side: 'left' | 'right',
    startTime?: Date,
  ) => Promise<void>;
  onLogBottleFeed: (amount: number, unit: 'ml' | 'oz') => Promise<void>;
}

export default function FeedPanel({
  feedType,
  defaultBreastSide,
  defaultUnit,
  showCloseButton = true,
  onClose,
  onManualEntry,
  onStartBreastFeed,
  onLogBottleFeed,
}: FeedPanelProps) {
  const theme = useTheme();
  const { colors: eventColors, careInk } = useCarePalette();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'ml' | 'oz'>(defaultUnit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleLogBottleFeed = async () => {
    setError('');
    const parsedAmount = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a valid bottle amount.');
      return;
    }

    setBusy(true);
    try {
      await onLogBottleFeed(parsedAmount, unit);
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to log the bottle feed.',
      );
    } finally {
      setBusy(false);
    }
  };

  // Nursing has its own full-screen design, shared with the running timer and
  // the feed just saved. Bottle feeds keep the quick care card.
  if (feedType === 'breast') {
    return (
      <NursingStartScreen
        defaultBreastSide={defaultBreastSide}
        onClose={onClose}
        onManualEntry={onManualEntry}
        onStart={onStartBreastFeed}
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
        <View style={styles.headerCopy}>
          <Text variant="headlineSmall">Bottle feed</Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Enter the amount to save this feed now.
          </Text>
        </View>
        {showCloseButton ? (
          <IconButton
            icon="close"
            onPress={onClose}
            disabled={busy}
            accessibilityLabel="Close feed options"
          />
        ) : null}
      </View>

      <View style={styles.feedBody}>
        <View style={styles.amountRow}>
          <TextInput
            label="Amount"
            mode="outlined"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            style={styles.amountInput}
          />
          <SegmentedButtons
            value={unit}
            onValueChange={value => setUnit(value as 'ml' | 'oz')}
            buttons={[
              { value: 'ml', label: 'ml' },
              { value: 'oz', label: 'oz' },
            ]}
            style={styles.unitInput}
          />
        </View>
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <Button
          mode="contained"
          icon="check"
          buttonColor={eventColors.feed}
          textColor={careInk}
          onPress={handleLogBottleFeed}
          loading={busy}
          disabled={busy}
          contentStyle={styles.actionContent}
        >
          Log bottle feed
        </Button>
      </View>

      <Button
        mode="outlined"
        icon="pencil-outline"
        onPress={() => onManualEntry()}
        disabled={busy}
        style={styles.manualAction}
      >
        Manual entry
      </Button>
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
  headerCopy: {
    flex: 1,
    paddingRight: 4,
  },
  subtitle: {
    marginTop: 3,
    lineHeight: 20,
  },
  feedBody: {
    gap: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInput: {
    flex: 1,
  },
  unitInput: {
    flex: 1,
  },
  actionContent: {
    minHeight: 50,
  },
  manualAction: {
    marginTop: 18,
  },
});
