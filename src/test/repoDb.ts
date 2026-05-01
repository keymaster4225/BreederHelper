import { expect, vi } from 'vitest';

export type SqlOperation = 'delete' | 'insert' | 'select' | 'update';

export type SqlCall = {
  readonly sql: string;
  readonly normalizedSql: string;
  readonly params: readonly unknown[];
};

type RepoDbOptions = {
  readonly onRun?: (call: SqlCall) => Promise<unknown> | unknown;
  readonly onGetFirst?: <T>(call: SqlCall) => Promise<T | null> | T | null;
  readonly onGetAll?: <T>(call: SqlCall) => Promise<T[]> | T[];
  readonly onTransaction?: <T>(callback: () => Promise<T>) => Promise<T>;
};

type RunMatcher = {
  readonly operation: Exclude<SqlOperation, 'select'>;
  readonly table: string;
};

type RunAsyncMock = ReturnType<typeof vi.fn> &
  ((sql: string, params?: readonly unknown[]) => Promise<unknown>);
type GetFirstAsyncMock = ReturnType<typeof vi.fn> &
  (<T>(sql: string, params?: readonly unknown[]) => Promise<T | null>);
type GetAllAsyncMock = ReturnType<typeof vi.fn> &
  (<T>(sql: string, params?: readonly unknown[]) => Promise<T[]>);
type TransactionAsyncMock = ReturnType<typeof vi.fn> &
  (<T>(callback: () => Promise<T>) => Promise<T>);
type ExclusiveTransactionAsyncMock = ReturnType<typeof vi.fn> &
  (<T>(callback: (transactionDb: RepoDbHarness) => Promise<T>) => Promise<T>);

export type RepoDbHarness = {
  readonly runAsync: RunAsyncMock;
  readonly getFirstAsync: GetFirstAsyncMock;
  readonly getAllAsync: GetAllAsyncMock;
  readonly withTransactionAsync: TransactionAsyncMock;
  readonly withExclusiveTransactionAsync: ExclusiveTransactionAsyncMock;
  readonly runCalls: SqlCall[];
  readonly getFirstCalls: SqlCall[];
  readonly getAllCalls: SqlCall[];
  readonly findRunCalls: (matcher: RunMatcher) => SqlCall[];
  readonly findRunCall: (matcher: RunMatcher) => SqlCall | undefined;
};

export function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function createSqlCall(sql: string, params: readonly unknown[] = []): SqlCall {
  return {
    sql,
    normalizedSql: normalizeSql(sql),
    params,
  };
}

function matchesRunCall(call: SqlCall, matcher: RunMatcher): boolean {
  const table = matcher.table.toLowerCase();

  switch (matcher.operation) {
    case 'delete':
      return call.normalizedSql.startsWith(`delete from ${table}`);
    case 'insert':
      return call.normalizedSql.startsWith(`insert into ${table}`);
    case 'update':
      return call.normalizedSql.startsWith(`update ${table}`);
  }
}

function requireRunCall(call: SqlCall | undefined, matcher: RunMatcher): SqlCall {
  expect(call, `Expected ${matcher.operation.toUpperCase()} for ${matcher.table}`).toBeDefined();
  return call as SqlCall;
}

