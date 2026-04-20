import type { BackupEnvelopeV1 } from './types';

const BASE_TIMESTAMP = '2026-04-16T12:00:00.000Z';

export function createBackupFixture(): BackupEnvelopeV1 {
  return {
    schemaVersion: 1,
    createdAt: BASE_TIMESTAMP,
    app: {
      name: 'BreedWise',
      version: '1.0.2',
    },
    settings: {
      onboardingComplete: true,
    },
    tables: {
      mares: [
        {
          id: 'mare-1',
          name: 'Maple',
          breed: 'Quarter Horse',
          date_of_birth: '2018-02-02',
          registration_number: null,
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
          deleted_at: null,
        },
      ],
      stallions: [
        {
          id: 'stallion-1',
          name: 'Atlas',
          breed: 'Warmblood',
          registration_number: null,
          sire: null,
          dam: null,
          notes: null,
          date_of_birth: '2016-03-03',
          av_temperature_f: null,
          av_type: null,
          av_liner_type: null,
          av_water_volume_ml: null,
          av_notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
          deleted_at: null,
        },
      ],
      daily_logs: [
        {
          id: 'log-1',
          mare_id: 'mare-1',
          date: '2026-04-10',
          teasing_score: 3,
          right_ovary: '35mm',
          left_ovary: null,
          ovulation_detected: 1,
          edema: 2,
          uterine_tone: null,
          uterine_cysts: null,
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      breeding_records: [
        {
          id: 'breed-1',
          mare_id: 'mare-1',
          stallion_id: 'stallion-1',
          stallion_name: null,
          collection_id: 'collection-1',
          date: '2026-04-02',
          method: 'freshAI',
          notes: null,
          volume_ml: 50,
          concentration_m_per_ml: 200,
          motility_percent: 70,
          number_of_straws: null,
          straw_volume_ml: 0.5,
          straw_details: null,
          collection_date: '2026-04-01',
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      pregnancy_checks: [
        {
          id: 'check-1',
          mare_id: 'mare-1',
          breeding_record_id: 'breed-1',
          date: '2026-04-16',
          result: 'positive',
          heartbeat_detected: 1,
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      foaling_records: [
        {
          id: 'foaling-1',
          mare_id: 'mare-1',
          breeding_record_id: 'breed-1',
          date: '2027-03-10',
          outcome: 'liveFoal',
          foal_sex: 'colt',
          complications: null,
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      foals: [
        {
          id: 'foal-1',
          foaling_record_id: 'foaling-1',
          name: 'Comet',
          sex: 'colt',
          color: 'bay',
          markings: null,
          birth_weight_lbs: 100,
          milestones: JSON.stringify({
            stood: { done: true, recordedAt: BASE_TIMESTAMP },
            iggTested: { done: true, recordedAt: null },
          }),
          igg_tests: JSON.stringify([
            {
              date: '2027-03-11',
              valueMgDl: 900,
              recordedAt: '2027-03-11T08:00:00.000Z',
            },
          ]),
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      medication_logs: [
        {
          id: 'med-1',
          mare_id: 'mare-1',
          date: '2026-04-12',
          medication_name: 'Regumate',
          dose: '10mL',
          route: 'oral',
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      semen_collections: [
        {
          id: 'collection-1',
          stallion_id: 'stallion-1',
          collection_date: '2026-04-01',
          raw_volume_ml: 100,
          extended_volume_ml: 500,
          extender_volume_ml: 400,
          extender_type: 'INRA 96',
          concentration_millions_per_ml: 200,
          progressive_motility_percent: 70,
          dose_count: 10,
          dose_size_millions: 500,
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      collection_dose_events: [
        {
          id: 'event-1',
          collection_id: 'collection-1',
          event_type: 'usedOnSite',
          recipient: 'Maple',
          dose_count: 1,
          event_date: '2026-04-02',
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
    },
  };
}

export function cloneBackupFixture(): BackupEnvelopeV1 {
  return JSON.parse(JSON.stringify(createBackupFixture())) as BackupEnvelopeV1;
}
