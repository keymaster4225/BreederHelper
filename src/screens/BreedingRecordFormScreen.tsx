import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { FormDateInput, FormField, FormPickerInput, FormTextInput, OptionSelector, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { BreedingMethod, SemenCollection, Stallion } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createBreedingRecord,
  deleteBreedingRecord,
  getBreedingRecordById,
  getStallionById,
  listSemenCollectionsByStallion,
  listStallions,
  updateBreedingRecord,
} from '@/storage/repositories';
import { colors } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
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
  stallion?: string;
  collectionDate?: string;
  volumeMl?: string;
  concentrationMPerMl?: string;
  motilityPercent?: string;
  numberOfStraws?: string;
  strawVolumeMl?: string;
};

type CoverageType = 'liveCover' | 'ai';

const COVERAGE_OPTIONS: { label: string; value: CoverageType }[] = [
  { label: 'Live Cover', value: 'liveCover' },
  { label: 'AI', value: 'ai' },
];

type AIMethod = 'freshAI' | 'shippedCooledAI' | 'frozenAI';

const AI_METHOD_OPTIONS: { label: string; value: AIMethod }[] = [
  { label: 'Fresh', value: 'freshAI' },
  { label: 'Shipped Cooled', value: 'shippedCooledAI' },
  { label: 'Frozen', value: 'frozenAI' },
];

const OTHER_STALLION = '__other__';
const NO_COLLECTION = '__none__';

