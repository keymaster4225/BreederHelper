import type {
  BackupEnvelopeV2,
  BackupEnvelopeV3,
  BackupEnvelopeV4,
  BackupEnvelopeV5,
  BackupEnvelopeV6,
  BackupEnvelopeV9,
} from './types';

const BASE_TIMESTAMP = '2026-04-16T12:00:00.000Z';

export function createBackupFixture(): BackupEnvelopeV9 {
  return {
    schemaVersion: 9,
    createdAt: BASE_TIMESTAMP,
    app: {
      name: 'BreedWise',
      version: '1.0.21',
    },
    settings: {
      onboardingComplete: true,
      clockPreference: 'system',
    },
    tables: {
      mares: [
        {
          id: 'mare-1',
          name: 'Maple',
          breed: 'Quarter Horse',
          gestation_length_days: 345,
          date_of_birth: '2018-02-02',
          registration_number: null,
          is_recipient: 1,
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
          time: '08:30',
          teasing_score: 3,
          right_ovary: '35mm',
          left_ovary: null,
          ovulation_detected: 1,
          edema: 2,
          uterine_tone: null,
          uterine_cysts: null,
          right_ovary_ovulation: 1,
          right_ovary_follicle_state: 'measured',
          right_ovary_follicle_measurements_mm: '[35]',
          right_ovary_consistency: 'firm',
          right_ovary_structures: '["corpusLuteum"]',
          left_ovary_ovulation: null,
          left_ovary_follicle_state: null,
          left_ovary_follicle_measurements_mm: '[]',
          left_ovary_consistency: null,
          left_ovary_structures: '[]',
          uterine_tone_category: 'moderate',
          cervical_firmness: 'firm',
          discharge_observed: 0,
          discharge_notes: null,
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      uterine_fluid: [
        {
          id: 'fluid-1',
          daily_log_id: 'log-1',
          depth_mm: 10,
          location: 'leftHorn',
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      uterine_flushes: [
        {
          id: 'flush-1',
          daily_log_id: 'log-1',
          base_solution: 'LRS',
          total_volume_ml: 1000,
          notes: 'Clear return',
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      uterine_flush_products: [
        {
          id: 'flush-product-1',
          uterine_flush_id: 'flush-1',
          product_name: 'Saline',
          dose: '1000 mL',
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
          source_daily_log_id: null,
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
          extender_type: 'INRA 96',
          concentration_millions_per_ml: 200,
          progressive_motility_percent: 70,
          target_mode: 'progressive',
          target_motile_sperm_millions_per_dose: 500,
          target_post_extension_concentration_millions_per_ml: 100,
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
          recipient_phone: null,
          recipient_street: null,
          recipient_city: null,
          recipient_state: null,
          recipient_zip: null,
          carrier_service: null,
          container_type: null,
          tracking_number: null,
          breeding_record_id: 'breed-1',
          dose_semen_volume_ml: 50,
          dose_extender_volume_ml: null,
          dose_count: 1,
          event_date: '2026-04-02',
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
      frozen_semen_batches: [
        {
          id: 'frozen-1',
          stallion_id: 'stallion-1',
          collection_id: 'collection-1',
          freeze_date: '2026-04-03',
          raw_semen_volume_used_ml: 30,
          extender: 'BotuCrio',
          extender_other: null,
          was_centrifuged: 1,
          centrifuge_speed_rpm: 600,
          centrifuge_duration_min: 10,
          centrifuge_cushion_used: 0,
          centrifuge_cushion_type: null,
          centrifuge_resuspension_vol_ml: null,
          centrifuge_notes: null,
          straw_count: 20,
          straws_remaining: 20,
          straw_volume_ml: 0.5,
          concentration_millions_per_ml: 200,
          straws_per_dose: 4,
          straw_color: 'Yellow',
          straw_color_other: null,
          straw_label: 'A1',
          post_thaw_motility_percent: 45,
          longevity_hours: 6,
          storage_details: 'LN2 Tank 1',
          notes: null,
          created_at: BASE_TIMESTAMP,
          updated_at: BASE_TIMESTAMP,
        },
      ],
    },
  };
}

export function cloneBackupFixture(): BackupEnvelopeV9 {
  return JSON.parse(JSON.stringify(createBackupFixture())) as BackupEnvelopeV9;
}

export function createBackupFixtureV6(): BackupEnvelopeV6 {
  const backupV7 = createBackupFixture();

  return {
    schemaVersion: 6,
    createdAt: backupV7.createdAt,
    app: backupV7.app,
    settings: backupV7.settings,
    tables: {
      mares: backupV7.tables.mares,
      stallions: backupV7.tables.stallions,
      daily_logs: backupV7.tables.daily_logs.map(({ time: _time, ...row }) => row),
      uterine_fluid: backupV7.tables.uterine_fluid,
      breeding_records: backupV7.tables.breeding_records,
      pregnancy_checks: backupV7.tables.pregnancy_checks,
      foaling_records: backupV7.tables.foaling_records,
      foals: backupV7.tables.foals,
      medication_logs: backupV7.tables.medication_logs.map(
        ({ source_daily_log_id: _sourceDailyLogId, ...row }) => row,
      ),
      semen_collections: backupV7.tables.semen_collections,
      collection_dose_events: backupV7.tables.collection_dose_events,
      frozen_semen_batches: backupV7.tables.frozen_semen_batches,
    },
  };
}

export function createBackupFixtureV5(): BackupEnvelopeV5 {
  const backupV6 = createBackupFixtureV6();

  return {
    schemaVersion: 5,
    createdAt: backupV6.createdAt,
    app: backupV6.app,
    settings: backupV6.settings,
    tables: {
      mares: backupV6.tables.mares.map(({ is_recipient: _isRecipient, ...row }) => row),
      stallions: backupV6.tables.stallions,
      daily_logs: backupV6.tables.daily_logs,
      uterine_fluid: backupV6.tables.uterine_fluid,
      breeding_records: backupV6.tables.breeding_records,
      pregnancy_checks: backupV6.tables.pregnancy_checks,
      foaling_records: backupV6.tables.foaling_records,
      foals: backupV6.tables.foals,
      medication_logs: backupV6.tables.medication_logs,
      semen_collections: backupV6.tables.semen_collections,
      collection_dose_events: backupV6.tables.collection_dose_events,
      frozen_semen_batches: backupV6.tables.frozen_semen_batches,
    },
  };
}

export function createBackupFixtureV4(): BackupEnvelopeV4 {
  const backupV5 = createBackupFixtureV5();

  return {
    schemaVersion: 4,
    createdAt: backupV5.createdAt,
    app: backupV5.app,
    settings: backupV5.settings,
    tables: {
      mares: backupV5.tables.mares,
      stallions: backupV5.tables.stallions,
      daily_logs: backupV5.tables.daily_logs,
      uterine_fluid: backupV5.tables.uterine_fluid,
      breeding_records: backupV5.tables.breeding_records,
      pregnancy_checks: backupV5.tables.pregnancy_checks,
      foaling_records: backupV5.tables.foaling_records,
      foals: backupV5.tables.foals,
      medication_logs: backupV5.tables.medication_logs,
      semen_collections: backupV5.tables.semen_collections,
      collection_dose_events: backupV5.tables.collection_dose_events,
    },
  };
}

export function createBackupFixtureV3(): BackupEnvelopeV3 {
  const backupV4 = createBackupFixtureV4();

  return {
    schemaVersion: 3,
    createdAt: backupV4.createdAt,
    app: backupV4.app,
    settings: backupV4.settings,
    tables: {
      mares: backupV4.tables.mares,
      stallions: backupV4.tables.stallions,
      daily_logs: backupV4.tables.daily_logs.map(
        ({
          right_ovary_ovulation: _rightOvaryOvulation,
          right_ovary_follicle_state: _rightOvaryFollicleState,
          right_ovary_follicle_measurements_mm: _rightOvaryFollicleMeasurementsMm,
          right_ovary_consistency: _rightOvaryConsistency,
          right_ovary_structures: _rightOvaryStructures,
          left_ovary_ovulation: _leftOvaryOvulation,
          left_ovary_follicle_state: _leftOvaryFollicleState,
          left_ovary_follicle_measurements_mm: _leftOvaryFollicleMeasurementsMm,
          left_ovary_consistency: _leftOvaryConsistency,
          left_ovary_structures: _leftOvaryStructures,
          uterine_tone_category: _uterineToneCategory,
          cervical_firmness: _cervicalFirmness,
          discharge_observed: _dischargeObserved,
          discharge_notes: _dischargeNotes,
          ...row
        }) => row,
      ),
      breeding_records: backupV4.tables.breeding_records,
      pregnancy_checks: backupV4.tables.pregnancy_checks,
      foaling_records: backupV4.tables.foaling_records,
      foals: backupV4.tables.foals,
      medication_logs: backupV4.tables.medication_logs,
      semen_collections: backupV4.tables.semen_collections,
      collection_dose_events: backupV4.tables.collection_dose_events,
    },
  };
}

export function createBackupFixtureV2(): BackupEnvelopeV2 {
  const backupV3 = createBackupFixtureV3();
  return {
    schemaVersion: 2,
    createdAt: backupV3.createdAt,
    app: backupV3.app,
    settings: backupV3.settings,
    tables: {
      ...backupV3.tables,
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
          recipient_phone: null,
          recipient_street: null,
          recipient_city: null,
          recipient_state: null,
          recipient_zip: null,
          carrier_service: null,
          container_type: null,
          tracking_number: null,
          breeding_record_id: 'breed-1',
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
