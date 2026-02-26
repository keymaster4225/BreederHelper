import { useEffect, useState } from 'react';

import { initDb } from '@/storage/db';

export function useAppBootstrap(): { isReady: boolean; error: Error | null } {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    initDb()
      .then(() => {
        if (mounted) {
          setIsReady(true);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Database initialization failed'));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { isReady, error };
}
