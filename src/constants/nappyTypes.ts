export type NappyCondition = 'wet' | 'dirty' | 'both';

/**
 * The three nappies, named and marked the same way everywhere they are offered.
 * Home's quick actions set this wording; the forms follow it so a caregiver
 * never has to work out that "Dirty" and "Poo" are the same thing.
 */
export const nappyTypeOptions: Array<{
  value: NappyCondition;
  label: string;
  icon: string;
}> = [
  { value: 'wet', label: 'Wet', icon: 'water-outline' },
  { value: 'both', label: 'Mixed', icon: 'water-plus-outline' },
  { value: 'dirty', label: 'Poo', icon: 'emoticon-poop-outline' },
];
