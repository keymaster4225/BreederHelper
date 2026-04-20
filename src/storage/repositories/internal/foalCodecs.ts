import { FoalMilestoneEntry, FoalMilestoneKey, FoalMilestones, IggTest } from '@/models/types';

const VALID_MILESTONE_KEYS = [
  'stood',
  'nursed',
  'passedMeconium',
  'iggTested',
  'enemaGiven',
  'umbilicalTreated',
  'firstVetCheck',
] as const satisfies readonly FoalMilestoneKey[];

const VALID_MILESTONE_KEY_SET: ReadonlySet<string> = new Set<string>(VALID_MILESTONE_KEYS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value: string | null | undefined): unknown[] | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseFoalMilestones(value: string): FoalMilestones {
  const raw = parseJsonObject(value);
  if (!raw) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!VALID_MILESTONE_KEY_SET.has(key)) {
      result[key] = entry;
      continue;
    }
    if (!isRecord(entry)) continue;
    const milestone = entry;
    if (typeof milestone.done !== 'boolean') continue;

    result[key] = {
      ...milestone,
      done: milestone.done,
      recordedAt: typeof milestone.recordedAt === 'string' ? milestone.recordedAt : null,
    } as FoalMilestoneEntry & Record<string, unknown>;
  }

  return result as FoalMilestones;
}

export function parseIggTests(value: string): IggTest[] {
  const raw = parseJsonArray(value);
  if (!raw) {
    return [];
  }

  const result: IggTest[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const test = entry;
    if (typeof test.date !== 'string') continue;
    if (typeof test.valueMgDl !== 'number' || test.valueMgDl <= 0) continue;
    result.push({
      ...test,
      date: test.date,
      valueMgDl: test.valueMgDl,
      recordedAt: typeof test.recordedAt === 'string' ? test.recordedAt : '',
    } as IggTest);
  }

  return result;
}

function isValidIggTestRecord(value: Record<string, unknown>): boolean {
  return (
    typeof value.date === 'string' &&
    typeof value.valueMgDl === 'number' &&
    value.valueMgDl > 0
  );
}

function isFutureCompatibleOpaqueIggTest(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.recordedAt === 'string' &&
    value.recordedAt.length > 0 &&
    Object.keys(value).some((key) => key !== 'recordedAt') &&
    !('date' in value) &&
    !('valueMgDl' in value)
  );
}

export function serializeFoalMilestonesForSave(
  existingValue: string | null | undefined,
  input: FoalMilestones,
): string {
  const existing = parseJsonObject(existingValue) ?? {};
  const inputRecord = isRecord(input as unknown) ? (input as unknown as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(existing)) {
    if (!VALID_MILESTONE_KEY_SET.has(key)) {
      result[key] = entry;
    }
  }

  for (const [key, entry] of Object.entries(inputRecord)) {
    if (!VALID_MILESTONE_KEY_SET.has(key)) {
      result[key] = entry;
    }
  }

  for (const key of VALID_MILESTONE_KEYS) {
    const entry = inputRecord[key];
    if (!isRecord(entry) || typeof entry.done !== 'boolean') continue;

    const mergedEntry = isRecord(existing[key]) ? { ...existing[key] } : {};
    result[key] = {
      ...mergedEntry,
      ...entry,
      done: entry.done,
      recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : null,
    };
  }

  return JSON.stringify(result);
}

function findMatchingIggTestIndex(
  existingTests: readonly (Record<string, unknown> | null)[],
  usedIndexes: ReadonlySet<number>,
  test: Record<string, unknown>,
): number {
  const targetRecordedAt = typeof test.recordedAt === 'string' ? test.recordedAt : null;
  const targetDate = typeof test.date === 'string' ? test.date : null;
  const targetValue = typeof test.valueMgDl === 'number' ? test.valueMgDl : null;

  const findUnusedIndex = (predicate: (candidate: Record<string, unknown>) => boolean): number =>
    existingTests.findIndex(
      (candidate, index) =>
        !usedIndexes.has(index) &&
        candidate !== null &&
        isValidIggTestRecord(candidate) &&
        predicate(candidate),
    );

  if (targetRecordedAt) {
    const recordedAtMatch = findUnusedIndex((candidate) => candidate.recordedAt === targetRecordedAt);
    if (recordedAtMatch !== -1) {
      return recordedAtMatch;
    }
  }

  if (targetDate !== null && targetValue !== null) {
    const exactMatch = findUnusedIndex(
      (candidate) =>
        candidate.date === targetDate &&
        candidate.valueMgDl === targetValue &&
        (targetRecordedAt == null || candidate.recordedAt === targetRecordedAt),
    );
    if (exactMatch !== -1) {
      return exactMatch;
    }

    return findUnusedIndex(
      (candidate) => candidate.date === targetDate && candidate.valueMgDl === targetValue,
    );
  }

  return -1;
}

export function serializeIggTestsForSave(
  existingValue: string | null | undefined,
  input: readonly IggTest[] | undefined,
): string {
  const existingRaw = parseJsonArray(existingValue) ?? [];
  const existing = existingRaw.map((entry) => (isRecord(entry) ? entry : null));
  const usedIndexes = new Set<number>();
  const tests = Array.isArray(input) ? input : [];
  const result: unknown[] = [];

  for (const test of tests) {
    if (!isRecord(test as unknown)) {
      continue;
    }

    const inputRecord = test as unknown as Record<string, unknown>;
    const matchIndex = findMatchingIggTestIndex(existing, usedIndexes, inputRecord);
    if (matchIndex !== -1) {
      usedIndexes.add(matchIndex);
    }

    const serializedEntry = {
      ...(matchIndex === -1 ? {} : existing[matchIndex]),
      ...inputRecord,
      date: inputRecord.date,
      valueMgDl: inputRecord.valueMgDl,
      recordedAt: typeof inputRecord.recordedAt === 'string' ? inputRecord.recordedAt : '',
    };

    result.push(serializedEntry);
  }

  for (const [index, rawEntry] of existingRaw.entries()) {
    if (usedIndexes.has(index)) {
      continue;
    }

    if (isFutureCompatibleOpaqueIggTest(rawEntry)) {
      result.push(rawEntry);
    }
  }

  return JSON.stringify(result);
}
