import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { useRecordForm } from '@/hooks/useRecordForm';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createDailyLog, deleteDailyLog, getDailyLogById, updateDailyLog } from '@/storage/repositories';
import { colors } from '@/theme';
import { confirmDelete } from '@/utils/confirmDelete';
import { newId } from '@/utils/id';
import { validateLocalDate, validateLocalDateNotInFuture } from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyLogForm'>;

type ScoreOption = '' | '0' | '1' | '2' | '3' | '4' | '5';
type OvulationOption = 'unknown' | 'no' | 'yes';

type FormErrors = {
  date?: string;
};

const SCORE_OPTIONS: { label: string; value: ScoreOption }[] = [
  { label: 'N/A', value: '' },
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
];

const OVULATION_OPTIONS: { label: string; value: OvulationOption }[] = [
  { label: 'Unknown', value: 'unknown' },
  { label: 'No', value: 'no' },
  { label: 'Yes', value: 'yes' },
];

function toOvulationOption(value: boolean | null | undefined): OvulationOption {
  if (value === true) {
    return 'yes';
  }

  if (value === false) {
    return 'no';
  }

  return 'unknown';
}

function fromOvulationOption(value: OvulationOption): boolean | null {
  if (value === 'yes') {
    return true;
  }

  if (value === 'no') {
    return false;
  }

  return null;
}

export function DailyLogFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const logId = route.params.logId;
  const isEdit = Boolean(logId);

  const [date, setDate] = useState('');
  const [teasingScore, setTeasingScore] = useState<ScoreOption>('');
  const [rightOvary, setRightOvary] = useState('');
  const [leftOvary, setLeftOvary] = useState('');
  const [ovulationStatus, setOvulationStatus] = useState<OvulationOption>('unknown');
  const [edema, setEdema] = useState<ScoreOption>('');
  const [uterineTone, setUterineTone] = useState('');
  const [uterineCysts, setUterineCysts] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const { isLoading, isSaving, isDeleting, setIsLoading, runLoad, runSave, runDelete } =
    useRecordForm({ initialLoading: isEdit });
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Daily Log' : 'Add Daily Log' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (!logId) {
      setIsLoading(false);
      return;
    }

    void runLoad(
      async () => {
        const record = await getDailyLogById(logId);
        if (!record) {
          Alert.alert('Log not found', 'This daily log no longer exists.');
          navigation.goBack();
          return;
        }

        setDate(record.date);
        setTeasingScore(record.teasingScore == null ? '' : String(record.teasingScore) as ScoreOption);
        setRightOvary(record.rightOvary ?? '');
        setLeftOvary(record.leftOvary ?? '');
        setOvulationStatus(toOvulationOption(record.ovulationDetected));
        setEdema(record.edema == null ? '' : String(record.edema) as ScoreOption);
        setUterineTone(record.uterineTone ?? '');
        setUterineCysts(record.uterineCysts ?? '');
        setNotes(record.notes ?? '');
      },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unable to load daily log.';
          Alert.alert('Load error', message);
          navigation.goBack();
        },
      },
    );
  }, [logId, navigation, runLoad, setIsLoading]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.date;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    await runSave(
      async () => {
        const payload = {
          date: date.trim(),
          teasingScore: teasingScore === '' ? null : Number(teasingScore),
          rightOvary: rightOvary.trim() || null,
          leftOvary: leftOvary.trim() || null,
          ovulationDetected: fromOvulationOption(ovulationStatus),
          edema: edema === '' ? null : Number(edema),
          uterineTone: uterineTone.trim() || null,
          uterineCysts: uterineCysts.trim() || null,
          notes: notes.trim() || null,
        };

        if (logId) {
          await updateDailyLog(logId, payload);
        } else {
          await createDailyLog({ id: newId(), mareId, ...payload });
        }

        navigation.goBack();
      },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to save daily log.';
          if (message.toLowerCase().includes('unique')) {
            Alert.alert('Duplicate date', 'A daily log already exists for this mare on that date.');
          } else {
            Alert.alert('Save failed', message);
          }
        },
      },
    );
  };

  const onDelete = (): void => {
    if (!logId) {
      return;
    }

    confirmDelete({
      title: 'Delete Daily Log',
      message: 'Delete this daily log entry?',
      onConfirm: async () => {
        await runDelete(
          async () => {
            await deleteDailyLog(logId);
            navigation.goBack();
          },
          {
            onError: (err: unknown) => {
              const message = err instanceof Error ? err.message : 'Failed to delete daily log.';
              Alert.alert('Delete failed', message);
            },
          },
        );
      },
    });
  };

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <FormField label="Date" required error={errors.date}>
            <FormDateInput value={date} onChange={setDate} placeholder="Select date" maximumDate={today} />
          </FormField>

          <FormField label="Teasing Score (0-5)">
            <OptionSelector value={teasingScore} onChange={setTeasingScore} options={SCORE_OPTIONS} />
          </FormField>

          <FormField label="Right Ovary">
            <FormTextInput value={rightOvary} onChangeText={setRightOvary} placeholder="(ie:35mm, MSF, AHF, CL, no findings)" />
          </FormField>

          <FormField label="Left Ovary">
            <FormTextInput value={leftOvary} onChangeText={setLeftOvary} placeholder="(ie: 35mm, MSF, AHF, CL, no findings)" />
          </FormField>

          <FormField label="Ovulated">
            <OptionSelector value={ovulationStatus} onChange={setOvulationStatus} options={OVULATION_OPTIONS} />
          </FormField>

          <FormField label="Uterine Edema (0-5)">
            <OptionSelector value={edema} onChange={setEdema} options={SCORE_OPTIONS} />
          </FormField>

          <FormField label="Uterine Tone">
            <FormTextInput value={uterineTone} onChangeText={setUterineTone} placeholder="Optional" />
          </FormField>

          <FormField label="Uterine Cysts">
            <FormTextInput value={uterineCysts} onChangeText={setUterineCysts} placeholder="(ie: 2cm cyst at left horn base)" />
          </FormField>

          <FormField label="Notes">
            <FormTextInput value={notes} onChangeText={setNotes} multiline />
          </FormField>

          <PrimaryButton
            label={isSaving ? 'Saving...' : 'Save'}
            onPress={onSave}
            disabled={isSaving || isDeleting}
          />

          {isEdit ? (
            <DeleteButton
              label={isDeleting ? 'Deleting...' : 'Delete'}
              onPress={onDelete}
              disabled={isSaving || isDeleting}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
