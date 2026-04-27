import { fireEvent, render } from '@testing-library/react-native';

import { FormActionBar } from '@/components/FormActionBar';

it('renders and wires all provided form actions', () => {
  const onPrimaryPress = jest.fn();
  const onSecondaryPress = jest.fn();
  const onDestructivePress = jest.fn();

  const screen = render(
    <FormActionBar
      primaryLabel="Save"
      onPrimaryPress={onPrimaryPress}
      secondaryLabel="Save & Add Follow-up"
      onSecondaryPress={onSecondaryPress}
      destructiveLabel="Delete"
      onDestructivePress={onDestructivePress}
    />,
  );

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Save & Add Follow-up'));
  fireEvent.press(screen.getByText('Delete'));

  expect(onPrimaryPress).toHaveBeenCalledTimes(1);
  expect(onSecondaryPress).toHaveBeenCalledTimes(1);
  expect(onDestructivePress).toHaveBeenCalledTimes(1);
});

it('disables each action independently', () => {
  const onPrimaryPress = jest.fn();
  const onSecondaryPress = jest.fn();
  const onDestructivePress = jest.fn();

  const screen = render(
    <FormActionBar
      primaryLabel="Save"
      onPrimaryPress={onPrimaryPress}
      primaryDisabled
      secondaryLabel="Save & Add Follow-up"
      onSecondaryPress={onSecondaryPress}
      destructiveLabel="Delete"
      onDestructivePress={onDestructivePress}
      destructiveDisabled
    />,
  );

  fireEvent.press(screen.getByText('Save'));
  fireEvent.press(screen.getByText('Save & Add Follow-up'));
  fireEvent.press(screen.getByText('Delete'));

  expect(onPrimaryPress).not.toHaveBeenCalled();
  expect(onSecondaryPress).toHaveBeenCalledTimes(1);
  expect(onDestructivePress).not.toHaveBeenCalled();
});

it('omits optional actions unless both label and handler are provided', () => {
  const screen = render(
    <FormActionBar
      primaryLabel="Save"
      onPrimaryPress={jest.fn()}
      secondaryLabel="Save & Add Follow-up"
      destructiveLabel="Delete"
    />,
  );

  expect(screen.getByText('Save')).toBeTruthy();
  expect(screen.queryByText('Save & Add Follow-up')).toBeNull();
  expect(screen.queryByText('Delete')).toBeNull();
});
