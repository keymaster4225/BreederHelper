import {
  createBreedingRecord,
  createDailyLog,
  createFoal,
  createFoalingRecord,
  createMare,
  createPregnancyCheck,
  createStallion,
} from '@/storage/repositories';
import { newId } from '@/utils/id';

/**
 * Inserts sample data for development/testing.
 * Creates 3 mares at different reproductive stages, 2 stallions,
 * and a spread of daily logs, breedings, pregnancy checks, and foaling records.
 *
 * Only call in __DEV__ mode.
 */
export async function seedSampleData(): Promise<void> {
  // --- Stallions ---
  const stallionA = newId();
  const stallionB = newId();

  await createStallion({ id: stallionA, name: 'Midnight Express', breed: 'Thoroughbred' });
  await createStallion({ id: stallionB, name: 'Golden Oak', breed: 'Warmblood' });

  // --- Mare 1: "Bella Star" — bred, confirmed pregnant ---
  const mare1 = newId();
  await createMare({ id: mare1, name: 'Bella Star', breed: 'Quarter Horse', dateOfBirth: '2018-04-12' });

  // Daily logs: heat cycle leading to ovulation
  await createDailyLog({ id: newId(), mareId: mare1, date: '2026-02-20', teasingScore: 2, edema: 1 });
  await createDailyLog({ id: newId(), mareId: mare1, date: '2026-02-22', teasingScore: 3, edema: 2 });
  await createDailyLog({ id: newId(), mareId: mare1, date: '2026-02-24', teasingScore: 4, edema: 3, rightOvary: '35mm follicle' });
  await createDailyLog({ id: newId(), mareId: mare1, date: '2026-02-25', teasingScore: 5, edema: 4, rightOvary: '38mm follicle', leftOvary: 'quiet' });
  await createDailyLog({ id: newId(), mareId: mare1, date: '2026-02-26', teasingScore: 5, edema: 4, ovulationDetected: true, rightOvary: 'ovulated' });
  await createDailyLog({ id: newId(), mareId: mare1, date: '2026-02-27', teasingScore: 2, edema: 1 });

  // Breeding on the day before ovulation
  const breeding1 = newId();
  await createBreedingRecord({ id: breeding1, mareId: mare1, stallionId: stallionA, date: '2026-02-25', method: 'liveCover' });

  // Pregnancy checks: 14-day and 30-day
  await createPregnancyCheck({ id: newId(), mareId: mare1, breedingRecordId: breeding1, date: '2026-03-11', result: 'positive', heartbeatDetected: false });
  await createPregnancyCheck({ id: newId(), mareId: mare1, breedingRecordId: breeding1, date: '2026-03-27', result: 'positive', heartbeatDetected: true });

  // --- Mare 2: "Desert Rose" — foaled last season, currently open ---
  const mare2 = newId();
  await createMare({ id: mare2, name: 'Desert Rose', breed: 'Arabian', dateOfBirth: '2016-05-03' });

  // Last year's breeding cycle
  const breeding2 = newId();
  await createBreedingRecord({ id: breeding2, mareId: mare2, stallionId: stallionB, date: '2025-03-10', method: 'frozenAI', numberOfStraws: 2, strawVolumeMl: 5 });
  await createPregnancyCheck({ id: newId(), mareId: mare2, breedingRecordId: breeding2, date: '2025-03-24', result: 'positive' });

  const foaling2 = newId();
  await createFoalingRecord({ id: foaling2, mareId: mare2, breedingRecordId: breeding2, date: '2026-01-15', outcome: 'liveFoal', foalSex: 'filly' });
  await createFoal({ id: newId(), foalingRecordId: foaling2, name: 'Sahara Dawn', sex: 'filly', color: 'bay', birthWeightLbs: 95, milestones: { stood: { done: true }, nursed: { done: true }, passedMeconium: { done: true }, iggTested: { done: true } } });

  // Current season: recent heat activity (no breeding yet)
  await createDailyLog({ id: newId(), mareId: mare2, date: '2026-03-22', teasingScore: 3, edema: 2 });
  await createDailyLog({ id: newId(), mareId: mare2, date: '2026-03-24', teasingScore: 4, edema: 3, leftOvary: '30mm follicle' });
  await createDailyLog({ id: newId(), mareId: mare2, date: '2026-03-25', teasingScore: 5, edema: 4, leftOvary: '36mm follicle' });

  // --- Mare 3: "Clover" — early in cycle, just starting teasing ---
  const mare3 = newId();
  await createMare({ id: mare3, name: 'Clover', breed: 'Warmblood', dateOfBirth: '2020-03-28', notes: 'Maiden mare, first breeding season' });

  await createDailyLog({ id: newId(), mareId: mare3, date: '2026-03-23', teasingScore: 1, edema: 0 });
  await createDailyLog({ id: newId(), mareId: mare3, date: '2026-03-25', teasingScore: 2, edema: 1 });
  await createDailyLog({ id: newId(), mareId: mare3, date: '2026-03-26', teasingScore: 2, edema: 1, notes: 'Winking, no strong signs yet' });
}
