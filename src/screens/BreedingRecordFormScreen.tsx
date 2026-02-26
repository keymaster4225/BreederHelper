import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { BreedingMethod, Stallion } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { createBreedingRecord, listStallions } from '@/storage/repositories';
import { newId } from '@/utils/id';
import {
  normalizeLocalDate,
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'BreedingRecordForm'>;

type FormErrors = {
  date?: string;
  stallionId?: string;
  collectionDate?: string;
  volumeMl?: string;
  concentrationMPerMl?: string;
  motilityPercent?: string;
  numberOfStraws?: string;
};

const METHOD_OPTIONS: { label: string; value: BreedingMethod }[] = [
  { label: 'Live Cover', value: 'liveCover' },
  { label: 'Fresh AI', value: 'freshAI' },
  { label: 'Shipped Cooled AI', value: 'shippedCooledAI' },
  { label: 'Frozen AI', value: 'frozenAI' },
];

export function BreedingRecordFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;

  const [date, setDate] = useState('');
  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [stallionId, setStallionId] = useState('');
  const [method, setMethod] = useState<BreedingMethod>('liveCover');
  const [volumeMl, setVolumeMl] = useState('');
  const [concentrationMPerMl, setConcentrationMPerMl] = useState('');
  const [motilityPercent, setMotilityPercent] = useState('');
  const [numberOfStraws, setNumberOfStraws] = useState('');
  const [strawDetails, setStrawDetails] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingStallions, setIsLoadingStallions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Add Breeding Record' });
  }, [navigation]);

  useEffect(() => {
    let mounted = true;

    listStallions()
      .then((rows) => {
        if (!mounted) {
          return;
        }

        setStallions(rows);
        if (rows.length > 0) {
          setStallionId(rows[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Unable to load stallions.';
        Alert.alert('Load error', message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingStallions(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedMethodLabel = useMemo(
    () => METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method,
    [method]
  );

  const validate = (): {
    valid: boolean;
    parsedVolume: number | null;
    parsedConcentration: number | null;
    parsedMotility: number | null;
    parsedStraws: number | null;
  } => {
    const parsedVolume = parseOptionalNumber(volumeMl);
    const parsedConcentration = parseOptionalNumber(concentrationMPerMl);
    const parsedMotility = parseOptionalNumber(motilityPercent);
    const parsedStraws = parseOptionalInteger(numberOfStraws);

    const nextErrors: FormErrors = {
      date: validateLocalDate(date, 'Date', true) ?? undefined,
      stallionId: validateRequired(stallionId, 'Stallion') ?? undefined,
      collectionDate: validateLocalDate(collectionDate, 'Collection date', false) ?? undefined,
      volumeMl:
        method === 'freshAI' || method === 'shippedCooledAI'
          ? validateNumberRange(parsedVolume, 'Volume (mL)', 0, 1000) ?? undefined
          : undefined,
      concentrationMPerMl:
        method === 'freshAI' || method === 'shippedCooledAI'
          ? validateNumberRange(parsedConcentration, 'Concentration (millions/mL)', 0, 100000) ?? undefined
          : undefined,
      motilityPercent:
        method === 'freshAI' || method === 'shippedCooledAI'
          ? validateNumberRange(parsedMotility, 'Motility %', 0, 100) ?? undefined
          : undefined,
      numberOfStraws:
        method === 'frozenAI'
          ? parsedStraws === null
            ? 'Number of straws is required for Frozen AI.'
            : validateNumberRange(parsedStraws, 'Number of straws', 1, 1000) ?? undefined
          : undefined,
    };

    setErrors(nextErrors);

    const valid = Object.values(nextErrors).every((error) => !error);
    return { valid, parsedVolume, parsedConcentration, parsedMotility, parsedStraws };
  };

  const onSave = async (): Promise<void> => {
    const { valid, parsedVolume, parsedConcentration, parsedMotility, parsedStraws } = validate();
    if (!valid) {
      return;
    }

    setIsSaving(true);

    try {
      await createBreedingRecord({
        id: newId(),
        mareId,
        stallionId,
        date: date.trim(),
        method,
        notes: notes.trim() || null,
        volumeMl: method === 'freshAI' || method === 'shippedCooledAI' ? parsedVolume : null,
        concentrationMPerMl: method === 'freshAI' || method === 'shippedCooledAI' ? parsedConcentration : null,
        motilityPercent: method === 'freshAI' || method === 'shippedCooledAI' ? parsedMotility : null,
        numberOfStraws: method === 'frozenAI' ? parsedStraws : null,
        strawDetails: method === 'frozenAI' ? strawDetails.trim() || null : null,
        collectionDate:
          method === 'shippedCooledAI' || method === 'frozenAI'
            ? normalizeLocalDate(collectionDate)
            : null,
      });

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save breeding record.';
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

        <FormField label="Stallion" required error={errors.stallionId}>
          {isLoadingStallions ? (
            <Text>Loading stallions...</Text>
          ) : stallions.length === 0 ? (
            <Text>No stallions found. Add stallions first in Stallion Management.</Text>
          ) : (
            <OptionSelector
              value={stallionId}
              onChange={setStallionId}
              options={stallions.map((stallion) => ({ label: stallion.name, value: stallion.id }))}
            />
          )}
        </FormField>

        <FormField label="Breeding Method" required>
          <OptionSelector value={method} onChange={setMethod} options={METHOD_OPTIONS} />
          <Text>Selected: {selectedMethodLabel}</Text>
        </FormField>

        {(method === 'freshAI' || method === 'shippedCooledAI') && (
          <View style={formStyles.form}>
            <FormField label="Volume (mL)" error={errors.volumeMl}>
              <FormTextInput value={volumeMl} onChangeText={setVolumeMl} keyboardType="decimal-pad" />
            </FormField>

            <FormField label="Concentration (millions/mL)" error={errors.concentrationMPerMl}>
              <FormTextInput
                value={concentrationMPerMl}
                onChangeText={setConcentrationMPerMl}
                keyboardType="decimal-pad"
              />
            </FormField>

            <FormField label="Motility %" error={errors.motilityPercent}>
              <FormTextInput value={motilityPercent} onChangeText={setMotilityPercent} keyboardType="decimal-pad" />
            </FormField>
          </View>
        )}

        {method === 'frozenAI' && (
          <View style={formStyles.form}>
            <FormField label="Number of Straws" required error={errors.numberOfStraws}>
              <FormTextInput value={numberOfStraws} onChangeText={setNumberOfStraws} keyboardType="number-pad" />
            </FormField>

            <FormField label="Straw Details">
              <FormTextInput value={strawDetails} onChangeText={setStrawDetails} placeholder="Batch / ID" />
            </FormField>
          </View>
        )}

        {(method === 'shippedCooledAI' || method === 'frozenAI') && (
          <FormField label="Collection Date" error={errors.collectionDate}>
            <FormTextInput
              value={collectionDate}
              onChangeText={setCollectionDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </FormField>
        )}

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <Pressable
          disabled={isSaving || stallions.length === 0}
          style={[formStyles.saveButton, isSaving || stallions.length === 0 ? formStyles.saveButtonDisabled : null]}
          onPress={onSave}
        >
          <Text style={formStyles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Breeding Record'}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
