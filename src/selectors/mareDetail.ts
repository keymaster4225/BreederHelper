import { BreedingRecord, Foal, Stallion } from '@/models/types';

export function buildBreedingById(
  breedingRecords: readonly BreedingRecord[]
): Readonly<Record<string, BreedingRecord>> {
  return Object.fromEntries(breedingRecords.map((record) => [record.id, record]));
}

export function buildFoalByFoalingRecordId(
  foals: readonly Foal[]
): Readonly<Record<string, Foal>> {
  return Object.fromEntries(foals.map((foal) => [foal.foalingRecordId, foal]));
}

export function buildStallionNameById(
  stallions: readonly Stallion[]
): Readonly<Record<string, string>> {
  return Object.fromEntries(stallions.map((stallion) => [stallion.id, stallion.name]));
}
