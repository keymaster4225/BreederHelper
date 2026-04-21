import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { CollectionWizardScreen } from '@/screens/CollectionWizardScreen';

jest.mock('@/components/FormControls', () => {
  const React = require('react');
  const { Modal, Pressable, ScrollView, Text, TextInput, View } = require('react-native');
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
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
      />
    );
  }

  function FormAutocompleteInput({
    value,
    onChangeText,
    placeholder,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
  }): JSX.Element {
    return (
      <TextInput
        testID="form-autocomplete-input"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
      />
    );
  }

  function FormPickerInput({
    value,
    onChange,
    options,
    placeholder = 'Select…',
    onShowAll,
    showAllLabel = 'Show all',
  }: {
    value: string;
    onChange: (value: string) => void;
    options: readonly { label: string; value: string }[];
    placeholder?: string;
    onShowAll?: () => void;
    showAllLabel?: string;
  }): JSX.Element {
    const [open, setOpen] = React.useState(false);
    const selectedLabel = options.find((option) => option.value === value)?.label ?? (value || null);

    return (
      <>
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
          <Text>{selectedLabel ?? placeholder}</Text>
        </Pressable>
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)}>
            <View>
              <ScrollView bounces={false}>
                {options.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Text>{option.label}</Text>
                  </Pressable>
                ))}
                {onShowAll ? (
                  <Pressable
                    onPress={() => {
                      onShowAll();
                      setOpen(false);
                    }}
                  >
                    <Text>{showAllLabel}</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </>
    );
  }

  return {
    ...actual,
    FormAutocompleteInput,
    FormDateInput,
    FormField,
    FormPickerInput,
    FormTextInput,
  };
});

jest.mock('@/storage/repositories', () => ({
  createCollectionWithAllocations: jest.fn(),
  listMares: jest.fn(),
}));

const repositories = jest.requireMock('@/storage/repositories') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  repositories.listMares.mockResolvedValue([
    { id: 'mare-1', name: 'Nova', createdAt: '', updatedAt: '' },
    { id: 'mare-2', name: 'Delta', createdAt: '', updatedAt: '' },
  ]);
  repositories.createCollectionWithAllocations.mockResolvedValue({
    collectionId: 'col-1',
    breedingRecordIds: [],
  });
});

function renderWizard() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  return {
    navigation,
    ...render(
      <CollectionWizardScreen
        navigation={navigation as never}
        route={{ key: 'CollectionCreateWizard', name: 'CollectionCreateWizard', params: { stallionId: 'st-1' } } as never}
      />,
    ),
  };
}

function getField(screen: ReturnType<typeof renderWizard>, label: string) {
  return screen.getByTestId(`field-${label}`);
}

function typeText(screen: ReturnType<typeof renderWizard>, label: string, value: string, testId = 'form-text-input') {
  fireEvent.changeText(within(getField(screen, label)).getByTestId(testId), value);
}

function typeDate(screen: ReturnType<typeof renderWizard>, label: string, value: string) {
  fireEvent.changeText(within(getField(screen, label)).getByTestId('form-date-input'), value);
}

function typeAutocomplete(screen: ReturnType<typeof renderWizard>, label: string, value: string) {
  fireEvent.changeText(within(getField(screen, label)).getByTestId('form-autocomplete-input'), value);
}

async function advanceToAllocationStep(screen: ReturnType<typeof renderWizard>) {
  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText('Processing details')).toBeTruthy());
  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText('Dose allocation')).toBeTruthy());
}

async function waitForOnFarmButtonEnabled(screen: ReturnType<typeof renderWizard>) {
  await waitFor(() => {
    expect(screen.getByText('Add On-Farm').parent?.props.disabled).toBeFalsy();
  });
}

function openPicker(screen: ReturnType<typeof renderWizard>, label: string) {
  fireEvent.press(within(getField(screen, label)).getByRole('button'));
}

it('saves a collection with no allocations', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  await advanceToAllocationStep(screen);

  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText('Review')).toBeTruthy());

  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.createCollectionWithAllocations).toHaveBeenCalledTimes(1));
  expect(repositories.createCollectionWithAllocations).toHaveBeenCalledWith({
    collection: expect.objectContaining({
      stallionId: 'st-1',
      collectionDate: '2026-04-21',
      doseCount: null,
      rawVolumeMl: null,
      totalVolumeMl: null,
      extenderVolumeMl: null,
      extenderType: null,
      concentrationMillionsPerMl: null,
      progressiveMotilityPercent: null,
      doseSizeMillions: null,
      notes: null,
    }),
    shippedRows: [],
    onFarmRows: [],
  });
  expect(screen.navigation.goBack).toHaveBeenCalled();
});

