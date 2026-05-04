export function sortMeasurementsDesc(values: readonly number[]): number[] {
  return [...values].sort((left, right) => right - left);
}
