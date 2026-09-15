export interface GrowthMeasurementValues {
  weightKg?: string;
  heightCm?: string;
  headCircumferenceCm?: string;
}

const positiveNumberOrUndefined = (value = '') => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const parseGrowthMeasurements = (values: GrowthMeasurementValues) => ({
  weightKg: positiveNumberOrUndefined(values.weightKg),
  heightCm: positiveNumberOrUndefined(values.heightCm),
  headCircumferenceCm: positiveNumberOrUndefined(
    values.headCircumferenceCm,
  ),
});
