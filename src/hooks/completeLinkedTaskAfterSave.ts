import { Alert } from 'react-native';

import type { TaskSourceType } from '@/models/types';
import { completeTaskFromRecord } from '@/storage/repositories';

type CompleteLinkedTaskAfterSaveArgs = {
  readonly taskId?: string;
  readonly completedRecordType: Exclude<TaskSourceType, 'manual'>;
  readonly completedRecordId: string;
  readonly onCompletedOrSkipped: () => void;
};

export async function completeLinkedTaskAfterSave({
  taskId,
  completedRecordType,
  completedRecordId,
  onCompletedOrSkipped,
}: CompleteLinkedTaskAfterSaveArgs): Promise<void> {
  if (!taskId) {
    onCompletedOrSkipped();
    return;
  }

  try {
    await completeTaskFromRecord(taskId, completedRecordType, completedRecordId);
    onCompletedOrSkipped();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Task could not be completed.';
    Alert.alert('Task update failed', message, [{ text: 'OK', onPress: onCompletedOrSkipped }]);
  }
}
