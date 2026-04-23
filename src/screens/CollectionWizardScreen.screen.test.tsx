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
    placeholder = 'Select',
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
  await waitFor(() => expect(screen.getByText(/Processing details/i)).toBeTruthy());
  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText(/Dose allocation/i)).toBeTruthy());
}

function openPicker(screen: ReturnType<typeof renderWizard>, label: string) {
  fireEvent.press(within(getField(screen, label)).getByRole('button'));
}

it('saves a collection with no allocation rows', async () => {
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
      rawVolumeMl: null,
      concentrationMillionsPerMl: null,
      progressiveMotilityPercent: null,
      targetMotileSpermMillionsPerDose: null,
      targetPostExtensionConcentrationMillionsPerMl: null,
      extenderType: null,
      notes: null,
    }),
    shippedRows: [],
    onFarmRows: [],
  });
  expect(screen.navigation.goBack).toHaveBeenCalled();
});

it('prefills shipped dose volumes from calculator targets', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  typeText(screen, 'Total Volume (mL)', '100');
  typeText(screen, 'Concentration (M/mL, raw)', '200');
  typeText(screen, 'Progressive Motility (%)', '50');
  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText(/Processing details/i)).toBeTruthy());

  typeText(screen, 'Target motile sperm / dose (M)', '500');
  typeText(screen, 'Target post-extension concentration (M motile/mL)', '100');

  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText(/Dose allocation/i)).toBeTruthy());

  fireEvent.press(screen.getByText('Add Shipment'));
  await waitFor(() =>
    expect(within(getField(screen, 'Dose Semen Volume (mL)')).getByTestId('form-text-input')).toBeTruthy(),
  );

  expect(
    within(getField(screen, 'Dose Semen Volume (mL)')).getByDisplayValue('5'),
  ).toBeTruthy();
  expect(
    within(getField(screen, 'Dose Extender Volume (mL)')).getByDisplayValue('0'),
  ).toBeTruthy();

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
  await waitFor(() => expect(screen.getByText('Shipped: Blue Sky Farm')).toBeTruthy());

  fireEvent.press(screen.getByText('Next'));
  await waitFor(() => expect(screen.getByText('Review')).toBeTruthy());
  fireEvent.press(screen.getByText('Save'));

  await waitFor(() => expect(repositories.createCollectionWithAllocations).toHaveBeenCalledTimes(1));
  expect(repositories.createCollectionWithAllocations).toHaveBeenCalledWith(
    expect.objectContaining({
      shippedRows: [
        expect.objectContaining({
          recipient: 'Blue Sky Farm',
          doseSemenVolumeMl: 5,
          doseExtenderVolumeMl: 0,
          doseCount: 2,
          eventDate: '2026-04-21',
        }),
      ],
    }),
  );
});

it('prevents selecting the same mare twice', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  await advanceToAllocationStep(screen);

  fireEvent.press(screen.getByText('Add On-Farm'));
  await waitFor(() => expect(within(getField(screen, 'Mare')).getByRole('button')).toBeTruthy());
  openPicker(screen, 'Mare');
  fireEvent.press(screen.getByText('Nova'));
  typeDate(screen, 'Breeding Date', '2026-04-21');
  fireEvent.press(screen.getByText('Save On-Farm Allocation'));
  await waitFor(() => expect(screen.getByText('On-Farm: Nova')).toBeTruthy());

  fireEvent.press(screen.getByText('Add On-Farm'));
  await waitFor(() => expect(within(getField(screen, 'Mare')).getByRole('button')).toBeTruthy());
  openPicker(screen, 'Mare');

  expect(screen.queryByText('Delta')).toBeTruthy();
  expect(screen.queryByText('Nova')).toBeNull();
  expect(screen.getByText('On-Farm: Nova')).toBeTruthy();
});

it('blocks moving past allocation step when semen volume exceeds total volume', async () => {
  const screen = renderWizard();

  typeDate(screen, 'Collection Date', '2026-04-21');
  typeText(screen, 'Total Volume (mL)', '5');
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
  typeText(screen, 'Dose Semen Volume (mL)', '3');
  typeText(screen, 'Dose Extender Volume (mL)', '1');
  typeText(screen, 'Dose Count', '2');
  fireEvent.press(screen.getByText('Save Shipment'));
  await waitFor(() => expect(screen.getByText('Shipped: Blue Sky Farm')).toBeTruthy());

  fireEvent.press(screen.getByText('Next'));

  await waitFor(() =>
    expect(
      screen.getByText(/Allocated semen volume exceeds collected volume/i),
    ).toBeTruthy(),
  );
  expect(screen.queryByText('Review')).toBeNull();
  expect(repositories.createCollectionWithAllocations).not.toHaveBeenCalled();
});
