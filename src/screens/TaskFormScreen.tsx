import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import {
  FormDateInput,
  FormField,
  FormPickerInput,
  FormTextInput,
  FormTimeInput,
  OptionSelector,
  formStyles,
} from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { TASK_TYPE_OPTIONS, useTaskForm } from '@/hooks/useTaskForm';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

export function TaskFormScreen({ navigation, route }: Props): JSX.Element {
  const params = route.params ?? {};
  const {
    isEdit,
    mares,
    mareId,
    taskType,
    title,
    dueDate,
    dueTime,
    notes,
    errors,
    isLoading,
    isSaving,
    isDeleting,
    isCompleting,
    setMareId,
    setTaskType,
    setTitleValue,
    setDueDate,
    setDueTime,
    setNotes,
    onSave,
    onComplete,
    requestDelete,
  } = useTaskForm({
    taskId: params.taskId,
    initialMareId: params.mareId,
    initialTaskType: params.taskType,
    initialDueDate: params.dueDate,
    initialDueTime: params.dueTime,
    initialTitle: params.title,
    sourceType: params.sourceType,
    sourceRecordId: params.sourceRecordId,
    sourceReason: params.sourceReason,
    onGoBack: () => navigation.goBack(),
    setTitle: (nextTitle) => navigation.setOptions({ title: nextTitle }),
  });

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const isBusy = isSaving || isDeleting || isCompleting;
  const mareOptions = mares.map((mare) => ({ label: mare.name, value: mare.id }));

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <FormField label="Mare" required error={errors.mareId}>
            <FormPickerInput
              value={mareId}
              onChange={setMareId}
              options={mareOptions}
              placeholder="Select mare"
            />
          </FormField>

          <FormField label="Task Type" required error={errors.taskType}>
            <OptionSelector value={taskType} onChange={setTaskType} options={TASK_TYPE_OPTIONS} />
          </FormField>

          <FormField label="Title" required error={errors.title}>
            <FormTextInput value={title} onChangeText={setTitleValue} placeholder="Task title" />
          </FormField>

          <FormField label="Due Date" required error={errors.dueDate}>
            <FormDateInput value={dueDate} onChange={setDueDate} placeholder="Select due date" displayFormat="MM-DD-YYYY" />
          </FormField>

          <FormField label="Due Time" error={errors.dueTime}>
            <FormTimeInput
              value={dueTime}
              onChange={setDueTime}
              placeholder="Select due time"
              clearable
              accessibilityLabel="Select due time"
            />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <PrimaryButton
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={onSave}
            disabled={isBusy}
          />

          {isEdit ? (
            <SecondaryButton
              label={isCompleting ? 'Completing...' : 'Mark Complete'}
              onPress={onComplete}
              disabled={isBusy}
            />
          ) : null}

          {isEdit ? (
            <DeleteButton
              label={isDeleting ? 'Deleting...' : 'Delete'}
              onPress={requestDelete}
              disabled={isBusy}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
