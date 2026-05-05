import { fireEvent, render } from '@testing-library/react-native';

import type { DailyLog, MedicationLog } from '@/models/types';

import { TimelineTab } from './TimelineTab';

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

function makeMedicationLog(
  overrides: Partial<MedicationLog> & { id: string; date: string },
): MedicationLog {
  const { id, date, ...rest } = overrides;
  return {
    id,
    mareId: 'mare-1',
    date,
    time: '08:30',
    medicationName: 'Regumate',
    dose: null,
    route: null,
    notes: null,
    sourceDailyLogId: null,
    createdAt: '2026-04-23T08:30:00Z',
    updatedAt: '2026-04-23T08:30:00Z',
    ...rest,
  };
}

it('uses the mare gestation length for pregnancy timeline due dates', () => {
  const navigation = createNavigation();

  const screen = render(
    <TimelineTab
      mareId="mare-1"
      gestationLengthDays={320}
      dailyLogs={[]}
      breedingRecords={[
        {
          id: 'breeding-1',
          mareId: 'mare-1',
          stallionId: 'stallion-1',
          stallionName: 'Atlas',
          date: '2026-03-20',
          time: null,
          method: 'liveCover',
          notes: null,
          createdAt: '2026-03-20T00:00:00Z',
          updatedAt: '2026-03-20T00:00:00Z',
        },
      ]}
      pregnancyChecks={[
        {
          id: 'check-1',
          mareId: 'mare-1',
          breedingRecordId: 'breeding-1',
          date: '2026-04-04',
          result: 'positive',
          heartbeatDetected: true,
          notes: null,
          createdAt: '2026-04-04T00:00:00Z',
          updatedAt: '2026-04-04T00:00:00Z',
        },
      ]}
      foalingRecords={[]}
      medicationLogs={[]}
      foalByFoalingRecordId={{}}
      stallionNameById={{ 'stallion-1': 'Atlas' }}
      breedingById={{
        'breeding-1': {
          id: 'breeding-1',
          mareId: 'mare-1',
          stallionId: 'stallion-1',
          stallionName: 'Atlas',
          date: '2026-03-20',
          time: null,
          method: 'liveCover',
          notes: null,
          createdAt: '2026-03-20T00:00:00Z',
          updatedAt: '2026-03-20T00:00:00Z',
        },
      }}
      navigation={navigation as never}
    />,
  );

  expect(screen.getByText('02-03-2027')).toBeTruthy();
});

it('shows same-day daily log events with distinct time titles in newest-first order', () => {
  const navigation = createNavigation();

  const screen = render(
    <TimelineTab
      mareId="mare-1"
      gestationLengthDays={340}
      dailyLogs={[
        makeDailyLog({ id: 'log-morning-heat', date: '2026-04-23', time: '08:00', teasingScore: 5 }),
        makeDailyLog({ id: 'log-afternoon-ovulation', date: '2026-04-23', time: '16:00', ovulationDetected: true }),
      ]}
      breedingRecords={[]}
      pregnancyChecks={[]}
      foalingRecords={[]}
      medicationLogs={[]}
      foalByFoalingRecordId={{}}
      stallionNameById={{}}
      breedingById={{}}
      navigation={navigation as never}
    />,
  );

  expect(screen.getByText('2026-04-23 at 4:00 PM')).toBeTruthy();
  expect(screen.getByText('2026-04-23 at 8:00 AM')).toBeTruthy();

  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('2026-04-23 at 4:00 PM')).toBeLessThan(tree.indexOf('2026-04-23 at 8:00 AM'));
});

it('shows daily log event times in 24-hour format when selected', () => {
  useClockDisplayMode.mockReturnValue('24h');
  const navigation = createNavigation();

  const screen = render(
    <TimelineTab
      mareId="mare-1"
      gestationLengthDays={340}
      dailyLogs={[
        makeDailyLog({ id: 'log-morning-heat', date: '2026-04-23', time: '08:00', teasingScore: 5 }),
        makeDailyLog({ id: 'log-afternoon-ovulation', date: '2026-04-23', time: '16:00', ovulationDetected: true }),
      ]}
      breedingRecords={[]}
      pregnancyChecks={[]}
      foalingRecords={[]}
      medicationLogs={[]}
      foalByFoalingRecordId={{}}
      stallionNameById={{}}
      breedingById={{}}
      navigation={navigation as never}
    />,
  );

  expect(screen.getByText('2026-04-23 at 16:00')).toBeTruthy();
  expect(screen.getByText('2026-04-23 at 08:00')).toBeTruthy();
});

