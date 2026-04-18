import { render, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const mockReact = require('react');
  return {
    ...actual,
    useFocusEffect: (effect: () => void) => {
      mockReact.useEffect(() => {
        effect();
      }, [effect]);
    },
  };
});

jest.mock('react-native-calendars', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Calendar: jest.fn(({ renderArrow }: { renderArrow?: (direction: 'left' | 'right') => React.ReactNode }) =>
      mockReact.createElement(
        View,
        null,
        renderArrow
          ? [
              mockReact.createElement(View, { key: 'left-arrow' }, renderArrow('left')),
              mockReact.createElement(View, { key: 'right-arrow' }, renderArrow('right')),
            ]
          : null,
      ),
    ),
  };
});

jest.mock('@/screens/mare-detail/TimelineTab', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    TimelineTab: () => mockReact.createElement(View),
  };
});

jest.mock('@/storage/repositories', () => ({
  listDailyLogsByMare: jest.fn(),
  listBreedingRecordsByMare: jest.fn(),
  listPregnancyChecksByMare: jest.fn(),
  listFoalingRecordsByMare: jest.fn(),
  listFoalsByMare: jest.fn(),
  listStallions: jest.fn(),
  listMedicationLogsByMare: jest.fn(),
}));

const { MareCalendarScreen } = require('@/screens/MareCalendarScreen') as typeof import('@/screens/MareCalendarScreen');
const { Calendar } = jest.requireMock('react-native-calendars') as {
  Calendar: jest.Mock;
};
const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  repositories.listDailyLogsByMare.mockResolvedValue([]);
  repositories.listBreedingRecordsByMare.mockResolvedValue([]);
  repositories.listPregnancyChecksByMare.mockResolvedValue([]);
  repositories.listFoalingRecordsByMare.mockResolvedValue([]);
  repositories.listFoalsByMare.mockResolvedValue([]);
  repositories.listStallions.mockResolvedValue([]);
  repositories.listMedicationLogsByMare.mockResolvedValue([]);
});

it('renders custom calendar arrows instead of library asset arrows', async () => {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() };
  const screen = render(
    <MareCalendarScreen
      navigation={navigation as never}
      route={{ key: 'MareCalendar', name: 'MareCalendar', params: { mareId: 'mare-1' } } as never}
    />,
  );

  await waitFor(() => expect(Calendar).toHaveBeenCalled());

  expect(screen.getByText('chevron-left')).toBeTruthy();
  expect(screen.getByText('chevron-right')).toBeTruthy();
  expect(Calendar.mock.calls[0][0].renderArrow).toEqual(expect.any(Function));
});
