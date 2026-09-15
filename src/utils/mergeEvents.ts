import type {
  BabyEvent,
  BabyEventMetadata,
  BabyEventType,
} from '../services/firebase/events';
import { careActionByType } from '../constants/careActions';
import { summarizeNursingSides } from './breastFeed';
import { diaperAmountForSide } from './diaperAmounts';

export const MERGEABLE_EVENT_TYPES: BabyEventType[] = [
  'feed',
  'sleep',
  'diaper',
  'pumping',
  'solids',
  'potty',
  'tummyTime',
  'bath',
];

export interface MergePlan {
  targetId: string;
  removedIds: string[];
  updates: Pick<
    BabyEvent,
    'startTime' | 'endTime' | 'durationMinutes' | 'notes' | 'metadata'
  >;
}

const byStartTime = (events: BabyEvent[]) =>
  [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

/**
 * Returns the reason these activities cannot be merged, or null when they can.
 * The reason is shown to the user, so it explains the fix rather than the rule.
 */
export const mergeBlocker = (events: BabyEvent[]): string | null => {
  if (events.length < 2) return 'Select two or more activities to merge.';
  if (events.some(event => !event.id)) {
    return 'These activities are still saving. Try again in a moment.';
  }
  if (events.some(event => !event.endTime)) {
    return 'Stop the running timer before merging.';
  }

  const [first, ...rest] = events;
  if (rest.some(event => event.type !== first.type)) {
    return 'Only activities of the same type can be merged.';
  }
  if (!MERGEABLE_EVENT_TYPES.includes(first.type)) {
    return `${careActionByType[first.type].pluralLabel} cannot be merged.`;
  }

  if (first.type === 'feed') {
    const feedType = first.metadata?.feedType;
    if (rest.some(event => event.metadata?.feedType !== feedType)) {
      return 'Nursing and bottle feeds cannot be merged together.';
    }
    if (feedType === 'bottle') {
      const units = new Set(
        events.map(event => event.metadata?.unit).filter(Boolean),
      );
      if (units.size > 1) {
        return 'Bottles must use the same unit to merge.';
      }
    }
  }

  return null;
};

export const canMergeEvents = (events: BabyEvent[]) =>
  mergeBlocker(events) === null;

const mergeNursing = (ordered: BabyEvent[]): BabyEventMetadata => {
  const { leftSeconds, rightSeconds } = summarizeNursingSides(ordered);
  const used = new Set<'left' | 'right'>();
  if (leftSeconds > 0) used.add('left');
  if (rightSeconds > 0) used.add('right');
  ordered.forEach(event => {
    const metadata = event.metadata;
    metadata?.breastSidesUsed?.forEach(side => used.add(side));
    if (metadata?.breastSide === 'left' || metadata?.breastSide === 'right') {
      used.add(metadata.breastSide);
    } else if (metadata?.breastSide === 'both') {
      used.add('left');
      used.add('right');
    }
  });

  const breastSidesUsed = (['left', 'right'] as const).filter(side =>
    used.has(side),
  );
  const last = ordered[ordered.length - 1].metadata;
  const lastBreastSide =
    last?.lastBreastSide ||
    (last?.breastSide === 'left' || last?.breastSide === 'right'
      ? last.breastSide
      : breastSidesUsed.length === 1
        ? breastSidesUsed[0]
        : undefined);

  return {
    feedType: 'breast',
    breastSide:
      breastSidesUsed.length === 2
        ? 'both'
        : breastSidesUsed.length === 1
          ? breastSidesUsed[0]
          : undefined,
    breastSidesUsed: breastSidesUsed.length ? breastSidesUsed : undefined,
    lastBreastSide,
    leftBreastDurationSeconds: leftSeconds,
    rightBreastDurationSeconds: rightSeconds,
    breastSideStartedAtMs: undefined,
  };
};

const sumAmounts = (ordered: BabyEvent[]) => {
  const amounts = ordered
    .map(event => event.metadata?.amount)
    .filter((amount): amount is number => typeof amount === 'number');
  if (!amounts.length) return undefined;
  return Math.round(amounts.reduce((total, amount) => total + amount, 0) * 100) / 100;
};

const firstDefined = <Key extends keyof BabyEventMetadata>(
  ordered: BabyEvent[],
  key: Key,
): BabyEventMetadata[Key] | undefined =>
  ordered.map(event => event.metadata?.[key]).find(value => value !== undefined);

const mergeSides = (ordered: BabyEvent[]) => {
  const sides = new Set(
    ordered.map(event => event.metadata?.pumpingSide).filter(Boolean),
  );
  if (sides.has('both') || (sides.has('left') && sides.has('right'))) {
    return 'both' as const;
  }
  if (sides.has('left')) return 'left' as const;
  if (sides.has('right')) return 'right' as const;
  return undefined;
};

const mergeDiaperCondition = (ordered: BabyEvent[]) => {
  const conditions = new Set(
    ordered.map(event => event.metadata?.diaperCondition).filter(Boolean),
  );
  if (conditions.has('both') || (conditions.has('wet') && conditions.has('dirty'))) {
    return 'both' as const;
  }
  if (conditions.has('wet')) return 'wet' as const;
  if (conditions.has('dirty')) return 'dirty' as const;
  return undefined;
};

const maxDiaperAmount = (
  amounts: Array<'light' | 'medium' | 'heavy' | undefined>,
) => {
  const present = amounts.filter(Boolean);
  if (present.includes('heavy')) return 'heavy' as const;
  if (present.includes('medium')) return 'medium' as const;
  if (present.includes('light')) return 'light' as const;
  return undefined;
};

const mergeDiaperAmounts = (
  ordered: BabyEvent[],
  condition: 'wet' | 'dirty' | 'both' | undefined,
) => {
  const wetAmount = maxDiaperAmount(
    ordered.map(event => diaperAmountForSide(event.metadata, 'wet')),
  );
  const dirtyAmount = maxDiaperAmount(
    ordered.map(event => diaperAmountForSide(event.metadata, 'dirty')),
  );

  return condition === 'both'
    ? {
        diaperAmount: undefined,
        wetDiaperAmount: wetAmount,
        dirtyDiaperAmount: dirtyAmount,
      }
    : {
        diaperAmount: condition === 'wet' ? wetAmount : dirtyAmount,
        wetDiaperAmount: undefined,
        dirtyDiaperAmount: undefined,
      };
};

const joinUnique = (values: Array<string | undefined>, separator: string) => {
  const seen = values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(seen)).join(separator);
};

