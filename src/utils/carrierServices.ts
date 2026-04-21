const RAW_CARRIER_SERVICES = [
  'FedEx Priority Overnight',
  'FedEx Standard Overnight',
  'UPS Next Day Air',
  'UPS Next Day Air Saver',
  'Counter-to-counter',
  'Dedicated courier',
  'Personal pickup',
  'Other',
] as const;

function normalizeCarrierServiceText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareCarrierServices(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function dedupeAndSortCarrierServices(options: readonly string[]): string[] {
  return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort(compareCarrierServices);
}

function getCarrierServiceMatchScore(normalizedOption: string, normalizedQuery: string): number {
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

export const CARRIER_SERVICES: readonly string[] = dedupeAndSortCarrierServices(RAW_CARRIER_SERVICES);

export function getCarrierServiceSuggestions(
  query: string,
  options: readonly string[] = CARRIER_SERVICES,
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const sortedOptions = dedupeAndSortCarrierServices(options);
  const normalizedQuery = normalizeCarrierServiceText(query);
  const cappedLimit = Number.isFinite(limit)
    ? Math.max(0, limit)
    : sortedOptions.length;

  if (!normalizedQuery) {
    return sortedOptions.slice(0, cappedLimit);
  }

  return sortedOptions
    .map((option) => ({
      option,
      score: getCarrierServiceMatchScore(normalizeCarrierServiceText(option), normalizedQuery),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || compareCarrierServices(left.option, right.option))
    .slice(0, cappedLimit)
    .map((entry) => entry.option);
}
