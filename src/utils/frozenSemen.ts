export type FrozenDoseAvailability = {
  fullDoses: number;
  leftoverStraws: number;
};

export function computeTotalSpermPerStrawMillions(
  concentrationMillionsPerMl: number | null,
  strawVolumeMl: number | null,
): number | null {
  if (concentrationMillionsPerMl == null || strawVolumeMl == null) {
    return null;
  }

  if (!Number.isFinite(concentrationMillionsPerMl) || !Number.isFinite(strawVolumeMl)) {
    return null;
  }

  if (concentrationMillionsPerMl < 0 || strawVolumeMl < 0) {
    return null;
  }

  return concentrationMillionsPerMl * strawVolumeMl;
}

export function computeDosesAvailable(
  strawsRemaining: number,
  strawsPerDose: number | null,
): FrozenDoseAvailability | null {
  if (strawsPerDose == null) {
    return null;
  }

  if (!Number.isInteger(strawsPerDose) || strawsPerDose <= 0) {
    return null;
  }

  if (!Number.isInteger(strawsRemaining) || strawsRemaining < 0) {
    return null;
  }

  return {
    fullDoses: Math.floor(strawsRemaining / strawsPerDose),
    leftoverStraws: strawsRemaining % strawsPerDose,
  };
}
