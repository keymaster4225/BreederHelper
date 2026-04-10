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

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('loads an existing daily log and saves updates', async () => {
  const navigation = createNavigation();
  getDailyLogById.mockResolvedValue({
    id: 'log-1',
    mareId: 'mare-1',
    date: '2026-04-01',
    teasingScore: 3,
    rightOvary: 'no findings',
    leftOvary: 'no findings',
    ovulationDetected: false,
    edema: 2,
    uterineTone: null,
    uterineCysts: null,
    notes: 'steady',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  });
  updateDailyLog.mockResolvedValue(undefined);

  const screen = render(
    <DailyLogFormScreen
      navigation={navigation as never}
      route={{ key: 'DailyLogForm', name: 'DailyLogForm', params: { mareId: 'mare-1', logId: 'log-1' } } as never}
    />,
  );

  await waitFor(() => {
    expect(getDailyLogById).toHaveBeenCalledWith('log-1');
  });

  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => {
    expect(updateDailyLog).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        date: '2026-04-01',
      }),
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
