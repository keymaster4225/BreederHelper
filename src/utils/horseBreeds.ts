const RAW_HORSE_BREEDS = [
  'Abtenauer',
  'Akhal-Teke',
  'American Bashkir Curly',
  'American Cream Draft',
  'American Saddlebred',
  'American Warmblood',
  'Andalusian',
  'Appaloosa',
  'Appendix Quarter Horse',
  'Arabian',
  'Ardennes',
  'Australian Stock Horse',
  'Azteca',
  'Belgian',
  'Belgian Warmblood',
  'British Warmblood',
  'Canadian Warmblood',
  'Cleveland Bay',
  'Clydesdale',
  'Connemara',
  'Curly Horse',
  'Dales Pony',
  'Danish Warmblood',
  'Dartmoor Pony',
  'Dutch Harness Horse',
  'Falabella',
  'Fell Pony',
  'Fjord',
  'Friesian',
  'Gypsy Vanner',
  'Hackney',
  'Hackney Pony',
  'Haflinger',
  'Hanoverian',
  'Highland Pony',
  'Holsteiner',
  'Icelandic Horse',
  'Irish Draught',
  'Irish Sport Horse',
  'Kentucky Mountain Saddle Horse',
  'Knabstrupper',
  'KWPN',
  'Lipizzan',
  'Lusitano',
  'Mecklenburger',
  'Miniature Horse',
  'Missouri Fox Trotter',
  'Morgan',
  'Mustang',
  'New Forest Pony',
  'Noriker',
  'Oldenburg (GOV)',
  'Oldenburg (ISR/OLD)',
  'Paint',
  'Paso Fino',
  'Percheron',
  'Peruvian Paso',
  'Pinto',
  'Pony of the Americas',
  'Quarter Horse',
  'Racking Horse',
  'Rhinelander',
  'Rocky Mountain Horse',
  'Selle Francais',
  'Shetland Pony',
  'Shire',
  'Spotted Saddle Horse',
  'Standardbred',
  'Suffolk Punch',
  'Swedish Warmblood',
  'Tennessee Walking Horse',
  'Thoroughbred',
  'Trakehner',
  'Warmblood',
  'Welara',
  'Welsh Cob',
  'Welsh Pony',
  'Westfalen',
  'Westphalian',
  'Zangersheide',
  'Zweibrucker',
] as const;

function normalizeBreedText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareBreedNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function dedupeAndSortBreeds(options: readonly string[]): string[] {
  return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort(compareBreedNames);
}

function getBreedMatchScore(normalizedOption: string, normalizedQuery: string): number {
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

export const HORSE_BREEDS: readonly string[] = dedupeAndSortBreeds(RAW_HORSE_BREEDS);

export function getBreedSuggestions(
  query: string,
  options: readonly string[] = HORSE_BREEDS,
  limit = 8,
): string[] {
  const cappedLimit = Math.max(0, limit);
  const sortedBreeds = dedupeAndSortBreeds(options);
  const normalizedQuery = normalizeBreedText(query);

  if (!normalizedQuery) {
    return sortedBreeds.slice(0, cappedLimit);
  }

  return sortedBreeds
    .map((option) => ({
      option,
      score: getBreedMatchScore(normalizeBreedText(option), normalizedQuery),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || compareBreedNames(left.option, right.option))
    .slice(0, cappedLimit)
    .map((entry) => entry.option);
}
