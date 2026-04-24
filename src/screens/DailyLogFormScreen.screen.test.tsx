import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/components/Buttons', () => {
  const { Text } = require('react-native');

  function buttonFactory(testId: string) {
    return ({
      label,
      onPress,
      disabled,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
    }): JSX.Element => (
      <Text testID={testId} onPress={disabled ? undefined : onPress}>
        {label}
      </Text>
    );
  }

  return {
    PrimaryButton: buttonFactory('primary-button'),
    SecondaryButton: buttonFactory('secondary-button'),
    DeleteButton: buttonFactory('delete-button'),
  };
});

jest.mock('@/hooks/useDailyLogWizard', () => {
  const actual = jest.requireActual('@/hooks/useDailyLogWizard');
  return {
    ...actual,
    useDailyLogWizard: jest.fn(),
  };
});

const { useDailyLogWizard } = jest.requireMock('@/hooks/useDailyLogWizard') as {
  useDailyLogWizard: jest.Mock;
};
const { DailyLogFormScreen } = require('@/screens/DailyLogFormScreen') as typeof import('@/screens/DailyLogFormScreen');

type BeforeRemoveEvent = { preventDefault: jest.Mock };
type BeforeRemoveListener = (event: BeforeRemoveEvent) => void;

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn((_eventName: string, _listener: BeforeRemoveListener) => jest.fn()),
  };
}

function createWizardMock(overrides: Record<string, unknown> = {}) {
  const steps = [
    { id: 'basics', title: 'Basics' },
    { id: 'rightOvary', title: 'Right Ovary' },
    { id: 'leftOvary', title: 'Left Ovary' },
    { id: 'uterus', title: 'Uterus' },
    { id: 'review', title: 'Review' },
  ];
  const currentStepIndex =
    typeof overrides.currentStepIndex === 'number' ? overrides.currentStepIndex : 0;
  const currentStep = steps[currentStepIndex] ?? steps[0];

  return {
    isEdit: false,
    currentStepIndex,
    currentStepId: currentStep.id,
    currentStepTitle: currentStep.title,
    steps,
    date: '2026-04-21',
    time: '08:30',
    teasingScore: '',
    rightOvary: {
      ovulation: null,
      follicleState: null,
      follicleMeasurements: [],
      consistency: null,
      structures: [],
    },
    leftOvary: {
      ovulation: null,
      follicleState: null,
      follicleMeasurements: [],
      consistency: null,
      structures: [],
    },
    uterus: {
      edema: '',
      uterineToneCategory: null,
      cervicalFirmness: null,
      dischargeObserved: null,
      dischargeNotes: '',
      uterineCysts: '',
      fluidPockets: [],
    },
    notes: '',
    legacyNotes: {
      rightOvary: null,
      leftOvary: null,
      uterineTone: null,
    },
    legacyOvulationDetected: null,
    ovulationSource: 'structured',
    isTimeClearable: false,
    errors: {
      basics: {},
      rightOvary: {},
      leftOvary: {},
      uterus: {},
      flush: {},
    },
    flushDecision: null,
    flush: {
      baseSolution: '',
      totalVolumeMl: '',
      notes: '',
      products: [{ clientId: 'product-1', productName: 'Saline', dose: '', notes: '' }],
    },
    today: new Date(),
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    setDate: jest.fn(),
    setTime: jest.fn(),
    setTeasingScore: jest.fn(),
    setNotes: jest.fn(),
    setOvaryOvulation: jest.fn(),
    setOvaryFollicleState: jest.fn(),
    setOvaryFollicleSize: jest.fn(),
    setOvaryConsistency: jest.fn(),
    toggleOvaryStructure: jest.fn(),
    addOvaryMeasurement: jest.fn(),
    updateOvaryMeasurement: jest.fn(),
    removeOvaryMeasurement: jest.fn(),
    setEdema: jest.fn(),
    setUterineToneCategory: jest.fn(),
    setCervicalFirmness: jest.fn(),
    setDischargeObserved: jest.fn(),
    setDischargeNotes: jest.fn(),
    setUterineCysts: jest.fn(),
    upsertFluidPocket: jest.fn(),
    removeFluidPocket: jest.fn(),
    setFlushDecision: jest.fn(),
    setFlushBaseSolution: jest.fn(),
    setFlushTotalVolumeMl: jest.fn(),
    setFlushNotes: jest.fn(),
    addFlushProduct: jest.fn(),
    updateFlushProduct: jest.fn(),
    removeFlushProduct: jest.fn(),
    goNext: jest.fn(),
    goBack: jest.fn(),
    goToStep: jest.fn(),
    save: jest.fn(async () => undefined),
    requestDelete: jest.fn(),
    ...overrides,
  };
}

