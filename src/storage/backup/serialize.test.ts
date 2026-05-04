import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/utils/onboarding', () => ({
  getOnboardingComplete: vi.fn(),
}));

vi.mock('@/utils/clockPreferences', () => ({
  getClockPreference: vi.fn(),
}));

import { getDb } from '@/storage/db';
import { getOnboardingComplete } from '@/utils/onboarding';
import { getClockPreference } from '@/utils/clockPreferences';

import { serializeBackup } from './serialize';

describe('serializeBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T15:30:45.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports raw rows and onboarding state without transforming stored values', async () => {
    const db = {
      getAllAsync: vi.fn(async (sql: string) => {
        if (sql.includes('FROM mares')) {
          return [
            {
              id: 'mare-1',
              name: 'Maple',
              breed: 'Quarter Horse',
              gestation_length_days: 345,
              date_of_birth: '2018-02-02',
              registration_number: null,
              is_recipient: 1,
              notes: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
              deleted_at: '2026-04-01T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM stallions')) {
          return [
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
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
              deleted_at: null,
            },
          ];
        }

        if (sql.includes('FROM daily_logs')) {
          return [
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
              right_ovary_ovulation: null,
              right_ovary_follicle_state: 'measured',
              right_ovary_follicle_measurements_mm: '[35]',
              right_ovary_consistency: 'firm',
              right_ovary_structures: '["corpusLuteum"]',
              left_ovary_ovulation: 1,
              left_ovary_follicle_state: null,
              left_ovary_follicle_measurements_mm: '[]',
              left_ovary_consistency: null,
              left_ovary_structures: '[]',
              uterine_tone_category: 'tight',
              cervical_firmness: 'closed',
              discharge_observed: 0,
              discharge_notes: null,
              notes: null,
              created_at: '2026-04-10T00:00:00.000Z',
              updated_at: '2026-04-10T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM uterine_fluid')) {
          return [
            {
              id: 'fluid-1',
              daily_log_id: 'log-1',
              depth_mm: 14,
              location: 'leftHorn',
              created_at: '2026-04-10T00:00:00.000Z',
              updated_at: '2026-04-10T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM uterine_flushes')) {
          return [
            {
              id: 'flush-1',
              daily_log_id: 'log-1',
              base_solution: 'LRS',
              total_volume_ml: 1000,
              notes: 'Clear return',
              created_at: '2026-04-10T00:00:00.000Z',
              updated_at: '2026-04-10T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM uterine_flush_products')) {
          return [
            {
              id: 'flush-product-1',
              uterine_flush_id: 'flush-1',
              product_name: 'Saline',
              dose: '1000 mL',
              notes: null,
              created_at: '2026-04-10T00:00:00.000Z',
              updated_at: '2026-04-10T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM breeding_records')) {
          return [
            {
              id: 'breed-1',
              mare_id: 'mare-1',
              stallion_id: 'stallion-1',
              stallion_name: null,
              collection_id: null,
              date: '2026-04-02',
              time: '14:45',
              method: 'frozenAI',
              notes: null,
              volume_ml: null,
              concentration_m_per_ml: null,
              motility_percent: null,
              number_of_straws: 2,
              straw_volume_ml: 0.5,
              straw_details: 'Two straws',
              collection_date: null,
              created_at: '2026-04-02T00:00:00.000Z',
              updated_at: '2026-04-02T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM pregnancy_checks')) {
          return [];
        }

        if (sql.includes('FROM foaling_records')) {
          return [];
        }

        if (sql.includes('FROM foals')) {
          return [
            {
              id: 'foal-1',
              foaling_record_id: 'foaling-1',
              name: 'Comet',
              sex: 'colt',
              color: 'bay',
              markings: null,
              birth_weight_lbs: 100,
              milestones: '{"stood":{"done":true}}',
              igg_tests: '[{"date":"2027-03-11","valueMgDl":900,"recordedAt":"2027-03-11T08:00:00.000Z"}]',
              notes: null,
              created_at: '2027-03-10T00:00:00.000Z',
              updated_at: '2027-03-10T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM medication_logs')) {
          return [
            {
              id: 'med-1',
              mare_id: 'mare-1',
              date: '2026-04-10',
              medication_name: 'Saline',
              dose: '1000 mL',
              route: 'intrauterine',
              notes: 'Daily log flush: LRS, 1000 mL total.',
              source_daily_log_id: 'log-1',
              created_at: '2026-04-10T00:00:00.000Z',
              updated_at: '2026-04-10T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM tasks')) {
          return [
            {
              id: 'task-1',
              mare_id: 'mare-1',
              task_type: 'pregnancyCheck',
              title: 'Pregnancy check',
              due_date: '2026-04-16',
              due_time: null,
              notes: null,
              status: 'completed',
              completed_at: '2026-04-16T13:00:00.000Z',
              completed_record_type: 'pregnancyCheck',
              completed_record_id: 'check-1',
              source_type: 'breedingRecord',
              source_record_id: 'breed-1',
              source_reason: 'breedingPregnancyCheck',
              created_at: '2026-04-02T00:00:00.000Z',
              updated_at: '2026-04-16T13:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM semen_collections')) {
          return [
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
              created_at: '2026-04-01T00:00:00.000Z',
              updated_at: '2026-04-01T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM collection_dose_events')) {
          return [
            {
              id: 'event-1',
              collection_id: 'collection-1',
              event_type: 'usedOnSite',
              recipient: 'Maple',
              recipient_phone: '555-0101',
              recipient_street: '123 Barn Road',
              recipient_city: 'Lexington',
              recipient_state: 'KY',
              recipient_zip: '40511',
              carrier_service: 'FedEx',
              container_type: 'Thermos',
              tracking_number: 'TRACK-123',
              breeding_record_id: 'breed-1',
              dose_semen_volume_ml: 50,
              dose_extender_volume_ml: null,
              dose_count: 1,
              event_date: '2026-04-02',
              notes: null,
              created_at: '2026-04-02T00:00:00.000Z',
              updated_at: '2026-04-02T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM frozen_semen_batches')) {
          return [
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
              straws_remaining: 18,
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
              created_at: '2026-04-03T00:00:00.000Z',
              updated_at: '2026-04-03T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM photo_assets')) {
          return [
            {
              id: 'photo-asset-1',
              master_relative_path: 'photo-assets/photo-asset-1/master.jpg',
              thumbnail_relative_path: 'photo-assets/photo-asset-1/thumbnail.jpg',
              master_mime_type: 'image/jpeg',
              thumbnail_mime_type: 'image/jpeg',
              width: 1600,
              height: 1200,
              file_size_bytes: 500000,
              source_kind: 'camera',
              created_at: '2026-04-04T00:00:00.000Z',
              updated_at: '2026-04-04T00:00:00.000Z',
            },
          ];
        }

        if (sql.includes('FROM photo_attachments')) {
          return [
            {
              id: 'photo-attachment-1',
              photo_asset_id: 'photo-asset-1',
              owner_type: 'mare',
              owner_id: 'mare-1',
              role: 'profile',
              sort_order: 0,
              caption: null,
              created_at: '2026-04-04T00:00:00.000Z',
              updated_at: '2026-04-04T00:00:00.000Z',
            },
          ];
        }

        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(getOnboardingComplete).mockResolvedValue(false);
    vi.mocked(getClockPreference).mockResolvedValue('24h');

    const backup = await serializeBackup();

    expect(backup.createdAt).toBe('2026-04-16T15:30:45.000Z');
    expect(backup.schemaVersion).toBe(12);
    expect(backup.app.name).toBe('BreedWise');
    expect(backup.settings.onboardingComplete).toBe(false);
    expect(backup.settings.clockPreference).toBe('24h');
    expect(backup.tables.mares[0]?.gestation_length_days).toBe(345);
    expect(backup.tables.mares[0]?.is_recipient).toBe(1);
    expect(backup.tables.mares[0]?.deleted_at).toBe('2026-04-01T00:00:00.000Z');
    expect(backup.tables.breeding_records[0]?.straw_volume_ml).toBe(0.5);
    expect(backup.tables.breeding_records[0]?.time).toBe('14:45');
    expect(backup.tables.foals[0]?.milestones).toBe('{"stood":{"done":true}}');
    expect(backup.tables.foals[0]?.igg_tests).toContain('"valueMgDl":900');
    expect(backup.tables.daily_logs[0]?.right_ovary_follicle_state).toBe('measured');
    expect(backup.tables.daily_logs[0]?.time).toBe('08:30');
    expect(backup.tables.daily_logs[0]?.right_ovary_follicle_measurements_mm).toBe('[35]');
    expect(backup.tables.daily_logs[0]?.left_ovary_ovulation).toBe(1);
    expect(backup.tables.daily_logs[0]?.cervical_firmness).toBe('closed');
    expect(backup.tables.uterine_fluid[0]?.daily_log_id).toBe('log-1');
    expect(backup.tables.uterine_fluid[0]?.depth_mm).toBe(14);
    expect(backup.tables.uterine_flushes[0]?.base_solution).toBe('LRS');
    expect(backup.tables.uterine_flush_products[0]?.product_name).toBe('Saline');
    expect(backup.tables.medication_logs[0]?.source_daily_log_id).toBe('log-1');
    expect(backup.tables.tasks[0]?.completed_record_type).toBe('pregnancyCheck');
    expect(backup.tables.tasks[0]?.source_reason).toBe('breedingPregnancyCheck');
    expect(backup.tables.collection_dose_events[0]?.recipient_phone).toBe('555-0101');
    expect(backup.tables.collection_dose_events[0]?.breeding_record_id).toBe('breed-1');
    expect(backup.tables.collection_dose_events[0]?.dose_semen_volume_ml).toBe(50);
    expect(backup.tables.collection_dose_events[0]?.dose_extender_volume_ml).toBeNull();
    expect(backup.tables.semen_collections[0]?.target_mode).toBe('progressive');
    expect(
      backup.tables.semen_collections[0]?.target_motile_sperm_millions_per_dose,
    ).toBe(500);
    expect(backup.tables.frozen_semen_batches[0]?.id).toBe('frozen-1');
    expect(backup.tables.frozen_semen_batches[0]?.extender).toBe('BotuCrio');
    expect(backup.tables.photo_assets[0]?.master_relative_path).toBe(
      'photo-assets/photo-asset-1/master.jpg',
    );
    expect(backup.tables.photo_attachments[0]?.photo_asset_id).toBe('photo-asset-1');
    expect(db.getAllAsync).toHaveBeenCalledTimes(17);
  });
});
