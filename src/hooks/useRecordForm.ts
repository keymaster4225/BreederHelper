import { useCallback, useEffect, useRef, useState } from 'react';

type AsyncErrorHandler = (error: unknown) => void;

type RunOptions = {
  readonly onError?: AsyncErrorHandler;
};

type UseRecordFormArgs = {
  readonly initialLoading?: boolean;
};

type UseRecordFormResult = {
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isDeleting: boolean;
  readonly setIsLoading: (value: boolean) => void;
  readonly runLoad: <T>(work: () => Promise<T>, options?: RunOptions) => Promise<T | undefined>;
  readonly runSave: <T>(work: () => Promise<T>, options?: RunOptions) => Promise<T | undefined>;
  readonly runDelete: <T>(work: () => Promise<T>, options?: RunOptions) => Promise<T | undefined>;
};

export function useRecordForm({ initialLoading = false }: UseRecordFormArgs = {}): UseRecordFormResult {
  const [isLoading, setIsLoadingState] = useState(initialLoading);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setIsLoading = useCallback((value: boolean): void => {
    if (!mountedRef.current) return;
    setIsLoadingState(value);
  }, []);

  const runLoad = useCallback(
    async <T>(work: () => Promise<T>, options?: RunOptions): Promise<T | undefined> => {
      if (mountedRef.current) {
        setIsLoadingState(true);
      }

      try {
        return await work();
      } catch (error) {
        options?.onError?.(error);
        return undefined;
      } finally {
        if (mountedRef.current) {
          setIsLoadingState(false);
        }
      }
    },
    [],
  );

  const runSave = useCallback(
    async <T>(work: () => Promise<T>, options?: RunOptions): Promise<T | undefined> => {
      if (mountedRef.current) {
        setIsSaving(true);
      }

      try {
        return await work();
      } catch (error) {
        options?.onError?.(error);
        return undefined;
      } finally {
        if (mountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [],
  );

  const runDelete = useCallback(
    async <T>(work: () => Promise<T>, options?: RunOptions): Promise<T | undefined> => {
      if (mountedRef.current) {
        setIsDeleting(true);
      }

      try {
        return await work();
      } catch (error) {
        options?.onError?.(error);
        return undefined;
      } finally {
        if (mountedRef.current) {
          setIsDeleting(false);
        }
      }
    },
    [],
  );

  return {
    isLoading,
    isSaving,
    isDeleting,
    setIsLoading,
    runLoad,
    runSave,
    runDelete,
  };
}
