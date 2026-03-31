import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MedicationFormScreen } from '@/screens/MedicationFormScreen';

jest.mock('@/storage/repositories', () => ({
  getMedicationLogById: jest.fn(),
  createMedicationLog: jest.fn(),
  updateMedicationLog: jest.fn(),
  deleteMedicationLog: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

function renderScreen(params?: Record<string, unknown>) {
  const navigation = { goBack: jest.fn(), setOptions: jest.fn() };
  const route = {
    key: 'MedicationForm',
    name: 'MedicationForm',
    params: { mareId: 'mare-1', ...params },
  };

  return {
    navigation,
    ...render(<MedicationFormScreen navigation={navigation as never} route={route as never} />),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('supports create flow and custom medication path', async () => {
  repositories.createMedicationLog.mockResolvedValue(undefined);
  const screen = renderScreen();

  fireEvent.press(screen.getByText('Custom'));
  fireEvent.changeText(screen.getByPlaceholderText('Enter medication name'), 'Regumate');
  fireEvent.changeText(screen.getByPlaceholderText('e.g., 10 mL'), '10 mL');
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.createMedicationLog).toHaveBeenCalled());
  expect(repositories.createMedicationLog.mock.calls[0][0].medicationName).toBe('Regumate');
});

it('loads edit state and persists route deselection', async () => {
  repositories.getMedicationLogById.mockResolvedValue({
    id: 'med-1',
    mareId: 'mare-1',
    date: '2026-03-30',
    medicationName: 'Banamine',
    dose: '10 mL',
    route: 'oral',
    notes: 'Evening dose',
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  });
  repositories.updateMedicationLog.mockResolvedValue(undefined);

  const screen = renderScreen({ medicationLogId: 'med-1' });
  await waitFor(() => expect(screen.getByDisplayValue('10 mL')).toBeTruthy());

  fireEvent.press(screen.getByText('Oral'));
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.updateMedicationLog).toHaveBeenCalled());
  expect(repositories.updateMedicationLog.mock.calls[0][1].route).toBeNull();
});
