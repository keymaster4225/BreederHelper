import { fireEvent, render } from '@testing-library/react-native';

import type { DailyLog } from '@/models/types';

import { DailyLogsTab } from './DailyLogsTab';

jest.mock('@/hooks/useClockPreference', () => ({
  useClockDisplayMode: jest.fn(() => '12h'),
}));

const { useClockDisplayMode } = jest.requireMock('@/hooks/useClockPreference') as {
  useClockDisplayMode: jest.Mock;
};

function createNavigation() {
  return {
    navigate: jest.fn(),
  };
}

beforeEach(() => {
  useClockDisplayMode.mockReturnValue('12h');
});

function makeDailyLog(overrides: Partial<DailyLog> & { id: string; date: string }): DailyLog {
  const { id, date, ...rest } = overrides;

  return {
    id,
    mareId: 'mare-1',
    date,
    time: null,
    teasingScore: null,
    rightOvary: null,
    leftOvary: null,
    rightOvaryOvulation: null,
    rightOvaryFollicleState: null,
    rightOvaryFollicleMeasurementsMm: [],
    rightOvaryConsistency: null,
    rightOvaryStructures: [],
    leftOvaryOvulation: null,
    leftOvaryFollicleState: null,
    leftOvaryFollicleMeasurementsMm: [],
    leftOvaryConsistency: null,
    leftOvaryStructures: [],
    ovulationDetected: null,
    edema: null,
    uterineTone: null,
    uterineToneCategory: null,
    cervicalFirmness: null,
    dischargeObserved: null,
    dischargeNotes: null,
    uterineCysts: null,
    notes: null,
    createdAt: '2026-04-23T00:00:00Z',
    updatedAt: '2026-04-23T00:00:00Z',
    ...rest,
  };
}

it('groups same-day logs under one header and shows distinct time titles in newest-first order', () => {
  const screen = render(
    <DailyLogsTab
      mareId="mare-1"
      dailyLogs={[
        makeDailyLog({ id: 'log-morning', date: '2026-04-23', time: '08:00', teasingScore: 4 }),
        makeDailyLog({ id: 'log-afternoon', date: '2026-04-23', time: '16:00', ovulationDetected: true }),
        makeDailyLog({ id: 'log-previous', date: '2026-04-22', time: '09:30' }),
      ]}
      navigation={createNavigation() as never}
    />,
  );

  expect(screen.getAllByText('2026-04-23')).toHaveLength(1);
  expect(screen.getByText('2026-04-22')).toBeTruthy();
  expect(screen.getByText('4:00 PM')).toBeTruthy();
  expect(screen.getByText('8:00 AM')).toBeTruthy();

  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('4:00 PM')).toBeLessThan(tree.indexOf('8:00 AM'));
});

it('renders daily log times in 24-hour format when selected', () => {
  useClockDisplayMode.mockReturnValue('24h');

  const screen = render(
    <DailyLogsTab
      mareId="mare-1"
      dailyLogs={[
        makeDailyLog({ id: 'log-morning', date: '2026-04-23', time: '08:00' }),
        makeDailyLog({ id: 'log-afternoon', date: '2026-04-23', time: '16:00' }),
      ]}
      navigation={createNavigation() as never}
    />,
  );

  expect(screen.getByText('16:00')).toBeTruthy();
  expect(screen.getByText('08:00')).toBeTruthy();
});

it('renders structured ovary details in an expandable ovary row', () => {
  const screen = render(
    <DailyLogsTab
      mareId="mare-1"
      dailyLogs={[
        makeDailyLog({
          id: 'log-structured',
          date: '2026-04-23',
          rightOvaryOvulation: false,
          rightOvaryFollicleState: 'measured',
          rightOvaryFollicleMeasurementsMm: [34, 36],
          rightOvaryConsistency: 'firm',
          rightOvaryStructures: ['corpusLuteum', 'hemorrhagicAnovulatoryFollicle'],
        }),
      ]}
      navigation={createNavigation() as never}
    />,
  );

  expect(screen.getByText('Right ovary')).toBeTruthy();
  expect(screen.queryByText('34 mm, 36 mm')).toBeNull();
  expect(screen.queryByText('Follicles')).toBeNull();

  fireEvent.press(screen.getByLabelText('Show Right ovary details'));

  expect(screen.getByText('Follicles')).toBeTruthy();
  expect(screen.getByText('34 mm, 36 mm')).toBeTruthy();
  expect(screen.getByText('Consistency')).toBeTruthy();
  expect(screen.getByText('Firm')).toBeTruthy();
  expect(screen.getByText('Structures')).toBeTruthy();
  expect(screen.getByText('Corpus Luteum, Hemorrhagic Anovulatory Follicle')).toBeTruthy();
});

it('renders daily log thumbnails from hook-provided photo data and opens the viewer', () => {
  const navigation = createNavigation();
  const screen = render(
    <DailyLogsTab
      mareId="mare-1"
      dailyLogs={[
        makeDailyLog({ id: 'log-with-photo', date: '2026-04-23', time: '08:00' }),
      ]}
      attachmentPhotosByDailyLogId={{
        'log-with-photo': [
          {
            id: 'photo-1',
            thumbnailUri: 'file:///photo-assets/photo-1/thumbnail.jpg',
            masterUri: 'file:///photo-assets/photo-1/master.jpg',
          },
        ],
      }}
      navigation={navigation as never}
    />,
  );

  fireEvent.press(screen.getByLabelText('Open daily log photo 1'));

  expect(navigation.navigate).toHaveBeenCalledWith('PhotoViewer', {
    photos: [{ uri: 'file:///photo-assets/photo-1/master.jpg', title: '2026-04-23 photo' }],
    initialIndex: 0,
  });
});
