const RAW_CONTAINER_TYPES = [
  'Equitainer',
  'Equine Express II',
  'J bottle',
  'Passive cooler',
  'Dry shipper',
  'Hand carry',
  'Other',
] as const;

function normalizeContainerTypeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareContainerTypes(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function dedupeAndSortContainerTypes(options: readonly string[]): string[] {
  return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort(compareContainerTypes);
}

function getContainerTypeMatchScore(normalizedOption: string, normalizedQuery: string): number {
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

export const CONTAINER_TYPES: readonly string[] = dedupeAndSortContainerTypes(RAW_CONTAINER_TYPES);

export function getContainerTypeSuggestions(
  query: string,
  options: readonly string[] = CONTAINER_TYPES,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const sortedOptions = dedupeAndSortContainerTypes(options);
  const normalizedQuery = normalizeContainerTypeText(query);
  const cappedLimit = Number.isFinite(limit)
    ? Math.max(0, limit)
    : sortedOptions.length;

  if (!normalizedQuery) {
    return sortedOptions.slice(0, cappedLimit);
  }

  return sortedOptions
    .map((option) => ({
      option,
      score: getContainerTypeMatchScore(normalizeContainerTypeText(option), normalizedQuery),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || compareContainerTypes(left.option, right.option))
    .slice(0, cappedLimit)
    .map((entry) => entry.option);
}
