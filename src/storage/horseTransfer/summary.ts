import { BACKUP_TABLE_NAMES } from '@/storage/backup/types';

import type {
  HorseTransferEnvelopeV1,
  HorseTransferPreviewSummary,
  HorseTransferTableCounts,
} from './types';

export function buildHorseTransferPreviewSummary(
  envelope: HorseTransferEnvelopeV1,
): HorseTransferPreviewSummary {
  return {
    createdAt: envelope.createdAt,
    appVersion: envelope.app.version,
    dataSchemaVersion: envelope.dataSchemaVersion,
    sourceHorse: envelope.sourceHorse,
    privacy: envelope.privacy,
    tableCounts: buildHorseTransferTableCounts(envelope),
  };
}

function buildHorseTransferTableCounts(
  envelope: HorseTransferEnvelopeV1,
): HorseTransferTableCounts {
  const tableCounts = {} as HorseTransferTableCounts;
  for (const tableName of BACKUP_TABLE_NAMES) {
    tableCounts[tableName] = envelope.tables[tableName].length;
  }
  return tableCounts;
}
