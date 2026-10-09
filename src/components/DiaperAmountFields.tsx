import { ActivitySegments as SegmentedButtons } from './ActivityStyle';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { DiaperAmount } from '../services/firebase/events';

interface Props {
  condition: 'wet' | 'dirty' | 'both';
  amount?: DiaperAmount;
  wetAmount?: DiaperAmount;
  dirtyAmount?: DiaperAmount;
  onAmountChange: (amount: DiaperAmount) => void;
  onWetAmountChange: (amount: DiaperAmount) => void;
  onDirtyAmountChange: (amount: DiaperAmount) => void;
}

const buttons = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

function AmountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: DiaperAmount;
  onChange: (amount: DiaperAmount) => void;
}) {
  return (
    <View>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <SegmentedButtons
        value={value || ''}
        onValueChange={next => onChange(next as DiaperAmount)}
        buttons={buttons}
        style={styles.input}
      />
    </View>
  );
}

export default function DiaperAmountFields({
  condition,
  amount,
  wetAmount,
  dirtyAmount,
  onAmountChange,
  onWetAmountChange,
  onDirtyAmountChange,
}: Props) {
  return condition === 'both' ? (
    <>
      <AmountField
        label="Wet amount"
        value={wetAmount}
        onChange={onWetAmountChange}
      />
      <AmountField
        label="Poo amount"
        value={dirtyAmount}
        onChange={onDirtyAmountChange}
      />
    </>
  ) : (
    <AmountField label="Amount" value={amount} onChange={onAmountChange} />
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  // Matches the label-plus-control rhythm used by EventTimeEditor.
  input: { marginBottom: 20 },
});
