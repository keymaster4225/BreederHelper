import type { BackupIsoDateTime, BackupLocalDate } from '@/storage/backup/types';

import type { HorseTransferSourceHorse } from './types';

const DEFAULT_FUZZY_THRESHOLD = 0.6;
const SUFFIX_TOKENS = new Set(['farm', 'farms', 'ranch', 'rsf', 'llc', 'inc', 'sr', 'jr']);

export type HorseMatchRule = 'id' | 'registration' | 'nameAndDob';

export type HorseIdentityMatch = {
  readonly id: string;
  readonly name: string;
  readonly registrationNumber: string | null;
  readonly dateOfBirth: BackupLocalDate | null;
  readonly deletedAt: BackupIsoDateTime | null;
};

export type HorseFuzzySuggestion = {
  readonly horse: HorseIdentityMatch;
  readonly score: number;
};

export type HorseMatchAmbiguityReason =
  | 'conflicting_exact_matches'
  | 'soft_deleted_id_match'
  | 'id_identity_conflict'
  | 'multiple_registration_matches'
  | 'multiple_name_dob_matches';

export type HorseMatchResult =
  | {
      readonly state: 'matched';
      readonly matchedBy: HorseMatchRule;
      readonly horse: HorseIdentityMatch;
      readonly fuzzySuggestions: readonly HorseFuzzySuggestion[];
    }
  | {
      readonly state: 'create_new';
      readonly fuzzySuggestions: readonly HorseFuzzySuggestion[];
    }
  | {
      readonly state: 'ambiguous';
      readonly reasons: readonly HorseMatchAmbiguityReason[];
      readonly candidates: readonly HorseIdentityMatch[];
      readonly fuzzySuggestions: readonly HorseFuzzySuggestion[];
    };

export type MatchHorseTransferInput = {
  readonly sourceHorse: HorseTransferSourceHorse;
  readonly destinationHorses: readonly HorseIdentityMatch[];
  readonly fuzzyThreshold?: number;
};

export function matchHorseTransfer(input: MatchHorseTransferInput): HorseMatchResult {
  const fuzzyThreshold = resolveFuzzyThreshold(input.fuzzyThreshold);
  const idMatch = input.destinationHorses.find((horse) => horse.id === input.sourceHorse.id) ?? null;
  const registrationMatches = findRegistrationMatches(input.sourceHorse, input.destinationHorses);
  const nameDobMatches = findNameDobMatches(input.sourceHorse, input.destinationHorses);

  const reasons = new Set<HorseMatchAmbiguityReason>();
  if (registrationMatches.length > 1) {
    reasons.add('multiple_registration_matches');
  }
  if (nameDobMatches.length > 1) {
    reasons.add('multiple_name_dob_matches');
  }

  const exactSignals = [
    idMatch ? { rule: 'id' as const, horse: idMatch } : null,
    registrationMatches.length === 1
      ? { rule: 'registration' as const, horse: registrationMatches[0] }
      : null,
    nameDobMatches.length === 1 ? { rule: 'nameAndDob' as const, horse: nameDobMatches[0] } : null,
  ].filter((signal): signal is { readonly rule: HorseMatchRule; readonly horse: HorseIdentityMatch } =>
    signal !== null,
  );

  if (pointsToDifferentHorses(exactSignals)) {
    reasons.add('conflicting_exact_matches');
  }

  if (idMatch?.deletedAt) {
    reasons.add('soft_deleted_id_match');
  }

  if (idMatch && idMatchRequiresIdentityConfirmation(input.sourceHorse, idMatch)) {
    reasons.add('id_identity_conflict');
  }

  const fuzzySuggestions = buildFuzzySuggestions({
    sourceHorse: input.sourceHorse,
    destinationHorses: input.destinationHorses,
    fuzzyThreshold,
  });

  if (reasons.size > 0) {
    return {
      state: 'ambiguous',
      reasons: Array.from(reasons.values()),
      candidates: collectCandidates(exactSignals, registrationMatches, nameDobMatches),
      fuzzySuggestions,
    };
  }

  if (idMatch) {
    return {
      state: 'matched',
      matchedBy: 'id',
      horse: idMatch,
      fuzzySuggestions: [],
    };
  }

  if (registrationMatches.length === 1) {
    return {
      state: 'matched',
      matchedBy: 'registration',
      horse: registrationMatches[0],
      fuzzySuggestions: [],
    };
  }

  if (nameDobMatches.length === 1) {
    return {
      state: 'matched',
      matchedBy: 'nameAndDob',
      horse: nameDobMatches[0],
      fuzzySuggestions: [],
    };
  }

  return {
    state: 'create_new',
    fuzzySuggestions,
  };
}

