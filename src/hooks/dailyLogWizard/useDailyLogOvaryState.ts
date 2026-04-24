import { useCallback, useState } from 'react';

import type { FollicleState, OvaryConsistency, OvaryStructure } from '@/models/types';
import { newId } from '@/utils/id';

import { createEmptyOvaryDraft } from './mappers';
import type {
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

  const setOvaryFollicleState = useCallback(
    (side: DailyLogWizardOvarySide, value: FollicleState | null): void => {
      setOvaryForSide(side, (current) => {
        const needsSeedRow = value === 'measured' && current.follicleMeasurements.length === 0;
        return {
          ...current,
          follicleState: value,
          follicleMeasurements: needsSeedRow
            ? [{ clientId: newId(), value: '' }]
            : current.follicleMeasurements,
        };
      });

      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: {},
      }));
    },
    [setErrors, setOvaryForSide],
  );

  const setOvaryFollicleSize = useCallback(
    (side: DailyLogWizardOvarySide, value: string): void => {
      setOvaryForSide(side, (current) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return {
            ...current,
            follicleState: null,
            follicleMeasurements: [],
          };
        }

        const existingClientId = current.follicleMeasurements[0]?.clientId ?? newId();
        return {
          ...current,
          follicleState: 'measured',
          follicleMeasurements: [{ clientId: existingClientId, value }],
        };
      });

      setErrors((current) => ({
        ...current,
        [side === 'right' ? 'rightOvary' : 'leftOvary']: {
          ...current[side === 'right' ? 'rightOvary' : 'leftOvary'],
          measurements: undefined,
        },
      }));
    },
    [setErrors, setOvaryForSide],
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
    },
    [setOvaryForSide],
  );

  const updateOvaryMeasurement = useCallback(
    (side: DailyLogWizardOvarySide, clientId: string, value: string): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: current.follicleMeasurements.map((measurement) =>
          measurement.clientId === clientId ? { ...measurement, value } : measurement,
        ),
      }));
    },
    [setOvaryForSide],
  );

  const removeOvaryMeasurement = useCallback(
    (side: DailyLogWizardOvarySide, clientId: string): void => {
      setOvaryForSide(side, (current) => ({
        ...current,
        follicleMeasurements: current.follicleMeasurements.filter(
          (measurement) => measurement.clientId !== clientId,
        ),
      }));
    },
    [setOvaryForSide],
  );

  return {
    rightOvary,
    leftOvary,
    hydrateOvaries,
    setOvaryOvulation,
    setOvaryFollicleState,
    setOvaryFollicleSize,
    setOvaryConsistency,
    toggleOvaryStructure,
    addOvaryMeasurement,
    updateOvaryMeasurement,
    removeOvaryMeasurement,
  };
}