it('saves mixed shipped and on-farm allocations', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  typeText(screen, 'Dose Count', '3');
  await advanceToAllocationStep(screen);
  await waitForOnFarmButtonEnabled(screen);

  fireEvent.press(screen.getByText('Add Shipment'));
  typeText(screen, 'Recipient Name', 'Blue Sky Farm');
  typeText(screen, 'Recipient Phone', '555-111-2222');
  typeText(screen, 'Recipient Street', '123 Main St');
  typeText(screen, 'Recipient City', 'Lexington');
  typeText(screen, 'Recipient State', 'KY');
  typeText(screen, 'Recipient ZIP', '40511');
  typeAutocomplete(screen, 'Carrier / Service', 'FedEx');
  typeAutocomplete(screen, 'Container Type', 'Dry Shipper');
  typeDate(screen, 'Ship Date', '2026-04-21');
  typeText(screen, 'Dose Count', '1');
  fireEvent.press(screen.getByText('Save Shipment'));
  await waitFor(() => expect(screen.getByText('Blue Sky Farm')).toBeTruthy());

  fireEvent.press(screen.getByText('Add On-Farm'));
  await waitFor(() => expect(within(getField(screen, 'Mare')).getByRole('button')).toBeTruthy());
  openPicker(screen, 'Mare');
  fireEvent.press(screen.getByText('Nova'));
  typeDate(screen, 'Breeding Date', '2026-04-21');
  typeText(screen, 'Dose Count', '2');
  fireEvent.press(screen.getByText('Save On-Farm Allocation'));
  await waitFor(() => expect(screen.getByText('Nova')).toBeTruthy());

  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText('Review')).toBeTruthy());

  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.createCollectionWithAllocations).toHaveBeenCalledTimes(1));
  expect(repositories.createCollectionWithAllocations).toHaveBeenCalledWith({
    collection: expect.objectContaining({
      stallionId: 'st-1',
      collectionDate: '2026-04-21',
      doseCount: 3,
    }),
    shippedRows: [
      expect.objectContaining({
        recipient: 'Blue Sky Farm',
        doseCount: 1,
        eventDate: '2026-04-21',
      }),
    ],
    onFarmRows: [
      expect.objectContaining({
        mareId: 'mare-1',
        doseCount: 2,
        eventDate: '2026-04-21',
      }),
    ],
  });
  expect(screen.navigation.goBack).toHaveBeenCalled();
});

it('prevents selecting the same mare twice', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  await advanceToAllocationStep(screen);
  await waitForOnFarmButtonEnabled(screen);

  fireEvent.press(screen.getByText('Add On-Farm'));
  openPicker(screen, 'Mare');
  fireEvent.press(screen.getByText('Nova'));
  typeDate(screen, 'Breeding Date', '2026-04-21');
  typeText(screen, 'Dose Count', '1');
  fireEvent.press(screen.getByText('Save On-Farm Allocation'));
  await waitFor(() => expect(screen.getByText('Nova')).toBeTruthy());

  fireEvent.press(screen.getByText('Add On-Farm'));
  await waitFor(() => expect(within(getField(screen, 'Mare')).getByRole('button')).toBeTruthy());
  openPicker(screen, 'Mare');

  expect(screen.getAllByText('Nova')).toHaveLength(1);
  expect(screen.getByText('Delta')).toBeTruthy();
});

it('blocks save when allocations exceed the dose count', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  typeText(screen, 'Dose Count', '1');
  await advanceToAllocationStep(screen);

  fireEvent.press(screen.getByText('Add Shipment'));
  typeText(screen, 'Recipient Name', 'Blue Sky Farm');
  typeText(screen, 'Recipient Phone', '555-111-2222');
  typeText(screen, 'Recipient Street', '123 Main St');
  typeText(screen, 'Recipient City', 'Lexington');
  typeText(screen, 'Recipient State', 'KY');
  typeText(screen, 'Recipient ZIP', '40511');
  typeAutocomplete(screen, 'Carrier / Service', 'FedEx');
  typeAutocomplete(screen, 'Container Type', 'Dry Shipper');
  typeDate(screen, 'Ship Date', '2026-04-21');
  typeText(screen, 'Dose Count', '2');
  fireEvent.press(screen.getByText('Save Shipment'));
  await waitFor(() => expect(screen.getByText('Blue Sky Farm')).toBeTruthy());

  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText('Dose allocation')).toBeTruthy());
  expect(screen.getByText('Allocated doses cannot exceed the collection dose count.')).toBeTruthy();
  expect(repositories.createCollectionWithAllocations).not.toHaveBeenCalled();
});
