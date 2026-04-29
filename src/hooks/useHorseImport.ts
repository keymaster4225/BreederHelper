import { useCallback, useState } from 'react';

import {
  importHorseTransfer,
  pickHorseTransferFile,
  previewHorseImport,
  readHorseTransferTextFile,
  validateHorseTransferJson,
  type HorseImportPreview,
  type HorseMatchResult,
  type HorseTransferEnvelopeV1,
  type HorseTransferImportSummary,
  type HorseTransferImportTarget,
} from '@/storage/horseTransfer';

export type {
  HorseTransferImportSummary as HorseImportSummary,
  HorseTransferRowResult as HorseImportRowResult,
} from '@/storage/horseTransfer';

type PendingHorseImportState = {
  readonly sourceName: string;
  readonly envelope: HorseTransferEnvelopeV1;
  readonly preview: HorseImportPreview;
  readonly match: HorseMatchResult;
  readonly selectedTarget: HorseTransferImportTarget | null;
};

export type PendingHorseImportPreview = Omit<PendingHorseImportState, 'envelope'>;

export type PrepareHorseImportResult =
  | {
      readonly ok: true;
      readonly pendingImport: PendingHorseImportPreview;
    }
  | {
      readonly ok: false;
      readonly canceled?: boolean;
      readonly errorMessage?: string;
    };

export type ConfirmHorseImportResult =
  | {
      readonly ok: true;
      readonly safetySnapshotCreated: boolean;
      readonly summary: HorseTransferImportSummary;
    }
  | {
      readonly ok: false;
      readonly safetySnapshotCreated?: boolean;
      readonly errorMessage: string;
    };

type UseHorseImportOptions = {
  readonly onImportCompleted?: () => Promise<void>;
};

type UseHorseImportResult = {
  readonly isBusy: boolean;
  readonly busyStepLabel: string | null;
  readonly errorMessage: string | null;
  readonly pendingImport: PendingHorseImportPreview | null;
  readonly finalSummary: HorseTransferImportSummary | null;
  readonly prepareImportFromPickedFile: () => Promise<PrepareHorseImportResult>;
  readonly selectCreateNewTarget: () => void;
  readonly selectExistingTarget: (destinationHorseId: string) => void;
  readonly confirmPreparedImport: () => Promise<ConfirmHorseImportResult>;
  readonly clearPendingImport: () => void;
  readonly clearFinalSummary: () => void;
};

export function useHorseImport(options: UseHorseImportOptions = {}): UseHorseImportResult {
  const { onImportCompleted } = options;
  const [isBusy, setIsBusy] = useState(false);
  const [busyStepLabel, setBusyStepLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingHorseImportState | null>(null);
  const [finalSummary, setFinalSummary] = useState<HorseTransferImportSummary | null>(null);

  const prepareImportFromPickedFile = useCallback(async (): Promise<PrepareHorseImportResult> => {
    setIsBusy(true);
    setBusyStepLabel('Reading horse package...');
    setErrorMessage(null);
    setPendingImport(null);
    setFinalSummary(null);

    try {
      const pickedFile = await pickHorseTransferFile();
      if (pickedFile.canceled) {
        return {
          ok: false,
          canceled: true,
        };
      }

      const jsonText = await readHorseTransferTextFile(pickedFile.uri);
      setBusyStepLabel('Validating horse package...');

      const validation = validateHorseTransferJson(jsonText);
      if (!validation.ok) {
        setErrorMessage(validation.error.message);
        return {
          ok: false,
          errorMessage: validation.error.message,
        };
      }

      setBusyStepLabel('Preparing import preview...');
      const { preview, match } = await previewHorseImport(validation.envelope);
      const nextPendingImport: PendingHorseImportState = {
        sourceName: pickedFile.name,
        envelope: validation.envelope,
        preview,
        match,
        selectedTarget: getDefaultImportTarget(match),
      };

      setPendingImport(nextPendingImport);

      return {
        ok: true,
        pendingImport: toPendingHorseImportPreview(nextPendingImport),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Horse package could not be read.';
      setErrorMessage(message);
      return {
        ok: false,
        errorMessage: message,
      };
    } finally {
      setIsBusy(false);
      setBusyStepLabel(null);
    }
  }, []);

  const selectCreateNewTarget = useCallback(() => {
    setPendingImport((current) =>
      current
        ? {
            ...current,
            selectedTarget: { kind: 'create_new' },
          }
        : current,
    );
  }, []);

  const selectExistingTarget = useCallback((destinationHorseId: string) => {
    setPendingImport((current) =>
      current
        ? {
            ...current,
            selectedTarget: { kind: 'confirmed_match', destinationHorseId },
          }
        : current,
    );
  }, []);

  const confirmPreparedImport = useCallback(async (): Promise<ConfirmHorseImportResult> => {
    if (pendingImport == null) {
      const message = 'Choose and validate a horse package before importing.';
      setErrorMessage(message);
      return {
        ok: false,
        errorMessage: message,
      };
    }

    if (pendingImport.selectedTarget == null) {
      const message = 'Choose a destination horse or create a new record before importing.';
      setErrorMessage(message);
      return {
        ok: false,
        errorMessage: message,
      };
    }

    setIsBusy(true);
    setBusyStepLabel('Importing horse package...');
    setErrorMessage(null);

    try {
      const result = await importHorseTransfer(pendingImport.envelope, {
        target: pendingImport.selectedTarget,
      });

      if (!result.ok) {
        setErrorMessage(result.errorMessage);
        return result;
      }

      setPendingImport(null);
      setFinalSummary(result.summary);
      await onImportCompleted?.();

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Horse import failed unexpectedly.';
      setErrorMessage(message);
      return {
        ok: false,
        errorMessage: message,
      };
    } finally {
      setIsBusy(false);
      setBusyStepLabel(null);
    }
  }, [onImportCompleted, pendingImport]);

  const clearPendingImport = useCallback(() => {
    setPendingImport(null);
  }, []);

  const clearFinalSummary = useCallback(() => {
    setFinalSummary(null);
  }, []);

  return {
    isBusy,
    busyStepLabel,
    errorMessage,
    pendingImport: pendingImport ? toPendingHorseImportPreview(pendingImport) : null,
    finalSummary,
    prepareImportFromPickedFile,
    selectCreateNewTarget,
    selectExistingTarget,
    confirmPreparedImport,
    clearPendingImport,
    clearFinalSummary,
  };
}

function getDefaultImportTarget(match: HorseMatchResult): HorseTransferImportTarget | null {
  if (match.state === 'matched') {
    return {
      kind: 'confirmed_match',
      destinationHorseId: match.horse.id,
    };
  }

  if (match.state === 'create_new') {
    return { kind: 'create_new' };
  }

  return null;
}

function toPendingHorseImportPreview(
  state: PendingHorseImportState,
): PendingHorseImportPreview {
  return {
    sourceName: state.sourceName,
    preview: state.preview,
    match: state.match,
    selectedTarget: state.selectedTarget,
  };
}
