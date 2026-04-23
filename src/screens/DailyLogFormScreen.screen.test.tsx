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

function createNavigation() {
  return {
    navigate: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  };
}

function createWizardMock(overrides: Record<string, unknown> = {}) {
  return {
    isEdit: false,
    currentStepIndex: 0,
    currentStepTitle: 'Basics',
    date: '2026-04-21',
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
    errors: {
      basics: {},
      rightOvary: {},
      leftOvary: {},
      uterus: {},
    },
    today: new Date(),
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    setDate: jest.fn(),
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
  fireEvent.press(screen.getByText('Next'));

  expect(wizard.goNext).toHaveBeenCalledTimes(1);
});

it('renders review step actions and triggers save/delete callbacks', () => {
  const { screen, wizard } = renderScreen({
    currentStepIndex: 4,
    currentStepTitle: 'Review',
    isEdit: true,
  });

  expect(screen.getByText('Step 5 of 5')).toBeTruthy();
  expect(screen.getByText('Review')).toBeTruthy();
  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Delete'));

  expect(wizard.save).toHaveBeenCalledTimes(1);
  expect(wizard.requestDelete).toHaveBeenCalledTimes(1);
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
