import { fireEvent, render } from '@testing-library/react-native';

import type { MedicationLog } from '@/models/types';

import { MedicationsTab } from './MedicationsTab';

jest.mock('@/hooks/useClockPreference', () => ({
  useClockDisplayMode: jest.fn(() => '12h'),
}));

const { useClockDisplayMode } = jest.requireMock('@/hooks/useClockPreference') as {
  useClockDisplayMode: jest.Mock;
};

function makeMedicationLog(overrides: Partial<MedicationLog> & { id: string }): MedicationLog {
  const { id, ...rest } = overrides;
  return {
    id,
    mareId: 'mare-1',
    date: '2026-05-05',
    time: '08:30',
    medicationName: 'Regumate',
    dose: null,
    route: null,
    notes: null,
    sourceDailyLogId: null,
    createdAt: '2026-05-05T08:30:00.000Z',
    updatedAt: '2026-05-05T08:30:00.000Z',
    ...rest,
  };
}

function createNavigation() {
  return {
    navigate: jest.fn(),
  };
}

beforeEach(() => {
  useClockDisplayMode.mockReturnValue('12h');
});

it('renders timed medication rows with date and time and legacy rows as date-only', () => {
  const screen = render(
    <MedicationsTab
      mareId="mare-1"
      medicationLogs={[
        makeMedicationLog({ id: 'med-timed', time: '18:30' }),
        makeMedicationLog({ id: 'med-legacy', date: '2026-05-04', time: null }),
      ]}
      navigation={createNavigation() as never}
    />,
  );

  expect(screen.getByText('2026-05-05 at 6:30 PM')).toBeTruthy();
  expect(screen.getByText('2026-05-04')).toBeTruthy();
});

it('routes linked flush rows to the source daily log form', () => {
  const navigation = createNavigation();
  const screen = render(
    <MedicationsTab
      mareId="mare-1"
      medicationLogs={[
        makeMedicationLog({
          id: 'med-linked',
          medicationName: 'Saline',
          sourceDailyLogId: 'log-1',
        }),
      ]}
      navigation={navigation as never}
    />,
  );

  fireEvent.press(screen.getByLabelText('Edit'));

  expect(navigation.navigate).toHaveBeenCalledWith('DailyLogForm', {
    mareId: 'mare-1',
    logId: 'log-1',
  });
});
