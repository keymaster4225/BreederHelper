import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createDailyLog, getDailyLogById, updateDailyLog } from '@/storage/repositories';
import { newId } from '@/utils/id';
import { validateLocalDate } from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyLogForm'>;

type ScoreOption = '' | '0' | '1' | '2' | '3' | '4' | '5';

type FormErrors = {
  date?: string;
};

const SCORE_OPTIONS: { label: string; value: ScoreOption }[] = [
  { label: 'None', value: '' },
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
];

export function DailyLogFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const logId = route.params.logId;
  const isEdit = Boolean(logId);

  const [date, setDate] = useState('');
  const [teasingScore, setTeasingScore] = useState<ScoreOption>('');
  const [rightOvary, setRightOvary] = useState('');
  const [leftOvary, setLeftOvary] = useState('');
  const [edema, setEdema] = useState<ScoreOption>('');
  const [uterineTone, setUterineTone] = useState('');
  const [uterineCysts, setUterineCysts] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Daily Log' : 'Add Daily Log' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (!logId) {
      return;
    }

    let mounted = true;
    getDailyLogById(logId)
      .then((record) => {
        if (!mounted) {
          return;
        }

        if (!record) {
          Alert.alert('Log not found', 'This daily log no longer exists.');
          navigation.goBack();
          return;
        }

        setDate(record.date);
        setTeasingScore(record.teasingScore == null ? '' : String(record.teasingScore) as ScoreOption);
        setRightOvary(record.rightOvary ?? '');
        setLeftOvary(record.leftOvary ?? '');
        setEdema(record.edema == null ? '' : String(record.edema) as ScoreOption);
        setUterineTone(record.uterineTone ?? '');
        setUterineCysts(record.uterineCysts ?? '');
        setNotes(record.notes ?? '');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load daily log.';
        Alert.alert('Load error', message);
        navigation.goBack();
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [logId, navigation]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      date: validateLocalDate(date, 'Date', true) ?? undefined,
    };

    setErrors(nextErrors);
    return !nextErrors.date;
  };

  const onSave = async (): Promise<void> => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        date: date.trim(),
        teasingScore: teasingScore === '' ? null : Number(teasingScore),
        rightOvary: rightOvary.trim() || null,
        leftOvary: leftOvary.trim() || null,
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save daily log.';
      if (message.toLowerCase().includes('unique')) {
        Alert.alert('Duplicate date', 'A daily log already exists for this mare on that date.');
      } else {
        Alert.alert('Save failed', message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Text>Loading daily log...</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select date" />
        </FormField>

        <FormField label="Teasing Score (0-5)">
          <OptionSelector value={teasingScore} onChange={setTeasingScore} options={SCORE_OPTIONS} />
        </FormField>

        <FormField label="Right Ovary">
          <FormTextInput value={rightOvary} onChangeText={setRightOvary} placeholder="35mm, MSF, AHF, CL, no findings" />
        </FormField>

        <FormField label="Left Ovary">
          <FormTextInput value={leftOvary} onChangeText={setLeftOvary} placeholder="35mm, MSF, AHF, CL, no findings" />
        </FormField>

        <FormField label="Uterine Edema (0-5)">
          <OptionSelector value={edema} onChange={setEdema} options={SCORE_OPTIONS} />
        </FormField>

        <FormField label="Uterine Tone">
          <FormTextInput value={uterineTone} onChangeText={setUterineTone} placeholder="Optional" />
        </FormField>

        <FormField label="Uterine Cysts">
          <FormTextInput value={uterineCysts} onChangeText={setUterineCysts} placeholder="2cm cyst at left horn base" />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <Pressable
          disabled={isSaving}
          style={[formStyles.saveButton, isSaving ? formStyles.saveButtonDisabled : null]}
          onPress={onSave}
        >
          <Text style={formStyles.saveButtonText}>{isSaving ? 'Saving...' : isEdit ? 'Save Daily Log' : 'Create Daily Log'}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
