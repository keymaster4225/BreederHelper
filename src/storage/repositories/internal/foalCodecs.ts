import { FoalMilestoneEntry, FoalMilestoneKey, FoalMilestones, IggTest } from '@/models/types';

const VALID_MILESTONE_KEYS: ReadonlySet<string> = new Set<FoalMilestoneKey>([
  'stood',
  'nursed',
  'passedMeconium',
  'iggTested',
  'enemaGiven',
  'umbilicalTreated',
  'firstVetCheck',
]);

export function parseFoalMilestones(value: string): FoalMilestones {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return {};
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: FoalMilestones = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_MILESTONE_KEYS.has(key)) continue;
    if (typeof entry !== 'object' || entry === null) continue;
    const milestone = entry as Record<string, unknown>;
    if (typeof milestone.done !== 'boolean') continue;

    result[key as FoalMilestoneKey] = {
      done: milestone.done,
      recordedAt: typeof milestone.recordedAt === 'string' ? milestone.recordedAt : null,
    } as FoalMilestoneEntry;
  }

  return result;
}

export function parseIggTests(value: string): IggTest[] {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  const result: IggTest[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const test = entry as Record<string, unknown>;
    if (typeof test.date !== 'string') continue;
    if (typeof test.valueMgDl !== 'number' || test.valueMgDl <= 0) continue;
    result.push({
      date: test.date,
      valueMgDl: test.valueMgDl,
      recordedAt: typeof test.recordedAt === 'string' ? test.recordedAt : '',
    });
  }

  return result;
}
