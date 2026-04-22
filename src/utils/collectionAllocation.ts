export interface AllocationRow {
  doseSemenVolumeMl: number | null;
  doseCount: number;
}

export interface AllocationSummary {
  totalAllocatedMl: number;
  remainingMl: number | null;
  blankVolumeRowCount: number;
  exceededByMl: number;
  isWithinCap: boolean;
}

function normalizeDoseCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value;
}

export function computeAllocationSummary(
  rows: readonly AllocationRow[],
  rawVolumeMl: number | null,
): AllocationSummary {
  let totalAllocatedMl = 0;
  let blankVolumeRowCount = 0;

  for (const row of rows) {
    if (row.doseSemenVolumeMl == null) {
      blankVolumeRowCount += 1;
      continue;
    }

    if (!Number.isFinite(row.doseSemenVolumeMl) || row.doseSemenVolumeMl < 0) {
      continue;
    }

    totalAllocatedMl += row.doseSemenVolumeMl * normalizeDoseCount(row.doseCount);
  }

  const hasCap =
    rawVolumeMl != null && Number.isFinite(rawVolumeMl) && rawVolumeMl >= 0;
  const remainingMl = hasCap ? rawVolumeMl - totalAllocatedMl : null;
  const exceededByMl = remainingMl != null && remainingMl < 0 ? Math.abs(remainingMl) : 0;

  return {
    totalAllocatedMl,
    remainingMl,
    blankVolumeRowCount,
    exceededByMl,
    isWithinCap: exceededByMl <= 0,
  };
}
