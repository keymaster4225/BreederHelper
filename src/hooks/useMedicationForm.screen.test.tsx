import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  completeTaskFromRecord: jest.fn(),
  createMedicationLog: jest.fn(),
  deleteMedicationLog: jest.fn(),
  getMedicationLogById: jest.fn(),
  updateMedicationLog: jest.fn(),
}));

jest.mock('@/utils/id', () => ({
  newId: jest.fn(() => 'new-med-log-id'),
}));

const repositories = jest.requireMock('@/storage/repositories') as {
  completeTaskFromRecord: jest.Mock;
  createMedicationLog: jest.Mock;
  deleteMedicationLog: jest.Mock;
  getMedicationLogById: jest.Mock;
  updateMedicationLog: jest.Mock;
};

import { useMedicationForm } from './useMedicationForm';

describe('useMedicationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.completeTaskFromRecord.mockResolvedValue(undefined);
    repositories.createMedicationLog.mockResolvedValue(undefined);
    repositories.deleteMedicationLog.mockResolvedValue(undefined);
    repositories.getMedicationLogById.mockResolvedValue(null);
    repositories.updateMedicationLog.mockResolvedValue(undefined);
  });

  it('uses a task-provided default date in create mode', () => {
    const { result } = renderHook(() =>
      useMedicationForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '1970-01-01',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    expect(result.current.date).toBe('1970-01-01');
  });

  it('completes a linked task after a successful create save', async () => {
    const onGoBack = jest.fn();
    const { result } = renderHook(() =>
      useMedicationForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '1970-01-01',
        onGoBack,
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setSelectedMed('custom');
      result.current.setCustomMedName('Regu-Mate');
    });

    await waitFor(() => {
      expect(result.current.selectedMed).toBe('custom');
      expect(result.current.customMedName).toBe('Regu-Mate');
    });

    await act(async () => {
      await result.current.onSave();
    });

    expect(repositories.createMedicationLog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-med-log-id', mareId: 'mare-1' }),
    );
    expect(repositories.completeTaskFromRecord).toHaveBeenCalledWith(
      'task-1',
      'medicationLog',
      'new-med-log-id',
    );
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens a medication follow-up task after a successful save-and-follow-up', async () => {
    const onGoBack = jest.fn();
    const onAddFollowUpTask = jest.fn();
    const { result } = renderHook(() =>
      useMedicationForm({
        mareId: 'mare-1',
        defaultDate: '1970-01-01',
        onGoBack,
        onAddFollowUpTask,
        setTitle: jest.fn(),
      }),
    );

    act(() => {
      result.current.setSelectedMed('custom');
      result.current.setCustomMedName('Regu-Mate');
    });

    await waitFor(() => {
      expect(result.current.selectedMed).toBe('custom');
      expect(result.current.customMedName).toBe('Regu-Mate');
    });

    await act(async () => {
      await result.current.onSaveAndAddFollowUp();
    });

    expect(repositories.createMedicationLog).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-med-log-id', mareId: 'mare-1' }),
    );
    expect(onAddFollowUpTask).toHaveBeenCalledWith({
      mareId: 'mare-1',
      taskType: 'medication',
      sourceType: 'medicationLog',
      sourceRecordId: 'new-med-log-id',
      sourceReason: 'manualFollowUp',
    });
    expect(onGoBack).not.toHaveBeenCalled();
  });
});