function renderScreen(overrides: Record<string, unknown> = {}) {
  const navigation = createNavigation();
  const wizard = createWizardMock(overrides);
  useDailyLogWizard.mockReturnValue(wizard);

  const screen = render(
    <DailyLogFormScreen
      navigation={navigation as never}
      route={{ key: 'DailyLogForm', name: 'DailyLogForm', params: { mareId: 'mare-1', logId: 'log-1' } } as never}
    />,
  );

  return { navigation, screen, wizard };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders basics step and advances with Next', () => {
  const { screen, wizard } = renderScreen({
    currentStepIndex: 0,
    currentStepTitle: 'Basics',
    isEdit: false,
  });

  expect(screen.getByText('Step 1 of 5')).toBeTruthy();
  expect(screen.getByText('Basics')).toBeTruthy();
  expect(screen.getByText('Time *')).toBeTruthy();
  expect(screen.getByText('8:30 AM')).toBeTruthy();
  fireEvent.press(screen.getByText('Next'));

  expect(wizard.goNext).toHaveBeenCalledTimes(1);
});

it('renders review step actions and triggers save/delete callbacks', () => {
  const { screen, wizard } = renderScreen({
    currentStepIndex: 4,
    currentStepTitle: 'Review',
    isEdit: true,
    time: '14:05',
  });

  expect(screen.getByText('Step 5 of 5')).toBeTruthy();
  expect(screen.getByText('Review')).toBeTruthy();
  expect(screen.getByText(/Time: 2:05 PM/)).toBeTruthy();
  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Delete'));

  expect(wizard.save).toHaveBeenCalledTimes(1);
  expect(wizard.requestDelete).toHaveBeenCalledTimes(1);
});

it('shows an inline time error from the hook on the basics step', () => {
  const { screen } = renderScreen({
    currentStepIndex: 0,
    currentStepTitle: 'Basics',
    errors: {
      basics: {
        time: 'A daily log already exists for this mare at that date and time.',
      },
      rightOvary: {},
      leftOvary: {},
      uterus: {},
    },
  });

  expect(
    screen.getByText('A daily log already exists for this mare at that date and time.'),
  ).toBeTruthy();
});

it('passes mareId and logId through the hook args', () => {
  renderScreen();

  expect(useDailyLogWizard).toHaveBeenCalledWith(
    expect.objectContaining({
      mareId: 'mare-1',
      logId: 'log-1',
      onGoBack: expect.any(Function),
      setTitle: expect.any(Function),
    }),
  );
});

it('uses wizard back instead of leaving the screen when stack back is pressed on the flush step', () => {
  const { navigation, wizard } = renderScreen({
    currentStepIndex: 4,
    currentStepId: 'flush',
    currentStepTitle: 'Flush',
    steps: [
      { id: 'basics', title: 'Basics' },
      { id: 'rightOvary', title: 'Right Ovary' },
      { id: 'leftOvary', title: 'Left Ovary' },
      { id: 'uterus', title: 'Uterus' },
      { id: 'flush', title: 'Flush' },
      { id: 'review', title: 'Review' },
    ],
  });
  const beforeRemoveCall = navigation.addListener.mock.calls.find(
    ([eventName]) => eventName === 'beforeRemove',
  );
  expect(beforeRemoveCall).toBeTruthy();
  if (!beforeRemoveCall) {
    throw new Error('Expected DailyLogFormScreen to register a beforeRemove listener.');
  }

  const event: BeforeRemoveEvent = { preventDefault: jest.fn() };
  const beforeRemove = beforeRemoveCall[1];
  beforeRemove(event);

  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(wizard.goBack).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('allows saved daily logs to leave the screen from later wizard steps', () => {
  const { navigation, wizard } = renderScreen({
    currentStepIndex: 4,
    currentStepId: 'review',
    currentStepTitle: 'Review',
  });
  const hookArgs = useDailyLogWizard.mock.calls[0]?.[0] as { onGoBack: () => void };
  const beforeRemoveCall = navigation.addListener.mock.calls.find(
    ([eventName]) => eventName === 'beforeRemove',
  );
  if (!beforeRemoveCall) {
    throw new Error('Expected DailyLogFormScreen to register a beforeRemove listener.');
  }

  hookArgs.onGoBack();
  const event: BeforeRemoveEvent = { preventDefault: jest.fn() };
  const beforeRemove = beforeRemoveCall[1];
  beforeRemove(event);

  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(wizard.goBack).not.toHaveBeenCalled();
});
