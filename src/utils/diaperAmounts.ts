import type {
  BabyEventMetadata,
  DiaperAmount,
} from '../services/firebase/events';

const sentenceCase = (value: DiaperAmount) =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export const diaperAmountValues = (metadata?: BabyEventMetadata) => {
  const fallback = metadata?.diaperAmount;
  return {
    amount: fallback,
    wetAmount: metadata?.wetDiaperAmount || fallback,
    dirtyAmount: metadata?.dirtyDiaperAmount || fallback,
  };
};

export const diaperAmountMetadata = (
  condition: 'wet' | 'dirty' | 'both',
  amount?: DiaperAmount,
  wetAmount?: DiaperAmount,
  dirtyAmount?: DiaperAmount,
) =>
  condition === 'both'
    ? {
        diaperAmount: undefined,
        wetDiaperAmount: wetAmount,
        dirtyDiaperAmount: dirtyAmount,
      }
    : {
        diaperAmount: amount,
        wetDiaperAmount: undefined,
        dirtyDiaperAmount: undefined,
      };

export const formatDiaperAmountDetail = (metadata?: BabyEventMetadata) => {
  if (metadata?.diaperCondition === 'both') {
    const wetAmount = metadata.wetDiaperAmount || metadata.diaperAmount;
    const dirtyAmount = metadata.dirtyDiaperAmount || metadata.diaperAmount;
    return [
      wetAmount ? `Wet: ${sentenceCase(wetAmount)}` : '',
      dirtyAmount ? `Dirty: ${sentenceCase(dirtyAmount)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return metadata?.diaperAmount
    ? sentenceCase(metadata.diaperAmount)
    : '';
};

export const diaperAmountForSide = (
  metadata: BabyEventMetadata | undefined,
  side: 'wet' | 'dirty',
) => {
  if (!metadata) return undefined;
  if (metadata.diaperCondition === side) return metadata.diaperAmount;
  if (metadata.diaperCondition !== 'both') return undefined;
  return side === 'wet'
    ? metadata.wetDiaperAmount || metadata.diaperAmount
    : metadata.dirtyDiaperAmount || metadata.diaperAmount;
};
