import { Alert } from 'react-native';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { FrozenBatchWizardScreen } from '@/screens/FrozenBatchWizardScreen';

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
  createFrozenSemenBatch: jest.fn(),
  getSemenCollectionById: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

function renderScreen(params: { stallionId: string; collectionId?: string } = { stallionId: 'stallion-1' }) {
  const navigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };

  return {
    navigation,
    ...render(
      <FrozenBatchWizardScreen
        navigation={navigation as never}
        route={{
          key: 'FrozenBatchCreateWizard',
          name: 'FrozenBatchCreateWizard',
          params,
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

function typeDate(screen: ReturnType<typeof renderScreen>, label: string, value: string) {
  fireEvent.changeText(within(getField(screen, label)).getByTestId('form-date-input'), value);
}

async function advanceToFinalStep(screen: ReturnType<typeof renderScreen>) {
  fireEvent.press(screen.getByText('Next'));
  await waitFor(() =>
    expect(screen.getAllByText('Quality').length).toBeGreaterThan(0),
  );

  fireEvent.press(screen.getByText('Next'));
  await waitFor(() =>
    expect(screen.getAllByText('Storage & Notes').length).toBeGreaterThan(0),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  repositories.createFrozenSemenBatch.mockResolvedValue({
    id: 'batch-1',
  });
  repositories.getSemenCollectionById.mockResolvedValue({
    id: 'col-1',
    stallionId: 'stallion-1',
    collectionDate: '2026-04-15',
  });
  jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('saves the wizard happy path', async () => {
  const screen = renderScreen();

  typeDate(screen, 'Freeze Date', '2026-04-22');
  fireEvent.press(screen.getByText('Next'));

  await waitFor(() =>
    expect(screen.getAllByText('Straws & Extender').length).toBeGreaterThan(0),
  );
  typeText(screen, 'Straw Count', '20');
  typeText(screen, 'Straw Volume (mL)', '0.5');
  typeText(screen, 'Concentration (M/mL)', '200');

  expect(screen.getByText('Sperm per Straw (M)')).toBeTruthy();
  expect(screen.getByText('100.00 M')).toBeTruthy();

  await advanceToFinalStep(screen);
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.createFrozenSemenBatch).toHaveBeenCalledTimes(1));
  expect(repositories.createFrozenSemenBatch).toHaveBeenCalledWith(
    expect.objectContaining({
      stallionId: 'stallion-1',
      collectionId: null,
      freezeDate: '2026-04-22',
      strawCount: 20,
      strawVolumeMl: 0.5,
    }),
  );
  expect(screen.navigation.goBack).toHaveBeenCalled();
});

it('shows centrifuge fields when centrifuge is toggled on', () => {
  const screen = renderScreen();

  expect(screen.queryByTestId('field-Centrifuge Speed (RPM)')).toBeNull();

  fireEvent.press(within(getField(screen, 'Was centrifuged?')).getByRole('checkbox'));

  expect(screen.getByTestId('field-Centrifuge Speed (RPM)')).toBeTruthy();
  expect(screen.getByTestId('field-Cushion Used?')).toBeTruthy();
});

it('shows save errors when repository save rejects', async () => {
  repositories.createFrozenSemenBatch.mockRejectedValue(new Error('Allocation cap exceeded.'));
  const screen = renderScreen();

  typeDate(screen, 'Freeze Date', '2026-04-22');
  fireEvent.press(screen.getByText('Next'));
  await waitFor(() =>
    expect(screen.getAllByText('Straws & Extender').length).toBeGreaterThan(0),
  );
  typeText(screen, 'Straw Count', '10');
  typeText(screen, 'Straw Volume (mL)', '0.5');

  await advanceToFinalStep(screen);
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith('Save error', 'Allocation cap exceeded.'),
  );
  expect(screen.navigation.goBack).not.toHaveBeenCalled();
});
