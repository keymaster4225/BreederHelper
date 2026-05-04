import { useCallback, useState } from 'react';

import type { OvaryConsistency, OvaryStructure } from '@/models/types';
import { newId } from '@/utils/id';

import { createEmptyOvaryDraft } from './mappers';
import {
  getPrimaryFindingStructure,
  removePrimaryFindingStructures,
} from './measurementUtils';
import type {
  DailyLogWizardFollicleFinding,
  DailyLogWizardOvaryDraft,
  DailyLogWizardOvarySide,
  DailyLogWizardSetErrors,
} from './types';

type UseDailyLogOvaryStateArgs = {
  setErrors: DailyLogWizardSetErrors;
  onStructuredOvulationChange: () => void;
};

export function useDailyLogOvaryState({
  setErrors,
  onStructuredOvulationChange,
}: UseDailyLogOvaryStateArgs) {
  const [rightOvary, setRightOvary] = useState<DailyLogWizardOvaryDraft>(createEmptyOvaryDraft);
  const [leftOvary, setLeftOvary] = useState<DailyLogWizardOvaryDraft>(createEmptyOvaryDraft);

  const hydrateOvaries = useCallback(
    (
      nextRightOvary: DailyLogWizardOvaryDraft,
      nextLeftOvary: DailyLogWizardOvaryDraft,
    ): void => {
      setRightOvary(nextRightOvary);
      setLeftOvary(nextLeftOvary);
    },
    [],
  );

  const setOvaryForSide = useCallback(
    (
      side: DailyLogWizardOvarySide,
      updater: (current: DailyLogWizardOvaryDraft) => DailyLogWizardOvaryDraft,
    ): void => {
      if (side === 'right') {
        setRightOvary((current) => updater(current));
        return;
      }

      setLeftOvary((current) => updater(current));
    },
    [],
  );

  const setOvaryOvulation = useCallback(
    (side: DailyLogWizardOvarySide, value: boolean | null): void => {
      const currentValue = side === 'right' ? rightOvary.ovulation : leftOvary.ovulation;
      if (currentValue !== value) {
        onStructuredOvulationChange();
      }

      setOvaryForSide(side, (current) => ({
        ...current,
        ovulation: value,
      }));
    },
    [leftOvary.ovulation, onStructuredOvulationChange, rightOvary.ovulation, setOvaryForSide],
  );

  const clearOvaryMeasurementError = useCallback(
    (side: DailyLogWizardOvarySide): void => {
      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: {
          ...current[side === 'right' ? 'rightOvary' : 'leftOvary'],
          measurements: undefined,
        },
      }));
    },
    [setErrors],
  );

  const setOvaryFollicleFinding = useCallback(
    (side: DailyLogWizardOvarySide, finding: DailyLogWizardFollicleFinding): void => {
      setOvaryForSide(side, (current) => {
        if (finding === 'measured') {
          const needsSeedRow = current.follicleMeasurements.length === 0;
          return {
            ...current,
            follicleState: 'measured',
            follicleMeasurements: needsSeedRow
              ? [{ clientId: newId(), value: '' }]
              : current.follicleMeasurements,
            structures: removePrimaryFindingStructures(current.structures),
          };
        }

        const primaryStructure = getPrimaryFindingStructure(finding);
        const additionalStructures = removePrimaryFindingStructures(current.structures);
        return {
          ...current,
          follicleState: null,
          follicleMeasurements: [],
          structures: primaryStructure
            ? [...additionalStructures, primaryStructure]
            : additionalStructures,
        };
      });

      clearOvaryMeasurementError(side);
    },
    [clearOvaryMeasurementError, setOvaryForSide],
  );

  const setOvaryConsistency = useCallback(
    (side: DailyLogWizardOvarySide, value: OvaryConsistency | null): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        consistency: value,
      }));
    },
    [setOvaryForSide],
  );

  const toggleOvaryStructure = useCallback(
    (side: DailyLogWizardOvarySide, structure: OvaryStructure): void => {
      setOvaryForSide(side, (current) => {
        const hasStructure = current.structures.includes(structure);
        return {
          ...current,
          structures: hasStructure
            ? current.structures.filter((value) => value !== structure)
            : [...current.structures, structure],
        };
      });
    },
    [setOvaryForSide],
  );

  const addOvaryMeasurement = useCallback(
    (side: DailyLogWizardOvarySide): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: [...current.follicleMeasurements, { clientId: newId(), value: '' }],
      }));
      clearOvaryMeasurementError(side);
    },
    [clearOvaryMeasurementError, setOvaryForSide],
  );

  const updateOvaryMeasurement = useCallback(
    (side: DailyLogWizardOvarySide, clientId: string, value: string): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: current.follicleMeasurements.map((measurement) =>
          measurement.clientId === clientId ? { ...measurement, value } : measurement,
        ),
      }));
      clearOvaryMeasurementError(side);
    },
    [clearOvaryMeasurementError, setOvaryForSide],
  );

  const removeOvaryMeasurement = useCallback(
    (side: DailyLogWizardOvarySide, clientId: string): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: current.follicleMeasurements.filter(
          (measurement) => measurement.clientId !== clientId,
        ),
      }));
      clearOvaryMeasurementError(side);
    },
    [clearOvaryMeasurementError, setOvaryForSide],
  );

  return {
    rightOvary,
    leftOvary,
    hydrateOvaries,
    setOvaryOvulation,
    setOvaryFollicleFinding,
    setOvaryConsistency,
    toggleOvaryStructure,
    addOvaryMeasurement,
    updateOvaryMeasurement,
    removeOvaryMeasurement,
  };
}