function formatCollectionLabel(c: SemenCollection): string {
  const date = formatLocalDate(c.collectionDate, 'MM-DD-YYYY');
  const doses = c.doseCount != null ? `${c.doseCount} doses` : '-';
  const motility = c.progressiveMotilityPercent != null ? `${c.progressiveMotilityPercent}%` : '-';
  return `${date} - ${doses} - ${motility} motility`;
}

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

  // Stallion picker state
  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [selectedStallionId, setSelectedStallionId] = useState<string | null>(null);
  const [useCustomStallion, setUseCustomStallion] = useState(false);

  // Collection picker state
  const [collections, setCollections] = useState<SemenCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showAllCollections, setShowAllCollections] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Breeding Record' : 'Add Breeding Record' });
  }, [isEdit, navigation]);

  // Load stallions on mount
  useEffect(() => {
    void (async () => {
      const rows = await listStallions();
      setStallions(rows);
    })();
  }, []);

  // Load existing record
  useEffect(() => {
    if (!breedingRecordId) return;

    let mounted = true;
    void (async () => {
      try {
        const record = await getBreedingRecordById(breedingRecordId);
        if (!mounted) return;

        if (!record) {
          Alert.alert('Record not found', 'This breeding record no longer exists.');
          navigation.goBack();
          return;
        }

        setDate(record.date);
        setMethod(record.method);
        setVolumeMl(record.volumeMl == null ? '' : String(record.volumeMl));
        setConcentrationMPerMl(record.concentrationMPerMl == null ? '' : String(record.concentrationMPerMl));
        setMotilityPercent(record.motilityPercent == null ? '' : String(record.motilityPercent));
        setNumberOfStraws(record.numberOfStraws == null ? '' : String(record.numberOfStraws));
        setStrawVolumeMl(record.strawVolumeMl == null ? '' : String(Math.trunc(record.strawVolumeMl)));
        setStrawDetails(record.strawDetails ?? '');
        setCollectionDate(record.collectionDate ?? '');
        setNotes(record.notes ?? '');

        if (record.stallionId != null) {
          setSelectedStallionId(record.stallionId);
          setUseCustomStallion(false);
          // Load collections for this stallion
          const cols = await listSemenCollectionsByStallion(record.stallionId);
          if (mounted) setCollections(cols);
          // Check if the stallion is in the list; if not (soft-deleted), fetch and prepend
          const currentList = await listStallions();
          if (mounted) {
            const found = currentList.some((s) => s.id === record.stallionId);
            if (!found) {
              const deleted = await getStallionById(record.stallionId);
              if (deleted && mounted) {
                setStallions([deleted, ...currentList]);
              }
            } else {
              setStallions(currentList);
            }
          }
        } else {
          setUseCustomStallion(true);
          setStallionName(record.stallionName ?? '');
        }

        if (record.collectionId != null) {
          setSelectedCollectionId(record.collectionId);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to load breeding record.';
        Alert.alert('Load error', message);
        if (mounted) navigation.goBack();
      } finally {
        if (mounted) setIsLoadingRecord(false);
      }
    })();

    return () => { mounted = false; };
  }, [breedingRecordId, navigation]);

  const coverageType: CoverageType = method === 'liveCover' ? 'liveCover' : 'ai';

  const onCoverageChange = (coverage: CoverageType): void => {
    if (coverage === 'liveCover') {
      setMethod('liveCover');
      setSelectedCollectionId(null);
    } else if (method === 'liveCover') {
      setMethod('freshAI');
    }
  };

  const onStallionChange = (value: string): void => {
    if (value === OTHER_STALLION) {
      setUseCustomStallion(true);
      setSelectedStallionId(null);
      setSelectedCollectionId(null);
      setCollections([]);
    } else {
      setUseCustomStallion(false);
      setSelectedStallionId(value);
      setSelectedCollectionId(null);
      setShowAllCollections(false);
      void (async () => {
        const cols = await listSemenCollectionsByStallion(value);
        setCollections(cols);
      })();
    }
  };

  const onCollectionChange = (value: string): void => {
    if (value === NO_COLLECTION) {
      setSelectedCollectionId(null);
      return;
    }
    const c = collections.find((col) => col.id === value);
    if (c) {
      setSelectedCollectionId(c.id);
      if (c.rawVolumeMl != null) setVolumeMl(String(c.rawVolumeMl));
      if (c.concentrationMillionsPerMl != null) setConcentrationMPerMl(String(c.concentrationMillionsPerMl));
      if (c.progressiveMotilityPercent != null) setMotilityPercent(String(c.progressiveMotilityPercent));
      if (c.collectionDate) setCollectionDate(c.collectionDate);
    }
  };

  const stallionPickerOptions = [
    ...stallions.map((s) => ({ label: s.name, value: s.id })),
    { label: 'Other / Not in list', value: OTHER_STALLION },
  ];

  const showCollectionPicker = selectedStallionId != null && method !== 'liveCover';
  const recentCollections = showAllCollections ? collections : collections.slice(0, 10);
  const collectionPickerOptions = [
    { label: 'None', value: NO_COLLECTION },
    ...recentCollections.map((c) => ({ label: formatCollectionLabel(c), value: c.id })),
  ];

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
      stallion: useCustomStallion
        ? validateRequired(stallionName.trim(), 'Stallion name') ?? undefined
        : selectedStallionId == null
          ? 'Please select a stallion.'
          : undefined,
      collectionDate:
        method === 'shippedCooledAI' || method === 'frozenAI'
          ? (validateLocalDate(collectionDate, 'Collection date', false)
            ?? validateLocalDateNotInFuture(collectionDate)
            ?? (method === 'shippedCooledAI' && collectionDate.trim() && date.trim() && collectionDate.trim() > date.trim()
              ? 'Collection date cannot be after breeding date.'
              : null)) ??
            undefined
          : undefined,
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
    if (!valid) return;

    setIsSaving(true);

    try {
      const payload = {
        stallionId: selectedStallionId,
        stallionName: useCustomStallion ? (stallionName.trim() || null) : null,
        collectionId: selectedCollectionId,
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
    if (!breedingRecordId) return;

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
    <Screen style={{ paddingTop: 0 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <FormField label="Date" required error={errors.date}>
          <FormDateInput value={date} onChange={setDate} placeholder="Select breeding date" maximumDate={today} />
        </FormField>

        <FormField label="Stallion" required error={errors.stallion}>
          <FormPickerInput
            value={selectedStallionId ?? (useCustomStallion ? OTHER_STALLION : '')}
            onChange={onStallionChange}
            options={stallionPickerOptions}
            placeholder="Select stallion"
          />
        </FormField>

        {useCustomStallion ? (
          <FormField label="Stallion Name" required>
            <FormTextInput
              value={stallionName}
              onChangeText={setStallionName}
              placeholder="Enter stallion name"
            />
          </FormField>
        ) : null}

        <FormField label="Breeding Method" required>
          <OptionSelector value={coverageType} onChange={onCoverageChange} options={COVERAGE_OPTIONS} />
          {method !== 'liveCover' ? (
            <OptionSelector value={method as AIMethod} onChange={setMethod} options={AI_METHOD_OPTIONS} />
          ) : null}
        </FormField>

        {showCollectionPicker ? (
          <FormField label="Collection">
            <FormPickerInput
              value={selectedCollectionId ?? NO_COLLECTION}
              onChange={onCollectionChange}
              options={collectionPickerOptions}
              placeholder="Select collection"
              onShowAll={collections.length > 10 && !showAllCollections ? () => setShowAllCollections(true) : undefined}
            />
          </FormField>
        ) : null}

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
          <DeleteButton label="Delete" onPress={onDelete} disabled={isSaving} />
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
