import {
  createBreedingRecord,
  createDailyLog,
  createFoal,
  createFoalingRecord,
  createMare,
  getBreedingRecordById,
  getDailyLogById,
  getFoalById,
  getFoalingRecordById,
  getMareById,
  createPregnancyCheck,
  getPregnancyCheckById,
  createStallion,
  getStallionById,
} from '@/storage/repositories';
export type SeedPreviewDataResult = 'inserted' | 'alreadySeeded';

const previewIds = {
  stallionA: 'preview-seed-stallion-midnight-express',
  stallionB: 'preview-seed-stallion-golden-oak',
  mareBella: 'preview-seed-mare-bella-star',
  mareDesertRose: 'preview-seed-mare-desert-rose',
  mareClover: 'preview-seed-mare-clover',
  bellaLog1: 'preview-seed-bella-log-1',
  bellaLog2: 'preview-seed-bella-log-2',
  bellaLog3: 'preview-seed-bella-log-3',
  bellaLog4: 'preview-seed-bella-log-4',
  bellaLog5: 'preview-seed-bella-log-5',
  bellaLog5FollowUp: 'preview-seed-bella-log-5-followup',
  bellaLog6: 'preview-seed-bella-log-6',
  desertLog1: 'preview-seed-desert-log-1',
  desertLog2: 'preview-seed-desert-log-2',
  desertLog3: 'preview-seed-desert-log-3',
  cloverLog1: 'preview-seed-clover-log-1',
  cloverLog2: 'preview-seed-clover-log-2',
  cloverLog3: 'preview-seed-clover-log-3',
  bellaBreeding: 'preview-seed-bella-breeding',
  desertBreeding: 'preview-seed-desert-breeding',
  bellaPregCheck1: 'preview-seed-bella-preg-check-1',
  bellaPregCheck2: 'preview-seed-bella-preg-check-2',
  desertPregCheck: 'preview-seed-desert-preg-check',
  desertFoaling: 'preview-seed-desert-foaling',
  saharaFoal: 'preview-seed-sahara-dawn',
} as const;

async function ensureRecordExists(
  exists: () => Promise<unknown>,
  create: () => Promise<void>,
): Promise<boolean> {
  if (await exists()) {
    return false;
  }

  await create();
  return true;
}