const mergeMetadata = (ordered: BabyEvent[]): BabyEventMetadata | undefined => {
  const target = ordered[0];
  const base = { ...target.metadata };

  switch (target.type) {
    case 'feed':
      return target.metadata?.feedType === 'breast'
        ? { ...base, ...mergeNursing(ordered) }
        : {
            ...base,
            feedType: 'bottle',
            amount: sumAmounts(ordered),
            unit: firstDefined(ordered, 'unit'),
          };
    case 'pumping':
      return {
        ...base,
        pumpingSide: mergeSides(ordered),
        amount: sumAmounts(ordered),
        unit: firstDefined(ordered, 'unit'),
        storageLocation: firstDefined(ordered, 'storageLocation'),
      };
    case 'diaper': {
      const diaperCondition = mergeDiaperCondition(ordered);
      return {
        ...base,
        diaperCondition,
        ...mergeDiaperAmounts(ordered, diaperCondition),
      };
    }
    case 'solids':
      return {
        ...base,
        food:
          joinUnique(
            ordered.map(event => event.metadata?.food),
            ' · ',
          ) || undefined,
        foodAmount: firstDefined(ordered, 'foodAmount'),
        firstExposure: ordered.some(event => event.metadata?.firstExposure)
          ? true
          : base.firstExposure,
        allergen: ordered.some(event => event.metadata?.allergen)
          ? true
          : base.allergen,
      };
    case 'potty':
      return {
        ...base,
        pottyType: ordered.some(
          event =>
            event.metadata?.pottyType &&
            event.metadata.pottyType !== ordered[0].metadata?.pottyType,
        )
          ? 'both'
          : base.pottyType,
      };
    default:
      return Object.keys(base).length ? base : undefined;
  }
};

/**
 * Folds the selected activities into the earliest one: it keeps that record and
 * marks the rest for deletion, so history keeps a single combined entry.
 */
export const buildMergePlan = (events: BabyEvent[]): MergePlan => {
  const blocker = mergeBlocker(events);
  if (blocker) throw new Error(blocker);

  const ordered = byStartTime(events);
  const target = ordered[0];
  const endTime = ordered.reduce<Date>((latest, event) => {
    const eventEnd = event.endTime!;
    return eventEnd.getTime() > latest.getTime() ? eventEnd : latest;
  }, ordered[0].endTime!);

  const metadata = mergeMetadata(ordered);
  const summedMinutes = ordered.reduce(
    (total, event) => total + (event.durationMinutes || 0),
    0,
  );
  const nursingSeconds =
    (metadata?.leftBreastDurationSeconds || 0) +
    (metadata?.rightBreastDurationSeconds || 0);
  const durationMinutes =
    target.type === 'feed' && metadata?.feedType === 'breast' && nursingSeconds > 0
      ? Math.max(1, Math.round(nursingSeconds / 60))
      : summedMinutes > 0
        ? summedMinutes
        : undefined;

  return {
    targetId: target.id!,
    removedIds: ordered.slice(1).map(event => event.id!),
    updates: {
      startTime: target.startTime,
      endTime,
      durationMinutes,
      notes: joinUnique(
        ordered.map(event => event.notes),
        '\n',
      ),
      metadata,
    },
  };
};

export const describeMergeResult = (events: BabyEvent[]) => {
  const plan = buildMergePlan(events);
  const label = careActionByType[events[0].type].label.toLowerCase();
  const metadata = plan.updates.metadata;

  if (metadata?.feedType === 'breast') {
    const left = Math.round((metadata.leftBreastDurationSeconds || 0) / 60);
    const right = Math.round((metadata.rightBreastDurationSeconds || 0) / 60);
    return `${events.length} nursing sessions become one feed — left ${left} min, right ${right} min.`;
  }
  if (metadata?.amount) {
    return `${events.length} ${label}s become one entry of ${metadata.amount} ${metadata.unit || 'ml'}.`;
  }
  if (plan.updates.durationMinutes) {
    return `${events.length} ${label}s become one entry of ${plan.updates.durationMinutes} min.`;
  }
  return `${events.length} ${label}s become one entry.`;
};
