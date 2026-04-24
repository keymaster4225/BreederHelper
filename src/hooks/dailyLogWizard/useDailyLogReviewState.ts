import { useCallback, useState } from 'react';

import type { DailyLogOvulationSource } from '@/models/types';

import type { DailyLogWizardLegacyNotes } from './types';

type HydrateReviewInput = {
  notes: string;
  legacyNotes: DailyLogWizardLegacyNotes;
  legacyOvulationDetected: boolean | null;
  ovulationSource: DailyLogOvulationSource;
};

export function useDailyLogReviewState() {
  const [notes, setNotes] = useState('');
  const [legacyNotes, setLegacyNotes] = useState<DailyLogWizardLegacyNotes>({
    rightOvary: null,
    leftOvary: null,
    uterineTone: null,
  });
  const [legacyOvulationDetected, setLegacyOvulationDetected] = useState<boolean | null>(null);
  const [ovulationSource, setOvulationSource] = useState<DailyLogOvulationSource>('structured');

  const markOvulationStructured = useCallback((): void => {
    setOvulationSource('structured');
  }, []);

  const hydrateReview = useCallback((value: HydrateReviewInput): void => {
    setNotes(value.notes);
    setLegacyNotes(value.legacyNotes);
    setLegacyOvulationDetected(value.legacyOvulationDetected);
    setOvulationSource(value.ovulationSource);
  }, []);

  return {
    notes,
    legacyNotes,
    legacyOvulationDetected,
    ovulationSource,
    setNotes,
    setOvulationSource,
    markOvulationStructured,
    hydrateReview,
  };
}
