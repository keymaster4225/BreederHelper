import { Alert } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { FrozenBatchFormScreen } from '@/screens/FrozenBatchFormScreen';

jest.mock('@/components/FormControls', () => {
  const { Text, TextInput, View } = require('react-native');
  const actual = jest.requireActual('@/components/FormControls');

  function FormField({
    label,
    required,
    error,
    children,
  }: {
    label: string;
    required?: boolean;
    error?: string | null;
    children: any;
  }): JSX.Element {
    return (
      <View testID={`field-${label}`}>
        <Text>
          {label}
          {required ? ' *' : ''}
        </Text>
        {children}
        {error ? <Text>{error}</Text> : null}
      </View>
    );
  }

  function FormTextInput(props: Record<string, unknown>): JSX.Element {
    return <TextInput testID={String(props.testID ?? 'form-text-input')} {...(props as any)} />;
  }

  function FormDateInput({
    value,
    onChange,
    placeholder = 'Select date',
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }): JSX.Element {
    return (
      <TextInput
        testID="form-date-input"
        value={value}
        placeholder={placeholder}
        onChangeText={onChange}
      />
    );
  }

  function FormSelectInput({
    value,
    onChange,
    placeholder = 'Select',
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }): JSX.Element {
    return (
      <TextInput
        testID="form-select-input"
        value={value}
        placeholder={placeholder}
        onChangeText={onChange}
      />
    );
  }

  return {
    ...actual,
    FormField,
    FormTextInput,
    FormDateInput,
    FormSelectInput,
  };
});

jest.mock('@/storage/repositories', () => ({
  getFrozenSemenBatch: jest.fn(),
  updateFrozenSemenBatch: jest.fn(),
  deleteFrozenSemenBatch: jest.fn(),
  getSemenCollectionById: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

function renderScreen() {
  const navigation = {
    goBack: jest.fn(),
    setOptions: jest.fn(),
    navigate: jest.fn(),
  };

  return {
    navigation,
    ...render(
      <FrozenBatchFormScreen
        navigation={navigation as never}
        route={{
          key: 'FrozenBatchForm',
          name: 'FrozenBatchForm',
          params: { stallionId: 'stallion-1', frozenBatchId: 'batch-1' },
        } as never}
      />,
    ),
  };
}

function getField(
  screen: ReturnType<typeof renderScreen>,
  label: string,
) {
  return screen.getByTestId(`field-${label}`);
}

function typeText(
  screen: ReturnType<typeof renderScreen>,
  label: string,
  value: string,
  testId = 'form-text-input',
) {
  fireEvent.changeText(within(getField(screen, label)).getByTestId(testId), value);
}

beforeEach(() => {
  jest.clearAllMocks();
  repositories.getFrozenSemenBatch.mockResolvedValue({
    id: 'batch-1',
    stallionId: 'stallion-1',
    collectionId: 'col-1',
    freezeDate: '2026-04-20',
    rawSemenVolumeUsedMl: 8,
    extender: 'BotuCrio',
    extenderOther: null,
    wasCentrifuged: false,
    centrifuge: {
      speedRpm: null,
      durationMin: null,
      cushionUsed: null,
      cushionType: null,
      resuspensionVolumeMl: null,
      notes: null,
    },
    strawCount: 16,
    strawsRemaining: 16,
    strawVolumeMl: 0.5,
    concentrationMillionsPerMl: 180,
    strawsPerDose: 2,
    strawColor: 'Blue',
    strawColorOther: null,
    strawLabel: 'LOT-A',
    postThawMotilityPercent: 60,
    longevityHours: 10,
    storageDetails: 'Tank A',
    notes: 'Initial note',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  });
  repositories.getSemenCollectionById.mockResolvedValue({
    id: 'col-1',
    stallionId: 'stallion-1',
    collectionDate: '2026-04-15',
  });
  repositories.updateFrozenSemenBatch.mockResolvedValue(undefined);
  repositories.deleteFrozenSemenBatch.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('loads existing batch data and saves updates', async () => {
  const screen = renderScreen();

  await waitFor(() => expect(screen.getByDisplayValue('2026-04-20')).toBeTruthy());
  expect(screen.getByDisplayValue('16')).toBeTruthy();

  typeText(screen, 'Straw Count', '24');
  typeText(screen, 'Notes', 'Updated notes');
  fireEvent.press(screen.getByText('Save Frozen Batch'));

  await waitFor(() =>
    expect(repositories.updateFrozenSemenBatch).toHaveBeenCalledWith(
      'batch-1',
      expect.objectContaining({
        strawCount: 24,
        notes: 'Updated notes',
      }),
    ),
  );
  expect(screen.navigation.goBack).toHaveBeenCalled();
});

it('deletes after confirm dialog action', async () => {
  const screen = renderScreen();
  await waitFor(() => expect(screen.getByText('Delete Frozen Batch')).toBeTruthy());

  fireEvent.press(screen.getByText('Delete Frozen Batch'));

  const confirmCall = (Alert.alert as jest.Mock).mock.calls.find(
    ([title]) => title === 'Delete Frozen Batch',
  );
  expect(confirmCall).toBeTruthy();

  const buttons = confirmCall?.[2] as Array<{ text?: string; onPress?: () => void }> | undefined;
  const deleteButton = buttons?.find((button) => button.text === 'Delete');
  expect(deleteButton?.onPress).toBeTruthy();

  deleteButton?.onPress?.();

  await waitFor(() => expect(repositories.deleteFrozenSemenBatch).toHaveBeenCalledWith('batch-1'));
  expect(screen.navigation.goBack).toHaveBeenCalled();
});

it('shows centrifuge card expanded for centrifuged batches and allows collapsing', async () => {
  repositories.getFrozenSemenBatch.mockResolvedValue({
    id: 'batch-2',
    stallionId: 'stallion-1',
    collectionId: 'col-1',
    freezeDate: '2026-04-20',
    rawSemenVolumeUsedMl: 8,
    extender: 'BotuCrio',
    extenderOther: null,
    wasCentrifuged: true,
    centrifuge: {
      speedRpm: 1200,
      durationMin: 12,
      cushionUsed: true,
      cushionType: 'EquiPure',
      resuspensionVolumeMl: 3,
      notes: null,
    },
    strawCount: 16,
    strawsRemaining: 16,
    strawVolumeMl: 0.5,
    concentrationMillionsPerMl: 180,
    strawsPerDose: 2,
    strawColor: 'Blue',
    strawColorOther: null,
    strawLabel: 'LOT-A',
    postThawMotilityPercent: 60,
    longevityHours: 10,
    storageDetails: 'Tank A',
    notes: 'Initial note',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  });

  const navigation = {
    goBack: jest.fn(),
    setOptions: jest.fn(),
    navigate: jest.fn(),
  };

  const screen = render(
    <FrozenBatchFormScreen
      navigation={navigation as never}
      route={{
        key: 'FrozenBatchForm',
        name: 'FrozenBatchForm',
        params: { stallionId: 'stallion-1', frozenBatchId: 'batch-2' },
      } as never}
    />,
  );

  await waitFor(() => expect(screen.getByTestId('centrifuge-settings-card')).toBeTruthy());
  expect(screen.getByTestId('field-Centrifuge Speed (RPM)')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Toggle centrifuge settings'));
  expect(screen.queryByTestId('field-Centrifuge Speed (RPM)')).toBeNull();
});
