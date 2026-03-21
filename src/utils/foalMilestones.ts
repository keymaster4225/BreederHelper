import { FoalMilestoneKey } from '@/models/types';

export const FOAL_MILESTONE_KEYS: FoalMilestoneKey[] = [
  'stood',
  'nursed',
  'passedMeconium',
  'iggTested',
  'enemaGiven',
  'umbilicalTreated',
  'firstVetCheck',
];

export const FOAL_MILESTONE_LABELS: Record<FoalMilestoneKey, string> = {
  stood: 'Stood',
  nursed: 'Nursed',
  passedMeconium: 'Passed Meconium',
  iggTested: 'IgG Tested',
  enemaGiven: 'Enema Given',
  umbilicalTreated: 'Umbilical Treated',
  firstVetCheck: 'First Vet Check',
};
