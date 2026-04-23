import { getDb } from '@/storage/db';

import type { RepoDb } from './dbTypes';

export async function resolveDb(db?: RepoDb): Promise<RepoDb> {
  if (db) {
    return db;
  }

  return (await getDb()) as unknown as RepoDb;
}
