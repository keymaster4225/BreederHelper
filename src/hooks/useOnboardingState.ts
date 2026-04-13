import { useCallback, useEffect, useRef, useState } from 'react';

import { getOnboardingComplete, setOnboardingComplete } from '@/utils/onboarding';

type OnboardingState = {
  readonly onboardingComplete: boolean;
  readonly isOnboardingLoading: boolean;
  readonly completeOnboarding: () => Promise<void>;
};

export function useOnboardingState(hasAnimals: boolean): OnboardingState {
  const [onboardingComplete, setOnboardingCompleteState] = useState(true);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const isPersistingRef = useRef(false);

  const persistCompletion = useCallback(async () => {
    if (isPersistingRef.current) {
      return;
    }

    isPersistingRef.current = true;

    try {
      await setOnboardingComplete();
    } catch {
      // Fail open. The user should still proceed even if persistence fails.
    } finally {
      isPersistingRef.current = false;
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    setOnboardingCompleteState(true);
    await persistCompletion();
  }, [persistCompletion]);

  useEffect(() => {
    let isActive = true;

    if (hasAnimals) {
      setOnboardingCompleteState(true);
      setIsOnboardingLoading(false);
      void persistCompletion();

      return () => {
        isActive = false;
      };
    }

    const loadOnboardingState = async () => {
      try {
        const storedValue = await getOnboardingComplete();

        if (!isActive) {
          return;
        }

        setOnboardingCompleteState(storedValue);
      } catch {
        if (!isActive) {
          return;
        }

        setOnboardingCompleteState(true);
      } finally {
        if (isActive) {
          setIsOnboardingLoading(false);
        }
      }
    };

    void loadOnboardingState();

    return () => {
      isActive = false;
    };
  }, [hasAnimals, persistCompletion]);

  return {
    onboardingComplete,
    isOnboardingLoading,
    completeOnboarding,
  };
}
