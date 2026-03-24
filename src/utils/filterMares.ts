import { Mare, PregnancyInfo } from '@/models/types';

export type StatusFilter = 'all' | 'pregnant' | 'open';

export function filterMares(
  mares: readonly Mare[],
  searchText: string,
  statusFilter: StatusFilter,
  pregnantInfo: ReadonlyMap<string, PregnancyInfo>,
): Mare[] {
  const needle = searchText.toLowerCase();

  return mares.filter((mare) => {
    const matchesSearch =
      needle === '' || mare.name.toLowerCase().includes(needle);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pregnant' && pregnantInfo.has(mare.id)) ||
      (statusFilter === 'open' && !pregnantInfo.has(mare.id));

    return matchesSearch && matchesStatus;
  });
}