function findRegistrationMatches(
  sourceHorse: HorseTransferSourceHorse,
  destinationHorses: readonly HorseIdentityMatch[],
): readonly HorseIdentityMatch[] {
  const sourceRegistration = normalizeRegistrationNumber(sourceHorse.registrationNumber);
  if (!sourceRegistration) {
    return [];
  }

  return destinationHorses.filter((horse) => {
    const horseRegistration = normalizeRegistrationNumber(horse.registrationNumber);
    return horseRegistration === sourceRegistration;
  });
}

function findNameDobMatches(
  sourceHorse: HorseTransferSourceHorse,
  destinationHorses: readonly HorseIdentityMatch[],
): readonly HorseIdentityMatch[] {
  if (!sourceHorse.dateOfBirth) {
    return [];
  }

  const normalizedSourceName = normalizeExactName(sourceHorse.name);
  return destinationHorses.filter((horse) => {
    if (!horse.dateOfBirth) {
      return false;
    }

    return horse.dateOfBirth === sourceHorse.dateOfBirth &&
      normalizeExactName(horse.name) === normalizedSourceName;
  });
}

function pointsToDifferentHorses(
  exactSignals: readonly { readonly rule: HorseMatchRule; readonly horse: HorseIdentityMatch }[],
): boolean {
  if (exactSignals.length <= 1) {
    return false;
  }

  const horseIds = new Set(exactSignals.map((signal) => signal.horse.id));
  return horseIds.size > 1;
}

function collectCandidates(
  exactSignals: readonly { readonly rule: HorseMatchRule; readonly horse: HorseIdentityMatch }[],
  registrationMatches: readonly HorseIdentityMatch[],
  nameDobMatches: readonly HorseIdentityMatch[],
): readonly HorseIdentityMatch[] {
  const byId = new Map<string, HorseIdentityMatch>();

  for (const signal of exactSignals) {
    byId.set(signal.horse.id, signal.horse);
  }
  for (const horse of registrationMatches) {
    byId.set(horse.id, horse);
  }
  for (const horse of nameDobMatches) {
    byId.set(horse.id, horse);
  }

  return Array.from(byId.values()).sort(compareHorseByNameThenId);
}

type BuildFuzzySuggestionsInput = {
  readonly sourceHorse: HorseTransferSourceHorse;
  readonly destinationHorses: readonly HorseIdentityMatch[];
  readonly fuzzyThreshold: number;
};

function buildFuzzySuggestions(input: BuildFuzzySuggestionsInput): readonly HorseFuzzySuggestion[] {
  const normalizedSourceName = normalizeFuzzyName(input.sourceHorse.name);
  if (!normalizedSourceName) {
    return [];
  }

  const suggestions: HorseFuzzySuggestion[] = [];

  for (const horse of input.destinationHorses) {
    if (horse.deletedAt) {
      continue;
    }

    if (hasRegistrationConflict(input.sourceHorse, horse)) {
      continue;
    }

    if (hasDobConflict(input.sourceHorse, horse)) {
      continue;
    }

    const candidateName = normalizeFuzzyName(horse.name);
    if (!candidateName) {
      continue;
    }

    const score = scoreFuzzyNameSimilarity(normalizedSourceName, candidateName);
    if (score >= input.fuzzyThreshold) {
      suggestions.push({
        horse,
        score: roundScore(score),
      });
    }
  }

  suggestions.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return compareHorseByNameThenId(left.horse, right.horse);
  });

  return suggestions;
}

function hasRegistrationConflict(
  sourceHorse: HorseTransferSourceHorse,
  destinationHorse: HorseIdentityMatch,
): boolean {
  const sourceRegistration = normalizeRegistrationNumber(sourceHorse.registrationNumber);
  const destinationRegistration = normalizeRegistrationNumber(destinationHorse.registrationNumber);
  return sourceRegistration !== null &&
    destinationRegistration !== null &&
    sourceRegistration !== destinationRegistration;
}

function hasDobConflict(
  sourceHorse: HorseTransferSourceHorse,
  destinationHorse: HorseIdentityMatch,
): boolean {
  return sourceHorse.dateOfBirth !== null &&
    destinationHorse.dateOfBirth !== null &&
    sourceHorse.dateOfBirth !== destinationHorse.dateOfBirth;
}

