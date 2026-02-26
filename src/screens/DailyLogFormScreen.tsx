import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createDailyLog } from '@/storage/repositories';
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

  const [date, setDate] = useState('');
  const [teasingScore, setTeasingScore] = useState<ScoreOption>('');
  const [rightOvary, setRightOvary] = useState('');
  const [leftOvary, setLeftOvary] = useState('');
  const [edema, setEdema] = useState<ScoreOption>('');
  const [uterineTone, setUterineTone] = useState('');
  const [uterineCysts, setUterineCysts] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Add Daily Log' });
  }, [navigation]);

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
      await createDailyLog({
        id: newId(),
        mareId,
        date: date.trim(),
        teasingScore: teasingScore === '' ? null : Number(teasingScore),
        rightOvary: rightOvary.trim() || null,
        leftOvary: leftOvary.trim() || null,
        edema: edema === '' ? null : Number(edema),
        uterineTone: uterineTone.trim() || null,
        uterineCysts: uterineCysts.trim() || null,
        notes: notes.trim() || null,
      });

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save daily log.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Date" required error={errors.date}>
          <FormTextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        </FormField>

        <FormField label="Teasing Score (0-5)">
          <OptionSelector value={teasingScore} onChange={setTeasingScore} options={SCORE_OPTIONS} />
        </FormField>

        <FormField label="Right Ovary">
          <FormTextInput
            value={rightOvary}
            onChangeText={setRightOvary}
            placeholder="35mm, MSF, AHF, CL, no findings"
          />
        </FormField>

        <FormField label="Left Ovary">
          <FormTextInput
            value={leftOvary}
            onChangeText={setLeftOvary}
            placeholder="35mm, MSF, AHF, CL, no findings"
          />
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
          <Text style={formStyles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Daily Log'}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
