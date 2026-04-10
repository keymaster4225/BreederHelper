import AsyncStorage from '@react-native-async-storage/async-storage';

const STARTUP_ERROR_LOG_KEY = 'startup_error_latest';

export type StartupErrorLogEntry = {
  id: string;
  timestamp: string;
  name: string;
  message: string;
  stack: string | null;
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error('Database initialization failed');
}

export async function persistStartupError(error: unknown): Promise<string> {
  const normalized = normalizeError(error);
  const id = `${Date.now()}`;
  const entry: StartupErrorLogEntry = {
    id,
    timestamp: new Date().toISOString(),
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack ?? null,
  };

  try {
    await AsyncStorage.setItem(STARTUP_ERROR_LOG_KEY, JSON.stringify(entry));
  } catch {
    // Avoid cascading failures while handling startup errors.
  }

  return id;
}

export async function getStartupErrorLog(): Promise<StartupErrorLogEntry | null> {
  const raw = await AsyncStorage.getItem(STARTUP_ERROR_LOG_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StartupErrorLogEntry;
    if (
      typeof parsed.id === 'string'
      && typeof parsed.timestamp === 'string'
      && typeof parsed.name === 'string'
      && typeof parsed.message === 'string'
    ) {
      return {
        ...parsed,
        stack: typeof parsed.stack === 'string' ? parsed.stack : null,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function clearStartupErrorLog(): Promise<void> {
  await AsyncStorage.removeItem(STARTUP_ERROR_LOG_KEY);
}