it('shows medication times in the selected clock format and orders same-day doses by time', () => {
  useClockDisplayMode.mockReturnValue('24h');
  const navigation = createNavigation();

  const screen = render(
    <TimelineTab
      mareId="mare-1"
      gestationLengthDays={340}
      dailyLogs={[]}
      breedingRecords={[]}
      pregnancyChecks={[]}
      foalingRecords={[]}
      medicationLogs={[
        makeMedicationLog({ id: 'med-morning', date: '2026-04-23', time: '08:00' }),
        makeMedicationLog({ id: 'med-evening', date: '2026-04-23', time: '18:00' }),
        makeMedicationLog({ id: 'med-legacy', date: '2026-04-23', time: null }),
      ]}
      foalByFoalingRecordId={{}}
      stallionNameById={{}}
      breedingById={{}}
      navigation={navigation as never}
    />,
  );

  expect(screen.getByText('2026-04-23 at 18:00')).toBeTruthy();
  expect(screen.getByText('2026-04-23 at 08:00')).toBeTruthy();
  expect(screen.getByText('2026-04-23')).toBeTruthy();

  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf('2026-04-23 at 18:00')).toBeLessThan(tree.indexOf('2026-04-23 at 08:00'));
  expect(tree.indexOf('2026-04-23 at 08:00')).toBeLessThan(tree.lastIndexOf('2026-04-23'));
});

it('opens breeding detail from the card body and edit form from the pencil', () => {
  const navigation = createNavigation();

  const screen = render(
    <TimelineTab
      mareId="mare-1"
      gestationLengthDays={340}
      dailyLogs={[]}
      breedingRecords={[
        {
          id: 'breeding-1',
          mareId: 'mare-1',
          stallionId: 'stallion-1',
          stallionName: 'Atlas',
          date: '2026-03-20',
          time: null,
          method: 'liveCover',
          notes: null,
          createdAt: '2026-03-20T00:00:00Z',
          updatedAt: '2026-03-20T00:00:00Z',
        },
      ]}
      pregnancyChecks={[]}
      foalingRecords={[]}
      medicationLogs={[]}
      foalByFoalingRecordId={{}}
      stallionNameById={{ 'stallion-1': 'Atlas' }}
      breedingById={{}}
      navigation={navigation as never}
    />,
  );

  fireEvent.press(screen.getByLabelText('Open breeding event from 2026-03-20'));
  expect(navigation.navigate).toHaveBeenCalledWith('BreedingEventDetail', {
    breedingRecordId: 'breeding-1',
  });

  fireEvent.press(screen.getByLabelText('Edit'));
  expect(navigation.navigate).toHaveBeenCalledWith('BreedingRecordForm', {
    mareId: 'mare-1',
    breedingRecordId: 'breeding-1',
  });
});

it('opens pregnancy check form from the timeline card body and pencil', () => {
  const navigation = createNavigation();

  const screen = render(
    <TimelineTab
      mareId="mare-1"
      gestationLengthDays={340}
      dailyLogs={[]}
      breedingRecords={[
        {
          id: 'breeding-1',
          mareId: 'mare-1',
          stallionId: 'stallion-1',
          stallionName: 'Atlas',
          date: '2026-03-20',
          time: null,
          method: 'liveCover',
          notes: null,
          createdAt: '2026-03-20T00:00:00Z',
          updatedAt: '2026-03-20T00:00:00Z',
        },
      ]}
      pregnancyChecks={[
        {
          id: 'check-1',
          mareId: 'mare-1',
          breedingRecordId: 'breeding-1',
          date: '2026-04-04',
          result: 'positive',
          heartbeatDetected: true,
          notes: null,
          createdAt: '2026-04-04T00:00:00Z',
          updatedAt: '2026-04-04T00:00:00Z',
        },
      ]}
      foalingRecords={[]}
      medicationLogs={[]}
      foalByFoalingRecordId={{}}
      stallionNameById={{ 'stallion-1': 'Atlas' }}
      breedingById={{
        'breeding-1': {
          id: 'breeding-1',
          mareId: 'mare-1',
          stallionId: 'stallion-1',
          stallionName: 'Atlas',
          date: '2026-03-20',
          time: null,
          method: 'liveCover',
          notes: null,
          createdAt: '2026-03-20T00:00:00Z',
          updatedAt: '2026-03-20T00:00:00Z',
        },
      }}
      navigation={navigation as never}
    />,
  );

  fireEvent.press(screen.getByLabelText('Open pregnancy check from 2026-04-04'));
  expect(navigation.navigate).toHaveBeenCalledWith('PregnancyCheckForm', {
    mareId: 'mare-1',
    pregnancyCheckId: 'check-1',
  });

  navigation.navigate.mockClear();
  fireEvent.press(screen.getAllByLabelText('Edit')[0]);
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenLastCalledWith('PregnancyCheckForm', {
    mareId: 'mare-1',
    pregnancyCheckId: 'check-1',
  });
});
