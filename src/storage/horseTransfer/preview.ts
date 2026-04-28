import { getDb } from '@/storage/db';
import { BACKUP_TABLE_NAMES, type BackupTableName } from '@/storage/backup/types';

import { matchHorseTransfer, type HorseMatchResult } from './matching';
import {
  HORSE_IMPORT_NON_OVERWRITE_MESSAGE,
  HORSE_IMPORT_SAFETY_SNAPSHOT_PROMISE_MESSAGE,
  type HorseImportPreview,
  type HorseTransferEnvelopeV1,
  type HorseTransferRedactionNotice,
  type HorseTransferTableCounts,
} from './types';

type HorseIdentityQueryRow = {
  readonly id: string;
  readonly name: string;
  readonly registration_number: string | null;
  readonly date_of_birth: string | null;
  readonly deleted_at: string | null;
};

type PreviewDb = {
  getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
};

type IdRow = {
  readonly id: string;
};

export async function previewHorseImport(
  envelope: HorseTransferEnvelopeV1,
): Promise<{ preview: HorseImportPreview; match: HorseMatchResult }> {
  const db = (await getDb()) as unknown as PreviewDb;
  const destinationHorses = await loadDestinationHorses(db, envelope);
  const match = matchHorseTransfer({
    sourceHorse: envelope.sourceHorse,
    destinationHorses,
  });

  const tableCounts = buildTableCounts(envelope);
  const totalRowCount = sumCounts(tableCounts);
  const estimatedConflictCounts = await estimatePrimaryKeyConflicts(db, envelope);
  const estimatedConflictTotal = sumCounts(estimatedConflictCounts);
  const redactionNotices = buildRedactionNotices(envelope);

  return {
    preview: {
      createdAt: envelope.createdAt,
      appVersion: envelope.app.version,
      dataSchemaVersion: envelope.dataSchemaVersion,
      sourceHorse: envelope.sourceHorse,
      privacy: envelope.privacy,
      tableCounts,
      totalRowCount,
      estimatedConflictCounts,
      estimatedConflictTotal,
      targetState: match.state,
      redactionNotices,
      nonOverwriteMessage: HORSE_IMPORT_NON_OVERWRITE_MESSAGE,
      safetySnapshotMessage: HORSE_IMPORT_SAFETY_SNAPSHOT_PROMISE_MESSAGE,
    },
    match,
  };
}

async function loadDestinationHorses(
  db: PreviewDb,
  envelope: HorseTransferEnvelopeV1,
) {
  if (envelope.sourceHorse.type === 'mare') {
    const rows = await db.getAllAsync<HorseIdentityQueryRow>(
      `
      SELECT id, name, registration_number, date_of_birth, deleted_at
      FROM mares
      ORDER BY name COLLATE NOCASE ASC, id ASC;
      `,
    );
    return rows.map(mapHorseIdentityRow);
  }

  const rows = await db.getAllAsync<HorseIdentityQueryRow>(
    `
    SELECT id, name, registration_number, date_of_birth, deleted_at
    FROM stallions
    ORDER BY name COLLATE NOCASE ASC, id ASC;
    `,
  );
  return rows.map(mapHorseIdentityRow);
}

function mapHorseIdentityRow(row: HorseIdentityQueryRow) {
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number,
    dateOfBirth: row.date_of_birth,
    deletedAt: row.deleted_at,
  };
}

function buildTableCounts(envelope: HorseTransferEnvelopeV1): HorseTransferTableCounts {
  const tableCounts = {} as HorseTransferTableCounts;
  for (const tableName of BACKUP_TABLE_NAMES) {
    tableCounts[tableName] = envelope.tables[tableName].length;
  }
  return tableCounts;
}

function buildRedactionNotices(envelope: HorseTransferEnvelopeV1): readonly HorseTransferRedactionNotice[] {
  const notices: HorseTransferRedactionNotice[] = [];
  if (envelope.privacy.redactedContextStallions) {
    notices.push({
      code: 'context_stallions_redacted',
      message: 'Context stallion pedigree and AV details were redacted in this package.',
    });
  }
  if (envelope.privacy.redactedDoseRecipientAndShipping) {
    notices.push({
      code: 'dose_recipient_shipping_redacted',
      message: 'Dose recipient and shipping details were redacted in this package.',
    });
  }
  return notices;
}

async function estimatePrimaryKeyConflicts(
  db: PreviewDb,
  envelope: HorseTransferEnvelopeV1,
): Promise<HorseTransferTableCounts> {
  const estimatedConflicts = createZeroCounts();

  for (const tableName of BACKUP_TABLE_NAMES) {
    const ids = getRowIds(envelope, tableName);
    if (ids.length === 0) {
      continue;
    }

    const placeholders = ids.map(() => '?').join(', ');
    const rows = await db.getAllAsync<IdRow>(
      `
      SELECT id
      FROM ${tableName}
      WHERE id IN (${placeholders});
      `,
      ids,
    );

    estimatedConflicts[tableName] = rows.length;
  }

  return estimatedConflicts;
}

function getRowIds(envelope: HorseTransferEnvelopeV1, tableName: BackupTableName): readonly string[] {
  const rows = envelope.tables[tableName] as readonly { readonly id: string }[];
  return rows.map((row) => row.id);
}

function createZeroCounts(): HorseTransferTableCounts {
  const counts = {} as HorseTransferTableCounts;
  for (const tableName of BACKUP_TABLE_NAMES) {
    counts[tableName] = 0;
  }
  return counts;
}

function sumCounts(counts: HorseTransferTableCounts): number {
  let total = 0;
  for (const tableName of BACKUP_TABLE_NAMES) {
    total += counts[tableName];
  }
  return total;
}
