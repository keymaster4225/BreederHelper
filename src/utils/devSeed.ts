import {
  createBreedingRecord,
  createDailyLog,
  createDoseEvent,
  createFoal,
  createFoalingRecord,
  createFrozenSemenBatch,
  createMare,
  createMedicationLog,
  getBreedingRecordById,
  getDailyLogById,
  getDoseEventById,
  getFoalById,
  getFoalingRecordById,
  getFrozenSemenBatch,
  getMareById,
  getMedicationLogById,
  createPregnancyCheck,
  getPregnancyCheckById,
  createSemenCollection,
  getSemenCollectionById,
  createStallion,
  getStallionById,
  createTask,
  getTaskById,
} from '@/storage/repositories';
export type SeedPreviewDataResult = 'inserted' | 'alreadySeeded';

const previewIds = {
  stallionA: 'preview-seed-stallion-midnight-express',
  stallionB: 'preview-seed-stallion-golden-oak',
  stallionC: 'preview-seed-stallion-copper-halo',
  mareBella: 'preview-seed-mare-bella-star',
  mareDesertRose: 'preview-seed-mare-desert-rose',
  mareClover: 'preview-seed-mare-clover',
  mareAurora: 'preview-seed-mare-aurora-bay',
  mareWillow: 'preview-seed-mare-willow-creek',
  mareMaple: 'preview-seed-mare-maple-lace',
  mareJuniper: 'preview-seed-mare-juniper-vale',
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
  auroraLatePregnancyLog: 'preview-seed-aurora-late-pregnancy-log',
  auroraMedicationRegumate1: 'preview-seed-aurora-medication-regumate-1',
  auroraMedicationRegumate2: 'preview-seed-aurora-medication-regumate-2',
  auroraMedicationRegumate3: 'preview-seed-aurora-medication-regumate-3',
  willowLog1: 'preview-seed-willow-log-1',
  willowLog2: 'preview-seed-willow-log-2',
  willowFlushLog: 'preview-seed-willow-flush-log',
  willowFluidPocket: 'preview-seed-willow-fluid-pocket',
  willowFlush: 'preview-seed-willow-flush',
  willowFlushProductAntibiotic: 'preview-seed-willow-flush-product-antibiotic',
  willowFlushProductOxytocin: 'preview-seed-willow-flush-product-oxytocin',
  bellaBreeding: 'preview-seed-bella-breeding',
  desertBreeding: 'preview-seed-desert-breeding',
  auroraBreeding: 'preview-seed-aurora-breeding',
  willowBreeding: 'preview-seed-willow-breeding',
  mapleBreeding: 'preview-seed-maple-breeding',
  juniperBreeding: 'preview-seed-juniper-breeding',
  bellaPregCheck1: 'preview-seed-bella-preg-check-1',
  bellaPregCheck2: 'preview-seed-bella-preg-check-2',
  desertPregCheck: 'preview-seed-desert-preg-check',
  auroraPregCheck1: 'preview-seed-aurora-preg-check-1',
  auroraPregCheck2: 'preview-seed-aurora-preg-check-2',
  willowPregCheck: 'preview-seed-willow-preg-check',
  maplePregCheck: 'preview-seed-maple-preg-check',
  juniperPregCheck1: 'preview-seed-juniper-preg-check-1',
  juniperPregCheck2: 'preview-seed-juniper-preg-check-2',
  desertFoaling: 'preview-seed-desert-foaling',
  mapleFoaling: 'preview-seed-maple-foaling',
  juniperFoaling: 'preview-seed-juniper-foaling',
  saharaFoal: 'preview-seed-sahara-dawn',
  juniperFoal: 'preview-seed-river-jet',
  midnightCollection: 'preview-seed-midnight-collection-2026-04-12',
  midnightShipment: 'preview-seed-midnight-shipment-blue-ridge',
  midnightFrozenBatch: 'preview-seed-midnight-frozen-batch-2026-04-13',
  auroraMedication: 'preview-seed-aurora-medication-regumate',
  willowMedication: 'preview-seed-willow-medication-banamine',
  cloverTask: 'preview-seed-clover-recheck-task',
  auroraTask: 'preview-seed-aurora-foaling-watch-task',
  willowTask: 'preview-seed-willow-culture-followup-task',
  juniperTask: 'preview-seed-juniper-igg-task',
} as const;