function cleanColumnName(column: string): string {
  const unquoted = column.trim().replace(/["`[\]]/g, '');
  const parts = unquoted.split('.');
  return parts[parts.length - 1] ?? unquoted;
}

function splitColumns(columnText: string): string[] {
  return columnText
    .split(',')
    .map(cleanColumnName)
    .filter((column) => column.length > 0);
}

function extractInsertColumns(call: SqlCall): string[] {
  const match = call.sql.match(/insert\s+into\s+["`]?\w+["`]?\s*\(([\s\S]*?)\)\s*values/i);
  expect(match, `Expected INSERT with explicit columns: ${call.sql}`).not.toBeNull();
  return splitColumns(match?.[1] ?? '');
}

function extractUpdateColumns(call: SqlCall): string[] {
  const match = call.sql.match(/set\s+([\s\S]*?)\s+where/i);
  expect(match, `Expected UPDATE with SET and WHERE clauses: ${call.sql}`).not.toBeNull();
  return (match?.[1] ?? '')
    .split(',')
    .map((assignment) => assignment.match(/^\s*([^\s=]+)\s*=/)?.[1] ?? '')
    .map(cleanColumnName)
    .filter((column) => column.length > 0);
}

function mapParams(columns: readonly string[], params: readonly unknown[]): Record<string, unknown> {
  return columns.reduce<Record<string, unknown>>((acc, column, index) => {
    acc[column] = params[index];
    return acc;
  }, {});
}

function tableFromDelete(call: SqlCall): string {
  const match = call.normalizedSql.match(/^delete from ([a-z0-9_]+)/);
  return match?.[1] ?? '';
}

export function createRepoDb(options: RepoDbOptions = {}): RepoDbHarness {
  const runCalls: SqlCall[] = [];
  const getFirstCalls: SqlCall[] = [];
  const getAllCalls: SqlCall[] = [];

  const harness: RepoDbHarness = {
    runAsync: vi.fn(async (sql: string, params: readonly unknown[] = []) => {
      const call = createSqlCall(sql, params);
      runCalls.push(call);
      return options.onRun?.(call);
    }) as RunAsyncMock,
    getFirstAsync: vi.fn(async <T>(sql: string, params: readonly unknown[] = []) => {
      const call = createSqlCall(sql, params);
      getFirstCalls.push(call);
      if (options.onGetFirst) {
        return options.onGetFirst<T>(call);
      }
      return null;
    }) as GetFirstAsyncMock,
    getAllAsync: vi.fn(async <T>(sql: string, params: readonly unknown[] = []) => {
      const call = createSqlCall(sql, params);
      getAllCalls.push(call);
      if (options.onGetAll) {
        return options.onGetAll<T>(call);
      }
      return [];
    }) as GetAllAsyncMock,
    withTransactionAsync: vi.fn(async <T>(callback: () => Promise<T>) => {
      if (options.onTransaction) {
        return options.onTransaction(callback);
      }
      return callback();
    }) as TransactionAsyncMock,
    withExclusiveTransactionAsync: vi.fn(
      async <T>(callback: (transactionDb: RepoDbHarness) => Promise<T>) => callback(harness),
    ) as ExclusiveTransactionAsyncMock,
    runCalls,
    getFirstCalls,
    getAllCalls,
    findRunCalls(matcher: RunMatcher): SqlCall[] {
      return runCalls.filter((call) => matchesRunCall(call, matcher));
    },
    findRunCall(matcher: RunMatcher): SqlCall | undefined {
      return harness.findRunCalls(matcher)[0];
    },
  };

  return harness;
}

export function expectInsertForTable(
  db: Pick<RepoDbHarness, 'findRunCalls'>,
  table: string,
  index = 0,
): { readonly call: SqlCall; readonly params: Record<string, unknown> } {
  const call = requireRunCall(db.findRunCalls({ operation: 'insert', table })[index], {
    operation: 'insert',
    table,
  });
  return {
    call,
    params: mapParams(extractInsertColumns(call), call.params),
  };
}

export function expectUpdateForTable(
  db: Pick<RepoDbHarness, 'findRunCalls'>,
  table: string,
  index = 0,
): { readonly call: SqlCall; readonly params: Record<string, unknown> } {
  const call = requireRunCall(db.findRunCalls({ operation: 'update', table })[index], {
    operation: 'update',
    table,
  });
  return {
    call,
    params: mapParams(extractUpdateColumns(call), call.params),
  };
}

export function expectRunOrderForTables(
  db: Pick<RepoDbHarness, 'runCalls'>,
  expected: readonly RunMatcher[],
): void {
  const actual = db.runCalls.slice(0, expected.length).map((call) => ({
    operation: (call.normalizedSql.split(' ')[0] ?? '') as RunMatcher['operation'],
    table:
      call.normalizedSql.match(/^(?:insert into|delete from|update) ([a-z0-9_]+)/)?.[1] ??
      '',
  }));

  expect(actual).toEqual(expected);
}

export function expectManagedTableDeleteOrder(
  db: Pick<RepoDbHarness, 'runCalls'>,
  expectedTables: readonly string[],
): void {
  const deleteTables = db.runCalls
    .filter((call) => call.normalizedSql.startsWith('delete from '))
    .map(tableFromDelete);

  expect(deleteTables.slice(0, expectedTables.length)).toEqual(expectedTables);
}
