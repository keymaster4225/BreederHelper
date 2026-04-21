import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createDailyLog: jest.fn(),
  deleteDailyLog: jest.fn(),
  getDailyLogById: jest.fn(),
  updateDailyLog: jest.fn(),
}));

const { DailyLogFormScreen } = require('@/screens/DailyLogFormScreen') as typeof import('@/screens/DailyLogFormScreen');
const { getDailyLogById, updateDailyLog } = jest.requireMock('@/storage/repositories') as {
  getDailyLogById: jest.Mock;
  updateDailyLog: jest.Mock;
};

const BASE_LOG = {
  id: 'log-1',
  mareId: 'mare-1',
  date: '2026-04-01',
  teasingScore: 3,
  rightOvary: 'no findings',
  leftOvary: 'no findings',
  edema: 2,
  uterineTone: null,
  uterineCysts: null,
  notes: 'steady',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

function renderEditScreen(ovulationDetected: boolean | null) {
  const navigation = createNavigation();

  getDailyLogById.mockResolvedValue({
    ...BASE_LOG,
    ovulationDetected,
  });
  updateDailyLog.mockResolvedValue(undefined);

  const screen = render(
    <DailyLogFormScreen
      navigation={navigation as never}
      route={{ key: 'DailyLogForm', name: 'DailyLogForm', params: { mareId: 'mare-1', logId: 'log-1' } } as never}
    />,
  );

  return { navigation, screen };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('preserves unknown ovulation when editing a null daily log row', async () => {
  const { navigation, screen } = renderEditScreen(null);

  await waitFor(() => {
    expect(getDailyLogById).toHaveBeenCalledWith('log-1');
  });
  await screen.findByText('Unknown');

  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateDailyLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        date: '2026-04-01',
        ovulationDetected: null,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

it.each([
  { label: 'no', ovulationDetected: false },
  { label: 'yes', ovulationDetected: true },
])('preserves existing $label ovulation state when editing an existing row', async ({ ovulationDetected }) => {
  const { navigation, screen } = renderEditScreen(ovulationDetected);

  await waitFor(() => {
    expect(getDailyLogById).toHaveBeenCalledWith('log-1');
  });
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateDailyLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        date: '2026-04-01',
        ovulationDetected,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

it('saves explicit no when selected in the tri-state ovulation control', async () => {
  const { navigation, screen } = renderEditScreen(null);

  await waitFor(() => {
    expect(getDailyLogById).toHaveBeenCalledWith('log-1');
  });
  await screen.findByText('No');

  fireEvent.press(screen.getByText('No'));
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateDailyLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        date: '2026-04-01',
        ovulationDetected: false,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

it('saves explicit yes when selected in the tri-state ovulation control', async () => {
  const { navigation, screen } = renderEditScreen(null);

  await waitFor(() => {
    expect(getDailyLogById).toHaveBeenCalledWith('log-1');
  });
  await screen.findByText('Yes');

  fireEvent.press(screen.getByText('Yes'));
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateDailyLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        date: '2026-04-01',
        ovulationDetected: true,
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
