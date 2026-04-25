import { fireEvent, render } from '@testing-library/react-native';

import { BreedingTab } from './BreedingTab';

function createNavigation() {
  return {
    navigate: jest.fn(),
  };
}

it('opens breeding detail from the card body and edit form from the pencil', () => {
  const navigation = createNavigation();
  const screen = render(
    <BreedingTab
      mareId="mare-1"
      breedingRecords={[
        {
          id: 'breeding-1',
          mareId: 'mare-1',
          stallionId: 'stallion-1',
          stallionName: null,
          collectionId: null,
          date: '2026-04-01',
          method: 'freshAI',
          notes: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ]}
      stallionNameById={{ 'stallion-1': 'Atlas' }}
      navigation={navigation as never}
    />,
  );

  fireEvent.press(screen.getByLabelText('Open breeding event from 2026-04-01'));
  expect(navigation.navigate).toHaveBeenCalledWith('BreedingEventDetail', {
    breedingRecordId: 'breeding-1',
  });

  fireEvent.press(screen.getByLabelText('Edit'));
  expect(navigation.navigate).toHaveBeenCalledWith('BreedingRecordForm', {
    mareId: 'mare-1',
    breedingRecordId: 'breeding-1',
  });
});
