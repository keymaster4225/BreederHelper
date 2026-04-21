import { render } from '@testing-library/react-native';

import { TimelineTab } from './TimelineTab';

function createNavigation() {
  return {
    navigate: jest.fn(),
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
