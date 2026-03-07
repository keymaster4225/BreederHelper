import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { BreedingMethod } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createBreedingRecord,
  deleteBreedingRecord,
  getBreedingRecordById,
  updateBreedingRecord,
} from '@/storage/repositories';
import { colors } from '@/theme';
import { newId } from '@/utils/id';
import {
  normalizeLocalDate,
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'BreedingRecordForm'>;

type FormErrors = {
  date?: string;
  stallionName?: string;
  collectionDate?: string;
  volumeMl?: string;
  concentrationMPerMl?: string;
  motilityPercent?: string;
  numberOfStraws?: string;
  strawVolumeMl?: string;
};

const METHOD_OPTIONS: { label: string; value: BreedingMethod }[] = [
  { label: 'Live Cover', value: 'liveCover' },
  { label: 'Fresh AI', value: 'freshAI' },
  { label: 'Shipped Cooled AI', value: 'shippedCooledAI' },
  { label: 'Frozen AI', value: 'frozenAI' },
];

export function BreedingRecordFormScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const breedingRecordId = route.params.breedingRecordId;
  const isEdit = Boolean(breedingRecordId);

  const [date, setDate] = useState('');
  const [stallionName, setStallionName] = useState('');
  const [method, setMethod] = useState<BreedingMethod>('liveCover');
  const [volumeMl, setVolumeMl] = useState('');
  const [concentrationMPerMl, setConcentrationMPerMl] = useState('');
  const [motilityPercent, setMotilityPercent] = useState('');
  const [numberOfStraws, setNumberOfStraws] = useState('');
  const [strawVolumeMl, setStrawVolumeMl] = useState('');
  const [strawDetails, setStrawDetails] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingRecord, setIsLoadingRecord] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const today = new Date();

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Breeding Record' : 'Add Breeding Record' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (!breedingRecordId) {
      return;
    }

    let mounted = true;
    getBreedingRecordById(breedingRecordId)
      .then((record) => {
        if (!mounted) {
          return;
        }

        if (!record) {
          Alert.alert('Record not found', 'This breeding record no longer exists.');
          navigation.goBack();
          return;
        }

        setDate(record.date);
        setStallionName(record.stallionName ?? '');
        setMethod(record.method);
        setVolumeMl(record.volumeMl == null ? '' : String(record.volumeMl));
        setConcentrationMPerMl(record.concentrationMPerMl == null ? '' : String(record.concentrationMPerMl));
        setMotilityPercent(record.motilityPercent == null ? '' : String(record.motilityPercent));
        setNumberOfStraws(record.numberOfStraws == null ? '' : String(record.numberOfStraws));
        // Math.trunc guards against any existing rows stored with REAL affinity
        // (existing installs ran migration002 with REAL before it was corrected to INTEGER).
        setStrawVolumeMl(record.strawVolumeMl == null ? '' : String(Math.trunc(record.strawVolumeMl)));
        setStrawDetails(record.strawDetails ?? '');
        setCollectionDate(record.collectionDate ?? '');
        setNotes(record.notes ?? '');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load breeding record.';
        Alert.alert('Load error', message);
        navigation.goBack();
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingRecord(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [breedingRecordId, navigation]);

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
    parsedStrawVolume: number | null;
  } => {
    const parsedVolume = parseOptionalNumber(volumeMl);
    const parsedConcentration = parseOptionalNumber(concentrationMPerMl);
    const parsedMotility = parseOptionalNumber(motilityPercent);
    const parsedStraws = parseOptionalInteger(numberOfStraws);
    const parsedStrawVolume = parseOptionalInteger(strawVolumeMl);

    const nextErrors: FormErrors = {
      date: (validateLocalDate(date, 'Date', true) ?? validateLocalDateNotInFuture(date)) ?? undefined,
      stallionName: validateRequired(stallionName.trim(), 'Stallion name') ?? undefined,
      collectionDate:
        (validateLocalDate(collectionDate, 'Collection date', false) ?? validateLocalDateNotInFuture(collectionDate)) ??
        undefined,
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
      strawVolumeMl:
        method === 'frozenAI'
          ? validateNumberRange(parsedStrawVolume, 'Straw volume (mL)', 0, 99) ?? undefined
          : undefined,
    };

    setErrors(nextErrors);
    const valid = Object.values(nextErrors).every((error) => !error);
    return { valid, parsedVolume, parsedConcentration, parsedMotility, parsedStraws, parsedStrawVolume };
  };

  const onSave = async (): Promise<void> => {
    const { valid, parsedVolume, parsedConcentration, parsedMotility, parsedStraws, parsedStrawVolume } = validate();
    if (!valid) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        stallionId: null,
        stallionName: stallionName.trim() || null,
        date: date.trim(),
        method,
        notes: notes.trim() || null,
        volumeMl: method === 'freshAI' || method === 'shippedCooledAI' ? parsedVolume : null,
        concentrationMPerMl: method === 'freshAI' || method === 'shippedCooledAI' ? parsedConcentration : null,
        motilityPercent: method === 'freshAI' || method === 'shippedCooledAI' ? parsedMotility : null,
        numberOfStraws: method === 'frozenAI' ? parsedStraws : null,
        strawVolumeMl: method === 'frozenAI' ? parsedStrawVolume : null,
        strawDetails: method === 'frozenAI' ? strawDetails.trim() || null : null,
        collectionDate: method === 'shippedCooledAI' || method === 'frozenAI' ? normalizeLocalDate(collectionDate) : null,
      };

      if (breedingRecordId) {
        await updateBreedingRecord(breedingRecordId, payload);
      } else {
        await createBreedingRecord({ id: newId(), mareId, ...payload });
      }

      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save breeding record.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    if (!breedingRecordId) {
      return;
    }

    Alert.alert('Delete Breeding Record', 'Delete this breeding record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteBreedingRecord(breedingRecordId);
              navigation.goBack();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to delete breeding record.';
              if (message.toLowerCase().includes('foreign key')) {
                Alert.alert('Delete blocked', 'Cannot delete this breeding record because linked records exist.');
                return;
              }
              Alert.alert('Delete failed', message);
            }
          })();
        },
      },
    ]);
  };

  const onChangeStrawVolumeMl = (value: string): void => {
    setStrawVolumeMl(value.replace(/\D/g, '').slice(0, 2));
  };

  if (isLoadingRecord) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select breeding date" maximumDate={today} />
        </FormField>

        <FormField label="Stallion" required error={errors.stallionName}>
          <FormTextInput
            value={stallionName}
            onChangeText={setStallionName}
            placeholder="Enter stallion name"
          />
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
              <FormTextInput value={concentrationMPerMl} onChangeText={setConcentrationMPerMl} keyboardType="decimal-pad" />
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

            <FormField label="Straw Volume (mL)" error={errors.strawVolumeMl}>
              <FormTextInput
                value={strawVolumeMl}
                onChangeText={onChangeStrawVolumeMl}
                keyboardType="number-pad"
                maxLength={2}
              />
            </FormField>

            <FormField label="Straw Details">
              <FormTextInput value={strawDetails} onChangeText={setStrawDetails} placeholder="Batch / ID" />
            </FormField>
          </View>
        )}

        {(method === 'shippedCooledAI' || method === 'frozenAI') && (
          <FormField label="Collection Date" error={errors.collectionDate}>
            <FormDateInput
              value={collectionDate}
              onChange={setCollectionDate}
              placeholder="Select collection date"
              clearable
              maximumDate={today}
            />
          </FormField>
        )}

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline />
        </FormField>

        <PrimaryButton
          label={isSaving ? 'Saving...' : 'Save'}
          onPress={onSave}
          disabled={isSaving}
        />

        {isEdit ? (
          <DeleteButton label="Delete" onPress={onDelete} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
