import { useEffect, useState } from 'react';

import { initDb } from '@/storage/db';
import { runBootPhotoConsistencySweep } from '@/storage/photoFiles/sweep';
import { persistStartupError } from '@/utils/startupErrorLog';

export function useAppBootstrap(): {
  isReady: boolean;
  error: Error | null;
  errorReportId: string | null;
} {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [errorReportId, setErrorReportId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    initDb()
      .then(() => runBootPhotoConsistencySweep())
      .then(() => {
        if (mounted) {
          setIsReady(true);
        }
      })
      .catch(async (err: unknown) => {
        const normalizedError =
          err instanceof Error ? err : new Error('Database initialization failed');
        const reportId = await persistStartupError(normalizedError);

        if (mounted) {
          setError(normalizedError);
          setErrorReportId(reportId);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { isReady, error, errorReportId };
}
