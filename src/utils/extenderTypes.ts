const RAW_EXTENDER_TYPES = [
  'INRA 96',
  'Kenney',
  'BotuSemen',
  'BotuSemen Gold',
  'BotuSemen Special',
  'E-Z Mixin',
  'Lactose-Chelate',
  'Milk-Based',
  'Skim Milk Glucose',
  'Other',
] as const;

function normalizeExtenderText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareExtenderNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function dedupeAndSortExtenders(options: readonly string[]): string[] {
  return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort(compareExtenderNames);
}

function getExtenderMatchScore(normalizedOption: string, normalizedQuery: string): number {
  if (normalizedOption === normalizedQuery) {
    return 0;
  }

  if (normalizedOption.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedOption.split(' ').some((token) => token.startsWith(normalizedQuery))) {
    return 2;
  }

  if (normalizedOption.includes(normalizedQuery)) {
    return 3;
  }

  return Number.POSITIVE_INFINITY;
}

export const EXTENDER_TYPES: readonly string[] = dedupeAndSortExtenders(RAW_EXTENDER_TYPES);

export function getExtenderTypeSuggestions(
  query: string,
  options: readonly string[] = EXTENDER_TYPES,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const sortedTypes = dedupeAndSortExtenders(options);
  const normalizedQuery = normalizeExtenderText(query);
  const cappedLimit = Number.isFinite(limit)
    ? Math.max(0, limit)
    : sortedTypes.length;

  if (!normalizedQuery) {
    return sortedTypes.slice(0, cappedLimit);
  }

  return sortedTypes
    .map((option) => ({
      option,
      score: getExtenderMatchScore(normalizeExtenderText(option), normalizedQuery),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || compareExtenderNames(left.option, right.option))
    .slice(0, cappedLimit)
    .map((entry) => entry.option);
}
