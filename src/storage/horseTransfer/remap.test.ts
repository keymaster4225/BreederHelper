import { describe, expect, it } from 'vitest';

import { cloneBackupFixture } from '@/storage/backup/testFixtures';

import {
  createHorseTransferIdMap,
  remapHorseTransferRow,
  setMappedHorseTransferId,
} from './remap';

describe('remapHorseTransferRow', () => {
  it('rewrites mare-owned record foreign keys', () => {
    const backup = cloneBackupFixture();
    const idMap = createHorseTransferIdMap();
    setMappedHorseTransferId(idMap, 'mares', 'mare-1', 'local-mare-1');
    setMappedHorseTransferId(idMap, 'stallions', 'stallion-1', 'local-stallion-1');
    setMappedHorseTransferId(idMap, 'semen_collections', 'collection-1', 'local-collection-1');

    const row = remapHorseTransferRow('breeding_records', backup.tables.breeding_records[0], idMap);

    expect(row).toMatchObject({
      id: 'breed-1',
      mare_id: 'local-mare-1',
      stallion_id: 'local-stallion-1',
      collection_id: 'local-collection-1',
    });
  });

  it('rewrites downstream uterine and foal parent IDs', () => {
    const backup = cloneBackupFixture();
    const idMap = createHorseTransferIdMap();
    setMappedHorseTransferId(idMap, 'daily_logs', 'log-1', 'local-log-1');
    setMappedHorseTransferId(idMap, 'uterine_flushes', 'flush-1', 'local-flush-1');
    setMappedHorseTransferId(idMap, 'foaling_records', 'foaling-1', 'local-foaling-1');

    expect(remapHorseTransferRow('uterine_fluid', backup.tables.uterine_fluid[0], idMap)).toMatchObject({
      daily_log_id: 'local-log-1',
    });
    expect(
      remapHorseTransferRow('uterine_flush_products', backup.tables.uterine_flush_products[0], idMap),
    ).toMatchObject({
      uterine_flush_id: 'local-flush-1',
    });
    expect(remapHorseTransferRow('foals', backup.tables.foals[0], idMap)).toMatchObject({
      foaling_record_id: 'local-foaling-1',
    });
  });

  it('rewrites task source and completion pointers by pointer type', () => {
    const backup = cloneBackupFixture();
    const idMap = createHorseTransferIdMap();
    setMappedHorseTransferId(idMap, 'mares', 'mare-1', 'local-mare-1');
    setMappedHorseTransferId(idMap, 'breeding_records', 'breed-1', 'local-breed-1');
    setMappedHorseTransferId(idMap, 'pregnancy_checks', 'check-1', 'local-check-1');

    const row = remapHorseTransferRow('tasks', backup.tables.tasks[1], idMap);

    expect(row).toMatchObject({
      mare_id: 'local-mare-1',
      source_record_id: 'local-breed-1',
      completed_record_id: 'local-check-1',
    });
  });
});
