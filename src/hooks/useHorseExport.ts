import { useCallback, useRef, useState } from 'react';

import {
  exportMareTransfer,
  exportStallionTransfer,
  shareHorseTransferFileIfAvailable,
  writeHorseTransferFile,
} from '@/storage/horseTransfer';

export type ExportHorsePackageResult =
  | {
      readonly ok: true;
      readonly fileName: string;
      readonly fileUri: string;
      readonly shared: boolean;
    }
  | {
      readonly ok: false;
      readonly errorMessage: string;
    };

type UseHorseExportResult = {
  readonly isExporting: boolean;
  readonly errorMessage: string | null;
  readonly exportMarePackage: (mareId: string) => Promise<ExportHorsePackageResult>;
  readonly exportStallionPackage: (stallionId: string) => Promise<ExportHorsePackageResult>;
};

export function useHorseExport(): UseHorseExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isExportingRef = useRef(false);

  const exportEnvelope = useCallback(
    async (
      createEnvelope: () => Promise<Awaited<ReturnType<typeof exportMareTransfer>>>,
    ): Promise<ExportHorsePackageResult> => {
      if (isExportingRef.current) {
        const message = 'Horse package export is already in progress.';
        setErrorMessage(message);
        return {
          ok: false,
          errorMessage: message,
        };
      }

      isExportingRef.current = true;
      setIsExporting(true);
      setErrorMessage(null);

      try {
        const envelope = await createEnvelope();
        const writtenFile = await writeHorseTransferFile(envelope);

        let shared = false;
        try {
          shared = await shareHorseTransferFileIfAvailable(writtenFile.fileUri);
        } catch {
          shared = false;
        }

        return {
          ok: true,
          fileName: writtenFile.fileName,
          fileUri: writtenFile.fileUri,
          shared,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Horse package could not be exported.';
        setErrorMessage(message);
        return {
          ok: false,
          errorMessage: message,
        };
      } finally {
        isExportingRef.current = false;
        setIsExporting(false);
      }
    },
    [],
  );

  const exportMarePackage = useCallback(
    (mareId: string) => exportEnvelope(() => exportMareTransfer(mareId)),
    [exportEnvelope],
  );

  const exportStallionPackage = useCallback(
    (stallionId: string) => exportEnvelope(() => exportStallionTransfer(stallionId)),
    [exportEnvelope],
  );

  return {
    isExporting,
    errorMessage,
    exportMarePackage,
    exportStallionPackage,
  };
}