async function ensureRecordExists(
  exists: () => Promise<unknown>,
  create: () => Promise<unknown>,
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
      () => getStallionById(previewIds.stallionC),
      () =>
        createStallion({
          id: previewIds.stallionC,
          name: 'Copper Halo',
          breed: 'Quarter Horse',
          registrationNumber: 'AQHA-CH-4419',
          sire: 'Halo Bar',
          dam: 'Copper Penny',
          dateOfBirth: '2014-02-18',
          avTemperatureF: 115,
          avType: 'Missouri',
          avLinerType: 'Smooth',
          avWaterVolumeMl: 1800,
          avNotes: 'Prefers quiet stocks and warm-up mount pass before collection.',
        }),
    )) || insertedAny;

  insertedAny =
    (await ensureRecordExists(
      () => getSemenCollectionById(previewIds.midnightCollection),
      () =>
        createSemenCollection({
          id: previewIds.midnightCollection,
          stallionId: previewIds.stallionA,
          collectionDate: '2026-04-12',
          rawVolumeMl: 78,
          extenderType: 'INRA 96',
          concentrationMillionsPerMl: 245,
          progressiveMotilityPercent: 72,
          targetMode: 'progressive',
          targetSpermMillionsPerDose: 1000,
          targetPostExtensionConcentrationMillionsPerMl: 35,
          notes: 'Preview collection with shipped and frozen allocations.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDoseEventById(previewIds.midnightShipment),
      () =>
        createDoseEvent({
          id: previewIds.midnightShipment,
          collectionId: previewIds.midnightCollection,
          eventType: 'shipped',
          recipient: 'Blue Ridge Equine',
          recipientPhone: '555-0134',
          recipientStreet: '214 Foaling Barn Rd',
          recipientCity: 'Lexington',
          recipientState: 'KY',
          recipientZip: '40511',
          carrierService: 'FedEx Priority Overnight',
          containerType: 'Equitainer',
          trackingNumber: 'PREVIEW123456',
          doseSemenVolumeMl: 8,
          doseExtenderVolumeMl: 52,
          doseCount: 2,
          eventDate: '2026-04-12',
          notes: 'Two cooled doses shipped for next-morning insemination.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getFrozenSemenBatch(previewIds.midnightFrozenBatch),
      () =>
        createFrozenSemenBatch({
          id: previewIds.midnightFrozenBatch,
          stallionId: previewIds.stallionA,
          collectionId: previewIds.midnightCollection,
          freezeDate: '2026-04-13',
          rawSemenVolumeUsedMl: 36,
          extender: 'BotuCrio',
          extenderOther: null,
          wasCentrifuged: true,
          centrifuge: {
            speedRpm: 1800,
            durationMin: 12,
            cushionUsed: true,
            cushionType: 'Equipure',
            resuspensionVolumeMl: 24,
            notes: 'Clean pellet, no visible debris.',
          },
          strawCount: 48,
          strawVolumeMl: 0.5,
          concentrationMillionsPerMl: 200,
          strawsPerDose: 8,
          strawColor: 'Blue',
          strawColorOther: null,
          strawLabel: 'MX 04/13/26',
          postThawMotilityPercent: 44,
          longevityHours: 2,
          storageDetails: 'Tank A, canister 2, goblet B',
          notes: 'Demo frozen inventory batch linked back to collection.',
        }),
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
      () => createBreedingRecord({ id: previewIds.bellaBreeding, mareId: previewIds.mareBella, stallionId: previewIds.stallionA, date: '2026-02-25', time: '10:30', method: 'liveCover' }),
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
      () => getMareById(previewIds.mareAurora),
      () =>
        createMare({
          id: previewIds.mareAurora,
          name: 'Aurora Bay',
          breed: 'Warmblood',
          gestationLengthDays: 340,
          dateOfBirth: '2015-06-09',
          registrationNumber: 'AHS-54721',
          isRecipient: false,
          notes: 'Late-term pregnancy preview case with foaling-watch task.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getBreedingRecordById(previewIds.auroraBreeding),
      () =>
        createBreedingRecord({
          id: previewIds.auroraBreeding,
          mareId: previewIds.mareAurora,
          stallionId: previewIds.stallionC,
          date: '2025-05-24',
          time: '09:40',
          method: 'shippedCooledAI',
          volumeMl: 18,
          concentrationMPerMl: 42,
          motilityPercent: 68,
          collectionDate: '2025-05-23',
          notes: 'Shipped cooled insemination. Estimated due date is near the preview window.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.auroraPregCheck1),
      () =>
        createPregnancyCheck({
          id: previewIds.auroraPregCheck1,
          mareId: previewIds.mareAurora,
          breedingRecordId: previewIds.auroraBreeding,
          date: '2025-06-07',
          result: 'positive',
          heartbeatDetected: false,
          notes: '14-day check positive.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.auroraPregCheck2),
      () =>
        createPregnancyCheck({
          id: previewIds.auroraPregCheck2,
          mareId: previewIds.mareAurora,
          breedingRecordId: previewIds.auroraBreeding,
          date: '2025-07-05',
          result: 'positive',
          heartbeatDetected: true,
          notes: 'Heartbeat confirmed.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.auroraLatePregnancyLog),
      () =>
        createDailyLog({
          id: previewIds.auroraLatePregnancyLog,
          mareId: previewIds.mareAurora,
          date: '2026-04-28',
          time: '19:30',
          teasingScore: 0,
          edema: 1,
          uterineToneCategory: 'moderate',
          cervicalFirmness: 'closed',
          notes: 'Late-term check: relaxed tail head, udder filling, eating normally.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getMedicationLogById(previewIds.auroraMedication),
      () =>
        createMedicationLog({
          id: previewIds.auroraMedication,
          mareId: previewIds.mareAurora,
          date: '2026-04-26',
          medicationName: 'Regumate',
          dose: '10 mL',
          route: 'oral',
          notes: 'Preview late-pregnancy medication log.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getMedicationLogById(previewIds.auroraMedicationRegumate1),
      () =>
        createMedicationLog({
          id: previewIds.auroraMedicationRegumate1,
          mareId: previewIds.mareAurora,
          date: '2026-04-24',
          medicationName: 'Regumate',
          dose: '10 mL',
          route: 'oral',
          notes: 'Late-pregnancy support course, day 1.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getMedicationLogById(previewIds.auroraMedicationRegumate2),
      () =>
        createMedicationLog({
          id: previewIds.auroraMedicationRegumate2,
          mareId: previewIds.mareAurora,
          date: '2026-04-25',
          medicationName: 'Regumate',
          dose: '10 mL',
          route: 'oral',
          notes: 'Late-pregnancy support course, day 2.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getMedicationLogById(previewIds.auroraMedicationRegumate3),
      () =>
        createMedicationLog({
          id: previewIds.auroraMedicationRegumate3,
          mareId: previewIds.mareAurora,
          date: '2026-04-27',
          medicationName: 'Regumate',
          dose: '10 mL',
          route: 'oral',
          notes: 'Late-pregnancy support course, day 4 after one skipped dose.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getTaskById(previewIds.auroraTask),
      () =>
        createTask({
          id: previewIds.auroraTask,
          mareId: previewIds.mareAurora,
          taskType: 'custom',
          title: 'Prepare foaling kit',
          dueDate: '2026-04-29',
          dueTime: '18:00',
          notes: 'Restock colostrum test strips and towels before night watch.',
        }),
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
      () => createBreedingRecord({ id: previewIds.desertBreeding, mareId: previewIds.mareDesertRose, stallionId: previewIds.stallionB, date: '2025-03-10', time: '09:15', method: 'frozenAI', numberOfStraws: 2, strawVolumeMl: 5 }),
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
      () => getMareById(previewIds.mareJuniper),
      () =>
        createMare({
          id: previewIds.mareJuniper,
          name: 'Juniper Vale',
          breed: 'Hanoverian',
          gestationLengthDays: 341,
          dateOfBirth: '2012-05-18',
          registrationNumber: 'HANN-JV-2041',
          isRecipient: false,
          notes: 'Recent foaling case for previewing foal milestones, IgG history, and follow-up tasks.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getBreedingRecordById(previewIds.juniperBreeding),
      () =>
        createBreedingRecord({
          id: previewIds.juniperBreeding,
          mareId: previewIds.mareJuniper,
          stallionId: previewIds.stallionC,
          date: '2025-05-22',
          time: '11:20',
          method: 'shippedCooledAI',
          volumeMl: 16,
          concentrationMPerMl: 38,
          motilityPercent: 70,
          collectionDate: '2025-05-21',
          notes: 'Cooled semen bred on ovulation cycle; foaled during the preview window.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.juniperPregCheck1),
      () =>
        createPregnancyCheck({
          id: previewIds.juniperPregCheck1,
          mareId: previewIds.mareJuniper,
          breedingRecordId: previewIds.juniperBreeding,
          date: '2025-06-05',
          result: 'positive',
          heartbeatDetected: false,
          notes: '14-day check positive, no heartbeat expected yet.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.juniperPregCheck2),
      () =>
        createPregnancyCheck({
          id: previewIds.juniperPregCheck2,
          mareId: previewIds.mareJuniper,
          breedingRecordId: previewIds.juniperBreeding,
          date: '2025-07-03',
          result: 'positive',
          heartbeatDetected: true,
          notes: 'Heartbeat confirmed before routine pregnancy maintenance.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getFoalingRecordById(previewIds.juniperFoaling),
      () =>
        createFoalingRecord({
          id: previewIds.juniperFoaling,
          mareId: previewIds.mareJuniper,
          breedingRecordId: previewIds.juniperBreeding,
          date: '2026-04-28',
          outcome: 'liveFoal',
          foalSex: 'colt',
          complications: 'Mild dystocia; assisted shoulders, mare and foal stable.',
          notes: 'Late evening delivery with next-morning IgG follow-up planned.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getFoalById(previewIds.juniperFoal),
      () =>
        createFoal({
          id: previewIds.juniperFoal,
          foalingRecordId: previewIds.juniperFoaling,
          name: 'River Jet',
          sex: 'colt',
          color: 'black',
          markings: 'Small star, two hind socks',
          birthWeightLbs: 103,
          milestones: {
            stood: { done: true, recordedAt: '2026-04-28T23:20:00.000Z' },
            nursed: { done: true, recordedAt: '2026-04-29T00:05:00.000Z' },
            passedMeconium: { done: true, recordedAt: '2026-04-29T01:15:00.000Z' },
            umbilicalTreated: { done: true, recordedAt: '2026-04-28T22:45:00.000Z' },
            iggTested: { done: true, recordedAt: '2026-04-29T10:30:00.000Z' },
            firstVetCheck: { done: false },
          },
          iggTests: [
            {
              date: '2026-04-29',
              valueMgDl: 620,
              recordedAt: '2026-04-29T10:30:00.000Z',
            },
          ],
          notes: 'Partial IgG result retained so the foal card shows interpretation color and follow-up context.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getTaskById(previewIds.juniperTask),
      () =>
        createTask({
          id: previewIds.juniperTask,
          mareId: previewIds.mareJuniper,
          taskType: 'custom',
          title: 'Repeat foal IgG',
          dueDate: '2026-04-29',
          dueTime: '16:00',
          notes: 'River Jet was 620 mg/dL this morning. Repeat after plasma plan discussion.',
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
      () => getMareById(previewIds.mareMaple),
      () =>
        createMare({
          id: previewIds.mareMaple,
          name: 'Maple Lace',
          breed: 'Thoroughbred',
          gestationLengthDays: 342,
          dateOfBirth: '2013-04-01',
          isRecipient: false,
          notes: 'Historical non-live foaling case for previewing foaling outcomes.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getBreedingRecordById(previewIds.mapleBreeding),
      () =>
        createBreedingRecord({
          id: previewIds.mapleBreeding,
          mareId: previewIds.mareMaple,
          stallionId: previewIds.stallionB,
          date: '2025-02-12',
          time: '08:50',
          method: 'frozenAI',
          numberOfStraws: 4,
          strawVolumeMl: 0.5,
          strawDetails: 'Two 0.5 mL straws per dose, repeat dose same day.',
          collectionDate: '2024-06-18',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.maplePregCheck),
      () =>
        createPregnancyCheck({
          id: previewIds.maplePregCheck,
          mareId: previewIds.mareMaple,
          breedingRecordId: previewIds.mapleBreeding,
          date: '2025-02-27',
          result: 'positive',
          heartbeatDetected: false,
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getFoalingRecordById(previewIds.mapleFoaling),
      () =>
        createFoalingRecord({
          id: previewIds.mapleFoaling,
          mareId: previewIds.mareMaple,
          breedingRecordId: previewIds.mapleBreeding,
          date: '2026-01-19',
          outcome: 'stillbirth',
          foalSex: 'colt',
          complications: 'Red bag delivery noted on camera.',
          notes: 'Non-live outcome retained without a linked foal record.',
        }),
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
  insertedAny =
    (await ensureRecordExists(
      () => getTaskById(previewIds.cloverTask),
      () =>
        createTask({
          id: previewIds.cloverTask,
          mareId: previewIds.mareClover,
          taskType: 'dailyCheck',
          title: 'Recheck follicle activity',
          dueDate: '2026-04-29',
          dueTime: '08:00',
          notes: 'Recipient candidate: repeat ultrasound before assigning embryo transfer slot.',
        }),
    )) || insertedAny;

  insertedAny =
    (await ensureRecordExists(
      () => getMareById(previewIds.mareWillow),
      () =>
        createMare({
          id: previewIds.mareWillow,
          name: 'Willow Creek',
          breed: 'Paint',
          gestationLengthDays: 340,
          dateOfBirth: '2017-05-20',
          registrationNumber: 'APHA-91827',
          isRecipient: false,
          notes: 'Open mare preview case with fresh AI, uterine fluid, flush, meds, and negative check.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.willowLog1),
      () =>
        createDailyLog({
          id: previewIds.willowLog1,
          mareId: previewIds.mareWillow,
          date: '2026-04-10',
          time: '07:40',
          teasingScore: 3,
          edema: 2,
          rightOvaryFollicleState: 'measured',
          rightOvaryFollicleMeasurementsMm: [32, 34],
          rightOvaryConsistency: 'moderate',
          rightOvaryStructures: ['multipleSmallFollicles'],
          leftOvaryFollicleState: 'small',
          leftOvaryStructures: ['corpusLuteum'],
          uterineToneCategory: 'moderate',
          cervicalFirmness: 'soft',
          notes: 'Building follicle. Plan recheck and collection link if progresses.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.willowLog2),
      () =>
        createDailyLog({
          id: previewIds.willowLog2,
          mareId: previewIds.mareWillow,
          date: '2026-04-12',
          time: '07:35',
          teasingScore: 5,
          edema: 4,
          rightOvaryOvulation: false,
          rightOvaryFollicleState: 'measured',
          rightOvaryFollicleMeasurementsMm: [39.5],
          rightOvaryConsistency: 'soft',
          leftOvaryOvulation: false,
          leftOvaryFollicleState: 'small',
          ovulationSource: 'structured',
          uterineToneCategory: 'tight',
          cervicalFirmness: 'soft',
          dischargeObserved: true,
          dischargeNotes: 'Clear discharge.',
          notes: 'Ready for insemination after collection.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getBreedingRecordById(previewIds.willowBreeding),
      () =>
        createBreedingRecord({
          id: previewIds.willowBreeding,
          mareId: previewIds.mareWillow,
          stallionId: previewIds.stallionA,
          collectionId: previewIds.midnightCollection,
          date: '2026-04-12',
          time: '14:15',
          method: 'freshAI',
          volumeMl: 12,
          concentrationMPerMl: 245,
          motilityPercent: 72,
          collectionDate: '2026-04-12',
          notes: 'On-farm fresh AI from same-day collection.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getDailyLogById(previewIds.willowFlushLog),
      () =>
        createDailyLog({
          id: previewIds.willowFlushLog,
          mareId: previewIds.mareWillow,
          date: '2026-04-13',
          time: '08:10',
          teasingScore: 2,
          edema: 2,
          rightOvaryOvulation: true,
          rightOvaryFollicleState: 'postOvulatory',
          rightOvaryConsistency: 'soft',
          leftOvaryOvulation: false,
          leftOvaryFollicleState: 'small',
          ovulationSource: 'structured',
          uterineToneCategory: 'moderate',
          cervicalFirmness: 'moderate',
          uterineFluidPockets: [
            {
              id: previewIds.willowFluidPocket,
              depthMm: 18,
              location: 'uterineBody',
            },
          ],
          uterineFlush: {
            id: previewIds.willowFlush,
            baseSolution: 'LRS',
            totalVolumeMl: 1000,
            notes: 'Cloudy return on first liter, clearer after repeat.',
            products: [
              {
                id: previewIds.willowFlushProductAntibiotic,
                productName: 'Amikacin',
                dose: '2 g',
                notes: 'Added after cytology sample.',
              },
              {
                id: previewIds.willowFlushProductOxytocin,
                productName: 'Oxytocin',
                dose: '20 IU',
                notes: 'Post-lavage uterine clearance support.',
              },
            ],
          },
          notes: 'Post-breeding fluid treated with lavage and follow-up medication.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getMedicationLogById(previewIds.willowMedication),
      () =>
        createMedicationLog({
          id: previewIds.willowMedication,
          mareId: previewIds.mareWillow,
          date: '2026-04-13',
          medicationName: 'Banamine',
          dose: '10 mL',
          route: 'IV',
          notes: 'Comfort support after post-breeding flush.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getPregnancyCheckById(previewIds.willowPregCheck),
      () =>
        createPregnancyCheck({
          id: previewIds.willowPregCheck,
          mareId: previewIds.mareWillow,
          breedingRecordId: previewIds.willowBreeding,
          date: '2026-04-29',
          result: 'negative',
          heartbeatDetected: null,
          notes: 'Open on 17-day check; schedule next cycle plan.',
        }),
    )) || insertedAny;
  insertedAny =
    (await ensureRecordExists(
      () => getTaskById(previewIds.willowTask),
      () =>
        createTask({
          id: previewIds.willowTask,
          mareId: previewIds.mareWillow,
          taskType: 'medication',
          title: 'Review culture results',
          dueDate: '2026-05-02',
          dueTime: '09:00',
          notes: 'Use result to decide whether to repeat lavage next cycle.',
        }),
    )) || insertedAny;

  return insertedAny ? 'inserted' : 'alreadySeeded';
}
