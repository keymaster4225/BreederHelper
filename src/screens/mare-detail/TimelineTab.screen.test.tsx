import { render } from '@testing-library/react-native';

import type { DailyLog } from '@/models/types';

import { TimelineTab } from './TimelineTab';

function createNavigation() {
  return {
    navigate: jest.fn(),
  };
}

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
