export interface RepoDb {
  runAsync(sql: string, params?: readonly unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  withTransactionAsync<T>(callback: () => Promise<T>): Promise<T>;
}
