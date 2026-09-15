import type { BabyEventType } from '../services/firebase/events';

export interface CareActionDefinition {
  type: BabyEventType;
  label: string;
  pluralLabel: string;
  icon: string;
  color: string;
  category: 'Everyday' | 'Growth and development' | 'Health records';
}

export type HomeActionKey = Exclude<BabyEventType, 'feed'> | 'nursing' | 'bottle';

export interface HomeActionDefinition
  extends Omit<CareActionDefinition, 'type'> {
  type: HomeActionKey;
}

export const defaultHomeActions: HomeActionKey[] = [
  'nursing',
  'bottle',
  'sleep',
  'diaper',
];

export const careActions: CareActionDefinition[] = [
  { type: 'feed', label: 'Feed', pluralLabel: 'Feeds', icon: 'baby-bottle-outline', color: '#FFB5A7', category: 'Everyday' },
  { type: 'sleep', label: 'Sleep', pluralLabel: 'Sleeps', icon: 'sleep', color: '#A9DEF9', category: 'Everyday' },
  { type: 'diaper', label: 'Nappy', pluralLabel: 'Nappies', icon: 'human-baby-changing-table', color: '#D3F8E2', category: 'Everyday' },
  { type: 'pumping', label: 'Pumping', pluralLabel: 'Pumping', icon: 'water-outline', color: '#BDE5D6', category: 'Everyday' },
  { type: 'solids', label: 'Solids', pluralLabel: 'Solids', icon: 'food-apple-outline', color: '#FFE0A8', category: 'Everyday' },
  { type: 'potty', label: 'Potty', pluralLabel: 'Potty', icon: 'toilet', color: '#CDECCF', category: 'Everyday' },
  { type: 'tummyTime', label: 'Tummy time', pluralLabel: 'Tummy time', icon: 'baby-face-outline', color: '#FDE2E4', category: 'Everyday' },
  { type: 'bath', label: 'Bath', pluralLabel: 'Baths', icon: 'bathtub-outline', color: '#D8E8FF', category: 'Everyday' },
  { type: 'growth', label: 'Growth', pluralLabel: 'Growth', icon: 'chart-line', color: '#D8D4FF', category: 'Growth and development' },
  { type: 'milestone', label: 'Milestone', pluralLabel: 'Milestones', icon: 'star-outline', color: '#FFF1B8', category: 'Growth and development' },
  { type: 'teething', label: 'Teething', pluralLabel: 'Teething', icon: 'tooth-outline', color: '#E9E0F7', category: 'Growth and development' },
  { type: 'temperature', label: 'Temperature', pluralLabel: 'Temperatures', icon: 'thermometer', color: '#FFD1C7', category: 'Health records' },
  { type: 'medication', label: 'Medicine', pluralLabel: 'Medicines', icon: 'pill', color: '#FFE5D9', category: 'Health records' },
  { type: 'symptom', label: 'Observation', pluralLabel: 'Observations', icon: 'clipboard-text-outline', color: '#F3D5E5', category: 'Health records' },
  { type: 'appointment', label: 'Appointment', pluralLabel: 'Appointments', icon: 'calendar-clock-outline', color: '#D5E8F5', category: 'Health records' },
  { type: 'immunization', label: 'Immunisation', pluralLabel: 'Immunisations', icon: 'needle', color: '#D7E9DF', category: 'Health records' },
];

export const careActionByType = Object.fromEntries(
  careActions.map(action => [action.type, action]),
) as Record<BabyEventType, CareActionDefinition>;

export const homeCareActions: HomeActionDefinition[] = [
  {
    ...careActionByType.feed,
    type: 'nursing',
    label: 'Nursing',
    pluralLabel: 'Nursing',
    icon: 'mother-nurse',
  },
  {
    ...careActionByType.feed,
    type: 'bottle',
    label: 'Bottle',
    pluralLabel: 'Bottles',
    icon: 'baby-bottle-outline',
  },
  ...careActions
    .filter(action => action.type !== 'feed')
    .map(action => ({ ...action, type: action.type as HomeActionKey })),
];

export const orderHomeCareActionsForCustomising = (
  actions: readonly HomeActionKey[],
): HomeActionDefinition[] => {
  const selectedTypes = new Set<HomeActionKey>();
  const selectedActions: HomeActionDefinition[] = [];

  actions.forEach(type => {
    const action = homeCareActions.find(item => item.type === type);
    if (action && !selectedTypes.has(type)) {
      selectedTypes.add(type);
      selectedActions.push(action);
    }
  });

  return [
    ...selectedActions,
    ...homeCareActions.filter(action => !selectedTypes.has(action.type)),
  ];
};

export const sanitizeHomeActions = (value: unknown): HomeActionKey[] => {
  if (!Array.isArray(value)) return defaultHomeActions;
  const valid = new Set(homeCareActions.map(action => action.type));
  const result: HomeActionKey[] = [];

  value.forEach(type => {
    const migratedTypes = type === 'feed' ? ['nursing', 'bottle'] : [type];
    migratedTypes.forEach(migratedType => {
      if (
        typeof migratedType === 'string' &&
        valid.has(migratedType as HomeActionKey) &&
        !result.includes(migratedType as HomeActionKey)
      ) {
        result.push(migratedType as HomeActionKey);
      }
    });
  });

  return result.length ? result : defaultHomeActions;
};
