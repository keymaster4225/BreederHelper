import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useCalendars } from 'expo-localization';

import {
  ClockDisplayMode,
  ClockPreference,
  getClockPreference,
  resolveClockDisplayMode,
  setClockPreference as persistClockPreference,
} from '@/utils/clockPreferences';

type ClockPreferenceContextValue = {
  readonly clockPreference: ClockPreference;
  readonly clockDisplayMode: ClockDisplayMode;
  readonly setClockPreference: (value: ClockPreference) => Promise<void>;
};

const DEFAULT_CONTEXT_VALUE: ClockPreferenceContextValue = {
  clockPreference: 'system',
  clockDisplayMode: '12h',
  setClockPreference: async () => undefined,
};

const ClockPreferenceContext = createContext<ClockPreferenceContextValue>(DEFAULT_CONTEXT_VALUE);

type Props = {
  readonly children: ReactNode;
};

export function ClockPreferenceProvider({ children }: Props): JSX.Element {
  const [clockPreference, setClockPreferenceState] = useState<ClockPreference>('system');
  const calendars = useCalendars();
  const systemDisplayMode: ClockDisplayMode =
    calendars[0]?.uses24hourClock === true ? '24h' : '12h';

  useEffect(() => {
    let isActive = true;

    async function loadClockPreference(): Promise<void> {
      try {
        const storedPreference = await getClockPreference();
        if (isActive) {
          setClockPreferenceState(storedPreference);
        }
      } catch {
        if (isActive) {
          setClockPreferenceState('system');
        }
      }
    }

    void loadClockPreference();

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<ClockPreferenceContextValue>(() => {
    async function setClockPreference(value: ClockPreference): Promise<void> {
      setClockPreferenceState(value);
      try {
        await persistClockPreference(value);
      } catch {
        // Keep the optimistic UI state; the next app launch will fall back to the stored value.
      }
    }

    return {
      clockPreference,
      clockDisplayMode: resolveClockDisplayMode(clockPreference, systemDisplayMode),
      setClockPreference,
    };
  }, [clockPreference, systemDisplayMode]);

  return (
    <ClockPreferenceContext.Provider value={value}>
      {children}
    </ClockPreferenceContext.Provider>
  );
}

export function useClockPreference(): ClockPreferenceContextValue {
  return useContext(ClockPreferenceContext);
}

export function useClockDisplayMode(): ClockDisplayMode {
  return useClockPreference().clockDisplayMode;
}