export async function seedPreviewData(): Promise<SeedPreviewDataResult> {
  let insertedAny = false;

  insertedAny =
    (await ensureRecordExists(
      () => getStallionById(previewIds.stallionA),
      () => createStallion({ id: previewIds.stallionA, name: 'Midnight Express', breed: 'Thoroughbred' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getStallionById(previewIds.stallionB),
      () => createStallion({ id: previewIds.stallionB, name: 'Golden Oak', breed: 'Warmblood' }),
    )) || insertedAny;

  insertedAny =
    (await ensureRecordExists(
      () => getMareById(previewIds.mareBella),
      () => createMare({
        id: previewIds.mareBella,
        name: 'Bella Star',
        breed: 'Quarter Horse',
        gestationLengthDays: 340,
        dateOfBirth: '2018-04-12',
        isRecipient: false,
      }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog1),
      () => createDailyLog({ id: previewIds.bellaLog1, mareId: previewIds.mareBella, date: '2026-02-20', time: '08:00', teasingScore: 2, edema: 1 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog2),
      () => createDailyLog({ id: previewIds.bellaLog2, mareId: previewIds.mareBella, date: '2026-02-22', time: '08:15', teasingScore: 3, edema: 2 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog3),
      () => createDailyLog({ id: previewIds.bellaLog3, mareId: previewIds.mareBella, date: '2026-02-24', time: '07:45', teasingScore: 4, edema: 3, rightOvary: '35mm follicle' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog4),
      () => createDailyLog({ id: previewIds.bellaLog4, mareId: previewIds.mareBella, date: '2026-02-25', time: '07:30', teasingScore: 5, edema: 4, rightOvary: '38mm follicle', leftOvary: 'quiet' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog5),
      () => createDailyLog({ id: previewIds.bellaLog5, mareId: previewIds.mareBella, date: '2026-02-26', time: '07:10', teasingScore: 5, edema: 4, ovulationDetected: true, rightOvary: 'ovulated' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog5FollowUp),
      () => createDailyLog({ id: previewIds.bellaLog5FollowUp, mareId: previewIds.mareBella, date: '2026-02-26', time: '15:45', teasingScore: 2, edema: 1, notes: 'Afternoon recheck after ovulation' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.bellaLog6),
      () => createDailyLog({ id: previewIds.bellaLog6, mareId: previewIds.mareBella, date: '2026-02-27', time: '08:30', teasingScore: 2, edema: 1 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getBreedingRecordById(previewIds.bellaBreeding),
      () => createBreedingRecord({ id: previewIds.bellaBreeding, mareId: previewIds.mareBella, stallionId: previewIds.stallionA, date: '2026-02-25', method: 'liveCover' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.bellaPregCheck1),
      () => createPregnancyCheck({ id: previewIds.bellaPregCheck1, mareId: previewIds.mareBella, breedingRecordId: previewIds.bellaBreeding, date: '2026-03-11', result: 'positive', heartbeatDetected: false }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.bellaPregCheck2),
      () => createPregnancyCheck({ id: previewIds.bellaPregCheck2, mareId: previewIds.mareBella, breedingRecordId: previewIds.bellaBreeding, date: '2026-03-27', result: 'positive', heartbeatDetected: true }),
    )) || insertedAny;

  insertedAny =
    (await ensureRecordExists(
      () => getMareById(previewIds.mareDesertRose),
      () => createMare({
        id: previewIds.mareDesertRose,
        name: 'Desert Rose',
        breed: 'Arabian',
        gestationLengthDays: 340,
        dateOfBirth: '2016-05-03',
        isRecipient: false,
      }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getBreedingRecordById(previewIds.desertBreeding),
      () => createBreedingRecord({ id: previewIds.desertBreeding, mareId: previewIds.mareDesertRose, stallionId: previewIds.stallionB, date: '2025-03-10', method: 'frozenAI', numberOfStraws: 2, strawVolumeMl: 5 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.desertPregCheck),
      () => createPregnancyCheck({ id: previewIds.desertPregCheck, mareId: previewIds.mareDesertRose, breedingRecordId: previewIds.desertBreeding, date: '2025-03-24', result: 'positive' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getFoalingRecordById(previewIds.desertFoaling),
      () => createFoalingRecord({ id: previewIds.desertFoaling, mareId: previewIds.mareDesertRose, breedingRecordId: previewIds.desertBreeding, date: '2026-01-15', outcome: 'liveFoal', foalSex: 'filly' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getFoalById(previewIds.saharaFoal),
      () => createFoal({
        id: previewIds.saharaFoal,
        foalingRecordId: previewIds.desertFoaling,
        name: 'Sahara Dawn',
        sex: 'filly',
        color: 'bay',
        birthWeightLbs: 95,
        milestones: { stood: { done: true }, nursed: { done: true }, passedMeconium: { done: true }, iggTested: { done: true } },
      }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.desertLog1),
      () => createDailyLog({ id: previewIds.desertLog1, mareId: previewIds.mareDesertRose, date: '2026-03-22', time: '08:20', teasingScore: 3, edema: 2 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.desertLog2),
      () => createDailyLog({ id: previewIds.desertLog2, mareId: previewIds.mareDesertRose, date: '2026-03-24', time: '08:00', teasingScore: 4, edema: 3, leftOvary: '30mm follicle' }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.desertLog3),
      () => createDailyLog({ id: previewIds.desertLog3, mareId: previewIds.mareDesertRose, date: '2026-03-25', time: '07:50', teasingScore: 5, edema: 4, leftOvary: '36mm follicle' }),
    )) || insertedAny;

  insertedAny =
    (await ensureRecordExists(
      () => getMareById(previewIds.mareClover),
      () => createMare({
        id: previewIds.mareClover,
        name: 'Clover',
        breed: 'Warmblood',
        gestationLengthDays: 340,
        dateOfBirth: '2020-03-28',
        isRecipient: true,
        notes: 'Maiden mare, first breeding season',
      }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.cloverLog1),
      () => createDailyLog({ id: previewIds.cloverLog1, mareId: previewIds.mareClover, date: '2026-03-23', time: '08:10', teasingScore: 1, edema: 0 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.cloverLog2),
      () => createDailyLog({ id: previewIds.cloverLog2, mareId: previewIds.mareClover, date: '2026-03-25', time: '08:05', teasingScore: 2, edema: 1 }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.cloverLog3),
      () => createDailyLog({ id: previewIds.cloverLog3, mareId: previewIds.mareClover, date: '2026-03-26', time: '08:25', teasingScore: 2, edema: 1, notes: 'Winking, no strong signs yet' }),
    )) || insertedAny;

  return insertedAny ? 'inserted' : 'alreadySeeded';
}
