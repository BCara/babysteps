export interface ManualNursingInput {
  leftMinutes: string;
  rightMinutes: string;
  lastBreastSide?: 'left' | 'right';
}

export interface ManualNursingDetails {
  leftBreastDurationSeconds: number;
  rightBreastDurationSeconds: number;
  durationMinutes: number;
  breastSide: 'left' | 'right' | 'both';
  breastSidesUsed: Array<'left' | 'right'>;
  lastBreastSide: 'left' | 'right';
}

export type NursingDurationField = 'total' | 'left' | 'right';

export interface NursingDurationInputs {
  total: string;
  left: string;
  right: string;
}

export const nursingDurationInputsFromSeconds = (
  leftSeconds: number,
  rightSeconds: number,
): NursingDurationInputs => {
  const formatSide = (seconds: number) =>
    seconds > 0 ? Math.max(1, Math.round(seconds / 60)).toString() : '';
  const left = formatSide(leftSeconds);
  const right = formatSide(rightSeconds);

  return {
    total: String((Number(left) || 0) + (Number(right) || 0)),
    left,
    right,
  };
};

interface NursingDurationInputUpdate {
  values: NursingDurationInputs;
  editOrder: NursingDurationField[];
}

const parseDurationInput = (value: string) => {
  if (!value.trim()) return undefined;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : undefined;
};

const formatDurationInput = (minutes: number) =>
  (Math.round(minutes * 100) / 100).toString();

export const updateNursingDurationInputs = (
  current: NursingDurationInputs,
  editedField: NursingDurationField,
  value: string,
  previousEditOrder: NursingDurationField[],
): NursingDurationInputUpdate => {
  const values = { ...current, [editedField]: value };

  if (
    editedField === 'total' &&
    previousEditOrder.length === 0 &&
    current.left.trim() === '' &&
    current.right.trim() === ''
  ) {
    const total = parseDurationInput(value);
    values.left = total === undefined ? '' : formatDurationInput(total / 2);
    values.right =
      total === undefined ? '' : formatDurationInput(total - total / 2);

    return {
      values,
      editOrder: ['total'],
    };
  }

  const inferredPreviousOrder =
    previousEditOrder.length === 0 && editedField === 'left' && current.right.trim()
      ? (['right'] as NursingDurationField[])
      : previousEditOrder.length === 0 &&
          editedField === 'right' &&
          current.left.trim()
        ? (['left'] as NursingDurationField[])
        : previousEditOrder;
  const editOrder = [
    ...inferredPreviousOrder.filter(field => field !== editedField),
    editedField,
  ].slice(-2) as NursingDurationField[];

  const editedMinutes = parseDurationInput(value);
  if (editOrder.length === 1) {
    if (editedField !== 'total') {
      values.total =
        editedMinutes === undefined ? '' : formatDurationInput(editedMinutes);
    }
    return { values, editOrder };
  }

  const calculatedField = (['total', 'left', 'right'] as const).find(
    field => !editOrder.includes(field),
  )!;
  const total = parseDurationInput(values.total);
  const left = parseDurationInput(values.left);
  const right = parseDurationInput(values.right);

  let calculatedMinutes: number | undefined;
  if (calculatedField === 'total' && left !== undefined && right !== undefined) {
    calculatedMinutes = left + right;
  } else if (
    calculatedField === 'left' &&
    total !== undefined &&
    right !== undefined &&
    total >= right
  ) {
    calculatedMinutes = total - right;
  } else if (
    calculatedField === 'right' &&
    total !== undefined &&
    left !== undefined &&
    total >= left
  ) {
    calculatedMinutes = total - left;
  }

  values[calculatedField] =
    calculatedMinutes === undefined
      ? ''
      : formatDurationInput(calculatedMinutes);

  return { values, editOrder };
};

interface NursingDurationDistributionInput {
  totalSeconds: number;
  leftSeconds: number;
  rightSeconds: number;
  breastSide?: 'left' | 'right' | 'both' | '';
}

export const distributeNursingDuration = ({
  totalSeconds,
  leftSeconds,
  rightSeconds,
  breastSide,
}: NursingDurationDistributionInput) => {
  const safeTotal = Math.max(0, Math.round(totalSeconds));
  const safeLeft = Math.max(0, Math.round(leftSeconds));
  const safeRight = Math.max(0, Math.round(rightSeconds));
  const currentTotal = safeLeft + safeRight;

  if (currentTotal > 0) {
    const nextLeft = Math.min(
      safeTotal,
      Math.round(safeTotal * (safeLeft / currentTotal)),
    );
    return {
      leftSeconds: nextLeft,
      rightSeconds: safeTotal - nextLeft,
    };
  }

  if (breastSide === 'right') {
    return { leftSeconds: 0, rightSeconds: safeTotal };
  }
  if (breastSide === 'both') {
    const nextLeft = Math.floor(safeTotal / 2);
    return {
      leftSeconds: nextLeft,
      rightSeconds: safeTotal - nextLeft,
    };
  }
  return { leftSeconds: safeTotal, rightSeconds: 0 };
};

const parseMinutes = (value: string) => {
  if (!value.trim()) return 0;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : Number.NaN;
};

export const parseManualNursing = (
  input: ManualNursingInput,
): ManualNursingDetails | null => {
  const leftMinutes = parseMinutes(input.leftMinutes);
  const rightMinutes = parseMinutes(input.rightMinutes);

  if (
    !Number.isFinite(leftMinutes) ||
    !Number.isFinite(rightMinutes) ||
    leftMinutes + rightMinutes <= 0
  ) {
    return null;
  }

  const usedLeft = leftMinutes > 0;
  const usedRight = rightMinutes > 0;
  const breastSide = usedLeft && usedRight ? 'both' : usedLeft ? 'left' : 'right';
  const breastSidesUsed = (['left', 'right'] as const).filter(side =>
    side === 'left' ? usedLeft : usedRight,
  );

  return {
    leftBreastDurationSeconds: Math.round(leftMinutes * 60),
    rightBreastDurationSeconds: Math.round(rightMinutes * 60),
    durationMinutes: leftMinutes + rightMinutes,
    breastSide,
    breastSidesUsed,
    lastBreastSide:
      breastSide === 'both'
        ? input.lastBreastSide || 'right'
        : breastSide,
  };
};
