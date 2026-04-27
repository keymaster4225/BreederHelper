import { renderHook } from '@testing-library/react-native';

jest.mock('@/storage/repositories', () => ({
  createMedicationLog: jest.fn(),
  deleteMedicationLog: jest.fn(),
  getMedicationLogById: jest.fn(),
  updateMedicationLog: jest.fn(),
}));

import { useMedicationForm } from './useMedicationForm';

describe('useMedicationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a task-provided default date in create mode', () => {
    const { result } = renderHook(() =>
      useMedicationForm({
        mareId: 'mare-1',
        taskId: 'task-1',
        defaultDate: '2026-05-04',
        onGoBack: jest.fn(),
        setTitle: jest.fn(),
      }),
    );

    expect(result.current.date).toBe('2026-05-04');
  });
});
