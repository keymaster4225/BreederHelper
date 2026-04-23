import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createMare: jest.fn(),
  getMareById: jest.fn(),
  softDeleteMare: jest.fn(),
  updateMare: jest.fn(),
}));

jest.mock('@/utils/id', () => ({
  newId: jest.fn(() => 'new-mare-id'),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  createMare: jest.Mock;
  getMareById: jest.Mock;
  updateMare: jest.Mock;
};

import { useEditMareForm } from './useEditMareForm';

describe('useEditMareForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.getMareById.mockResolvedValue(null);
    repositories.createMare.mockResolvedValue(undefined);
    repositories.updateMare.mockResolvedValue(undefined);
  });

  it('passes isRecipient through the create payload', async () => {
    const onGoBack = jest.fn();
    const onDeleted = jest.fn();
    const setTitle = jest.fn();

    const { result } = renderHook(() =>
      useEditMareForm({
        onGoBack,
        onDeleted,
        setTitle,
      }),
    );

    act(() => {
      result.current.setName('Nova');
      result.current.setBreed('Warmblood');
      result.current.setIsRecipient(true);
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(repositories.createMare).toHaveBeenCalledWith({
      id: 'new-mare-id',
      name: 'Nova',
      breed: 'Warmblood',
      gestationLengthDays: 340,
      dateOfBirth: null,
      registrationNumber: null,
      isRecipient: true,
      notes: null,
    });
    expect(onGoBack).toHaveBeenCalled();
  });

  it('loads isRecipient on edit and passes it through the update payload', async () => {
    repositories.getMareById.mockResolvedValue({
      id: 'mare-1',
      name: 'Maple',
      breed: 'Quarter Horse',
      gestationLengthDays: 345,
      dateOfBirth: '2018-02-02',
      registrationNumber: null,
      isRecipient: true,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const onGoBack = jest.fn();
    const onDeleted = jest.fn();
    const setTitle = jest.fn();

    const { result } = renderHook(() =>
      useEditMareForm({
        mareId: 'mare-1',
        onGoBack,
        onDeleted,
        setTitle,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRecipient).toBe(true);

    act(() => {
      result.current.setIsRecipient(false);
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(repositories.updateMare).toHaveBeenCalledWith('mare-1', {
      name: 'Maple',
      breed: 'Quarter Horse',
      gestationLengthDays: 345,
      dateOfBirth: '2018-02-02',
      registrationNumber: null,
      isRecipient: false,
      notes: null,
    });
    expect(onGoBack).toHaveBeenCalled();
  });
});