function idMatchRequiresIdentityConfirmation(
  sourceHorse: HorseTransferSourceHorse,
  idMatch: HorseIdentityMatch,
): boolean {
  const checks = [
    compareRegistrationIdentity(sourceHorse, idMatch),
    compareNameDobIdentity(sourceHorse, idMatch),
  ];

  const comparableChecks = checks.filter((check) => check !== 'unknown');
  if (comparableChecks.length === 0) {
    return false;
  }

  return comparableChecks.every((check) => check === 'mismatch');
}

function compareRegistrationIdentity(
  sourceHorse: HorseTransferSourceHorse,
  destinationHorse: HorseIdentityMatch,
): 'match' | 'mismatch' | 'unknown' {
  const sourceRegistration = normalizeRegistrationNumber(sourceHorse.registrationNumber);
  const destinationRegistration = normalizeRegistrationNumber(destinationHorse.registrationNumber);
  if (!sourceRegistration || !destinationRegistration) {
    return 'unknown';
  }

  return sourceRegistration === destinationRegistration ? 'match' : 'mismatch';
}

function compareNameDobIdentity(
  sourceHorse: HorseTransferSourceHorse,
  destinationHorse: HorseIdentityMatch,
): 'match' | 'mismatch' | 'unknown' {
  if (!sourceHorse.dateOfBirth || !destinationHorse.dateOfBirth) {
    return 'unknown';
  }

  const dobMatches = sourceHorse.dateOfBirth === destinationHorse.dateOfBirth;
  const nameMatches = normalizeExactName(sourceHorse.name) === normalizeExactName(destinationHorse.name);
  return dobMatches && nameMatches ? 'match' : 'mismatch';
}

function normalizeExactName(name: string): string {
  return collapseWhitespace(name).toLowerCase();
}

function normalizeFuzzyName(name: string): string {
  const sanitized = collapseWhitespace(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = sanitized.split(' ').filter(Boolean);

  while (tokens.length > 1 && SUFFIX_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(' ');
}

function normalizeRegistrationNumber(registrationNumber: string | null): string | null {
  if (!registrationNumber) {
    return null;
  }

  const normalized = collapseWhitespace(registrationNumber).toLowerCase();
  return normalized === '' ? null : normalized;
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function scoreFuzzyNameSimilarity(leftName: string, rightName: string): number {
  if (leftName === rightName) {
    return 1;
  }

  const leftTokens = tokenize(leftName);
  const rightTokens = tokenize(rightName);
  const tokenOverlap = calculateJaccard(leftTokens, rightTokens);
  const tokenContainment = isTokenContained(leftTokens, rightTokens) ? 0.85 : 0;
  const trigramSimilarity = calculateTrigramDice(leftName, rightName);

  return Math.max(tokenContainment, (tokenOverlap + trigramSimilarity) / 2);
}

function tokenize(name: string): readonly string[] {
  return name.split(' ').filter(Boolean);
}

function isTokenContained(leftTokens: readonly string[], rightTokens: readonly string[]): boolean {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  return isSubset(leftSet, rightSet) || isSubset(rightSet, leftSet);
}

function isSubset(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function calculateJaccard(leftTokens: readonly string[], rightTokens: readonly string[]): number {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  }

  const union = leftSet.size + rightSet.size - intersection;
  if (union === 0) {
    return 0;
  }

  return intersection / union;
}

function calculateTrigramDice(left: string, right: string): number {
  const leftTrigrams = buildTrigrams(left);
  const rightTrigrams = buildTrigrams(right);

  if (leftTrigrams.length === 0 || rightTrigrams.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();
  for (const trigram of rightTrigrams) {
    rightCounts.set(trigram, (rightCounts.get(trigram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const trigram of leftTrigrams) {
    const count = rightCounts.get(trigram) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(trigram, count - 1);
    }
  }

  return (2 * overlap) / (leftTrigrams.length + rightTrigrams.length);
}

function buildTrigrams(input: string): readonly string[] {
  const normalized = input.replace(/\s+/g, ' ');
  const padded = `  ${normalized}  `;
  const result: string[] = [];

  for (let index = 0; index <= padded.length - 3; index += 1) {
    result.push(padded.slice(index, index + 3));
  }

  return result;
}

function compareHorseByNameThenId(left: HorseIdentityMatch, right: HorseIdentityMatch): number {
  const byName = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  if (byName !== 0) {
    return byName;
  }
  return left.id.localeCompare(right.id);
}

function resolveFuzzyThreshold(inputThreshold: number | undefined): number {
  if (inputThreshold === undefined || Number.isNaN(inputThreshold)) {
    return DEFAULT_FUZZY_THRESHOLD;
  }

  if (inputThreshold < 0) {
    return 0;
  }
  if (inputThreshold > 1) {
    return 1;
  }
  return inputThreshold;
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
