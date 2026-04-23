import { describe, expect, it, vi } from 'vitest';

vi.mock('@/storage/db', () => ({
  getDb: vi.fn(),
}));

import { createMare, getMareById, listMares, updateMare } from './mares';

type MareRow = {
  id: string;
  name: string;
  breed: string;
  gestation_length_days: number;
  date_of_birth: string | null;
  registration_number: string | null;
  is_recipient: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createMareDb() {
  const mares = new Map<string, MareRow>();

  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<void> {
      const stmt = normalized(sql);

      if (stmt.startsWith('insert into mares')) {
        const [
          id,
          name,
          breed,
          gestationLengthDays,
          dateOfBirth,
          registrationNumber,
          isRecipient,
          notes,
          createdAt,
          updatedAt,
        ] = params as [
          string,
          string,
          string,
          number,
          string | null,
          string | null,
          number,
          string | null,
          string,
          string,
        ];

        mares.set(id, {
          id,
          name,
          breed,
          gestation_length_days: gestationLengthDays,
          date_of_birth: dateOfBirth,
          registration_number: registrationNumber,
          is_recipient: isRecipient,
          notes,
          created_at: createdAt,
          updated_at: updatedAt,
          deleted_at: null,
        });
        return;
      }

      if (stmt.startsWith('update mares set name =')) {
        const [
          name,
          breed,
          gestationLengthDays,
          dateOfBirth,
          registrationNumber,
          isRecipient,
          notes,
          updatedAt,
          id,
        ] = params as [
          string,
          string,
          number,
          string | null,
          string | null,
          number,
          string | null,
          string,
          string,
        ];

        const existing = mares.get(id);
        if (!existing) {
          return;
        }

        mares.set(id, {
          ...existing,
          name,
          breed,
          gestation_length_days: gestationLengthDays,
          date_of_birth: dateOfBirth,
          registration_number: registrationNumber,
          is_recipient: isRecipient,
          notes,
          updated_at: updatedAt,
        });
      }
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = normalized(sql);

      if (stmt.includes('from mares') && stmt.includes('where id = ?')) {
        const [id] = params as [string];
        return (mares.get(id) ?? null) as T | null;
      }

      return null;
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      const stmt = normalized(sql);

      if (stmt.includes('from mares')) {
        return Array.from(mares.values())
          .filter((row) => !stmt.includes('where deleted_at is null') || row.deleted_at == null)
          .sort((left, right) => left.name.localeCompare(right.name)) as T[];
      }

      return [];
    },
    async withTransactionAsync<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
  };
}

describe('mares repository', () => {
  it('round-trips isRecipient through create, update, get, and list operations', async () => {
    const db = createMareDb();

    await createMare(
      {
        id: 'mare-1',
        name: 'Maple',
        breed: 'Quarter Horse',
        gestationLengthDays: 345,
        isRecipient: true,
      },
      db,
    );

    expect((await getMareById('mare-1', db))?.isRecipient).toBe(true);
    expect((await listMares(false, db))[0]?.isRecipient).toBe(true);

    await updateMare(
      'mare-1',
      {
        name: 'Maple',
        breed: 'Quarter Horse',
        gestationLengthDays: 345,
        isRecipient: false,
      },
      db,
    );

    expect((await getMareById('mare-1', db))?.isRecipient).toBe(false);
    expect((await listMares(false, db))[0]?.isRecipient).toBe(false);
  });
});
