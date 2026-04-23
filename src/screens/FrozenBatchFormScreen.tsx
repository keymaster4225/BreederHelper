import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DeleteButton, PrimaryButton } from '@/components/Buttons';
import { formStyles } from '@/components/FormControls';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import { Screen } from '@/components/Screen';
import type { FreezingExtender, StrawColor } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  deleteFrozenSemenBatch,
  getFrozenSemenBatch,
  getSemenCollectionById,
  updateFrozenSemenBatch,
} from '@/storage/repositories';
import { colors, spacing, typography } from '@/theme';
import { formatLocalDate } from '@/utils/dates';
import { computeTotalSpermPerStrawMillions } from '@/utils/frozenSemen';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateIntegerRange,
  validateLinkedFrozenRawVolume,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateOptionalDecimalRange,
  validateOtherSelection,
  validateTriStateSelection,
} from '@/utils/validation';
import { BasicsStep } from './frozen-batch-wizard/BasicsStep';
import { QualityStep } from './frozen-batch-wizard/QualityStep';
import { StorageStep } from './frozen-batch-wizard/StorageStep';
import { StrawsStep } from './frozen-batch-wizard/StrawsStep';

type Props = NativeStackScreenProps<RootStackParamList, 'FrozenBatchForm'>;

type FormErrors = {
  freezeDate?: string;
  rawSemenVolumeUsedMl?: string;
  centrifugeSpeedRpm?: string;
  centrifugeDurationMin?: string;
  centrifugeCushionUsed?: string;
  centrifugeResuspensionVolumeMl?: string;
  strawCount?: string;
  strawVolumeMl?: string;
  concentrationMillionsPerMl?: string;
  strawsPerDose?: string;
  extenderOther?: string;
  strawColorOther?: string;
  postThawMotilityPercent?: string;
  longevityHours?: string;
};

function toOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function toOptionalInteger(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

function validateOptionalPositiveNumber(
  value: number | null,
  label: string,
): string | null {
  if (value == null) {
    return null;
  }

  const rangeError = validateNumberRange(value, label, 0, 100000);
  if (rangeError) {
    return rangeError;
  }

  if (value <= 0) {
    return `${label} must be greater than zero.`;
  }

  return null;
}

function formatSpermPerStraw(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} M`;
}

export function FrozenBatchFormScreen({ navigation, route }: Props): JSX.Element {
  const frozenBatchId = route.params.frozenBatchId;
  const expectedStallionId = route.params.stallionId;

  const [freezeDate, setFreezeDate] = useState('');
  const [rawSemenVolumeUsedMl, setRawSemenVolumeUsedMl] = useState('');
  const [wasCentrifuged, setWasCentrifuged] = useState(false);
  const [centrifugeSpeedRpm, setCentrifugeSpeedRpm] = useState('');
  const [centrifugeDurationMin, setCentrifugeDurationMin] = useState('');
  const [centrifugeCushionUsed, setCentrifugeCushionUsed] = useState<boolean | null>(null);
  const [centrifugeCushionType, setCentrifugeCushionType] = useState('');
  const [centrifugeResuspensionVolumeMl, setCentrifugeResuspensionVolumeMl] = useState('');
  const [centrifugeNotes, setCentrifugeNotes] = useState('');

  const [extender, setExtender] = useState<FreezingExtender | null>(null);
  const [extenderOther, setExtenderOther] = useState('');
  const [strawCount, setStrawCount] = useState('');
  const [strawVolumeMl, setStrawVolumeMl] = useState('');
  const [concentrationMillionsPerMl, setConcentrationMillionsPerMl] = useState('');
  const [strawsPerDose, setStrawsPerDose] = useState('');
  const [strawColor, setStrawColor] = useState<StrawColor | null>(null);
  const [strawColorOther, setStrawColorOther] = useState('');
  const [strawLabel, setStrawLabel] = useState('');

  const [postThawMotilityPercent, setPostThawMotilityPercent] = useState('');
  const [longevityHours, setLongevityHours] = useState('');
  const [storageDetails, setStorageDetails] = useState('');
  const [notes, setNotes] = useState('');

  const [linkedCollectionId, setLinkedCollectionId] = useState<string | null>(null);
  const [linkedCollectionDate, setLinkedCollectionDate] = useState<string | null>(null);
  const [strawsRemaining, setStrawsRemaining] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Edit Frozen Batch' });
  }, [navigation]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const batch = await getFrozenSemenBatch(frozenBatchId);
        if (!mounted) {
          return;
        }

        if (!batch) {
          Alert.alert('Batch not found', 'This frozen batch no longer exists.');
          navigation.goBack();
          return;
        }

        if (batch.stallionId !== expectedStallionId) {
          Alert.alert('Batch mismatch', 'This batch belongs to a different stallion.');
          navigation.goBack();
          return;
        }

        setFreezeDate(batch.freezeDate);
        setRawSemenVolumeUsedMl(
          batch.rawSemenVolumeUsedMl != null ? String(batch.rawSemenVolumeUsedMl) : '',
        );
        setWasCentrifuged(batch.wasCentrifuged);
        setCentrifugeSpeedRpm(
          batch.centrifuge.speedRpm != null ? String(batch.centrifuge.speedRpm) : '',
        );
        setCentrifugeDurationMin(
          batch.centrifuge.durationMin != null ? String(batch.centrifuge.durationMin) : '',
        );
        setCentrifugeCushionUsed(batch.centrifuge.cushionUsed);
        setCentrifugeCushionType(batch.centrifuge.cushionType ?? '');
        setCentrifugeResuspensionVolumeMl(
          batch.centrifuge.resuspensionVolumeMl != null
            ? String(batch.centrifuge.resuspensionVolumeMl)
            : '',
        );
        setCentrifugeNotes(batch.centrifuge.notes ?? '');

        setExtender(batch.extender);
        setExtenderOther(batch.extenderOther ?? '');
        setStrawCount(String(batch.strawCount));
        setStrawVolumeMl(String(batch.strawVolumeMl));
        setConcentrationMillionsPerMl(
          batch.concentrationMillionsPerMl != null
            ? String(batch.concentrationMillionsPerMl)
            : '',
        );
        setStrawsPerDose(batch.strawsPerDose != null ? String(batch.strawsPerDose) : '');
        setStrawColor(batch.strawColor);
        setStrawColorOther(batch.strawColorOther ?? '');
        setStrawLabel(batch.strawLabel ?? '');

        setPostThawMotilityPercent(
          batch.postThawMotilityPercent != null
            ? String(batch.postThawMotilityPercent)
            : '',
        );
        setLongevityHours(batch.longevityHours != null ? String(batch.longevityHours) : '');
        setStorageDetails(batch.storageDetails ?? '');
        setNotes(batch.notes ?? '');

        setLinkedCollectionId(batch.collectionId);
        setStrawsRemaining(batch.strawsRemaining);

        if (batch.collectionId) {
          const collection = await getSemenCollectionById(batch.collectionId);
          if (!mounted) {
            return;
          }
          setLinkedCollectionDate(collection?.collectionDate ?? null);
        } else {
          setLinkedCollectionDate(null);
        }
      } catch (error) {
        if (!mounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load frozen batch.';
        Alert.alert('Load error', message);
        navigation.goBack();
      } finally {
        if (mounted) {
          setIsLoadingRecord(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [expectedStallionId, frozenBatchId, navigation]);

  const parsedRawSemenVolumeUsedMl = useMemo(
    () => parseOptionalNumber(rawSemenVolumeUsedMl),
    [rawSemenVolumeUsedMl],
  );
  const parsedCentrifugeSpeedRpm = useMemo(
    () => parseOptionalInteger(centrifugeSpeedRpm),
    [centrifugeSpeedRpm],
  );
  const parsedCentrifugeDurationMin = useMemo(
    () => parseOptionalInteger(centrifugeDurationMin),
    [centrifugeDurationMin],
  );
  const parsedCentrifugeResuspensionVolumeMl = useMemo(
    () => parseOptionalNumber(centrifugeResuspensionVolumeMl),
    [centrifugeResuspensionVolumeMl],
  );
  const parsedStrawCount = useMemo(() => parseOptionalInteger(strawCount), [strawCount]);
  const parsedStrawVolumeMl = useMemo(() => parseOptionalNumber(strawVolumeMl), [strawVolumeMl]);
  const parsedConcentrationMillionsPerMl = useMemo(
    () => parseOptionalNumber(concentrationMillionsPerMl),
    [concentrationMillionsPerMl],
  );
  const parsedStrawsPerDose = useMemo(
    () => parseOptionalInteger(strawsPerDose),
    [strawsPerDose],
  );
  const parsedPostThawMotilityPercent = useMemo(
    () => parseOptionalNumber(postThawMotilityPercent),
    [postThawMotilityPercent],
  );
  const parsedLongevityHours = useMemo(
    () => parseOptionalNumber(longevityHours),
    [longevityHours],
  );

  const totalSpermPerStrawMillions = useMemo(
    () =>
      computeTotalSpermPerStrawMillions(
        parsedConcentrationMillionsPerMl,
        parsedStrawVolumeMl,
      ),
    [parsedConcentrationMillionsPerMl, parsedStrawVolumeMl],
  );

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {
      freezeDate:
        validateLocalDate(freezeDate, 'Freeze date', true) ??
        validateLocalDateNotInFuture(freezeDate) ??
        undefined,
      rawSemenVolumeUsedMl:
        validateLinkedFrozenRawVolume(
          parsedRawSemenVolumeUsedMl,
          linkedCollectionId,
        ) ?? undefined,
      extenderOther:
        validateOtherSelection(extender, extenderOther, 'Extender') ?? undefined,
      strawColorOther:
        validateOtherSelection(strawColor, strawColorOther, 'Straw color') ??
        undefined,
      postThawMotilityPercent:
        validateOptionalDecimalRange(
          parsedPostThawMotilityPercent,
          'Post-thaw motility',
          0,
          100,
        ) ?? undefined,
      longevityHours:
        validateOptionalPositiveNumber(parsedLongevityHours, 'Longevity') ?? undefined,
    };

    if (!linkedCollectionId && !nextErrors.rawSemenVolumeUsedMl) {
      nextErrors.rawSemenVolumeUsedMl =
        validateOptionalPositiveNumber(
          parsedRawSemenVolumeUsedMl,
          'Raw semen volume used',
        ) ?? undefined;
    }

    if (parsedStrawCount == null) {
      nextErrors.strawCount = 'Straw count is required.';
    } else {
      nextErrors.strawCount =
        validateIntegerRange(parsedStrawCount, 'Straw count', 1, 100000) ??
        undefined;
    }

    if (parsedStrawVolumeMl == null) {
      nextErrors.strawVolumeMl = 'Straw volume is required.';
    } else {
      const rangeError = validateNumberRange(
        parsedStrawVolumeMl,
        'Straw volume',
        0,
        100000,
      );
      if (rangeError) {
        nextErrors.strawVolumeMl = rangeError;
      } else if (parsedStrawVolumeMl <= 0) {
        nextErrors.strawVolumeMl = 'Straw volume must be greater than zero.';
      }
    }

    nextErrors.concentrationMillionsPerMl =
      validateOptionalPositiveNumber(
        parsedConcentrationMillionsPerMl,
        'Concentration',
      ) ?? undefined;

    if (parsedStrawsPerDose != null) {
      const rangeError = validateIntegerRange(
        parsedStrawsPerDose,
        'Straws per dose',
        1,
        100000,
      );
      if (rangeError) {
        nextErrors.strawsPerDose = rangeError;
      } else if (
        parsedStrawCount != null &&
        !Number.isNaN(parsedStrawCount) &&
        parsedStrawsPerDose > parsedStrawCount
      ) {
        nextErrors.strawsPerDose = 'Straws per dose cannot exceed straw count.';
      } else {
        nextErrors.strawsPerDose = undefined;
      }
    } else {
      nextErrors.strawsPerDose = undefined;
    }

    if (wasCentrifuged) {
      nextErrors.centrifugeSpeedRpm =
        (parsedCentrifugeSpeedRpm == null
          ? 'Centrifuge speed is required.'
          : validateIntegerRange(
              parsedCentrifugeSpeedRpm,
              'Centrifuge speed',
              100,
              10000,
            )) ?? undefined;
      nextErrors.centrifugeDurationMin =
        (parsedCentrifugeDurationMin == null
          ? 'Centrifuge duration is required.'
          : validateIntegerRange(
              parsedCentrifugeDurationMin,
              'Centrifuge duration',
              1,
              600,
            )) ?? undefined;
      nextErrors.centrifugeCushionUsed =
        validateTriStateSelection(centrifugeCushionUsed, 'Cushion used', true) ??
        undefined;
      nextErrors.centrifugeResuspensionVolumeMl =
        validateOptionalPositiveNumber(
          parsedCentrifugeResuspensionVolumeMl,
          'Resuspension volume',
        ) ?? undefined;
    }

    return nextErrors;
  };

  const onSave = async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    if (
      parsedStrawCount == null ||
      Number.isNaN(parsedStrawCount) ||
      parsedStrawCount < 1 ||
      parsedStrawVolumeMl == null ||
      Number.isNaN(parsedStrawVolumeMl) ||
      parsedStrawVolumeMl <= 0
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await updateFrozenSemenBatch(frozenBatchId, {
        freezeDate: freezeDate.trim(),
        rawSemenVolumeUsedMl: toOptionalNumber(parsedRawSemenVolumeUsedMl),
        extender,
        extenderOther: toOptionalText(extenderOther),
        wasCentrifuged,
        centrifuge: {
          speedRpm: wasCentrifuged ? toOptionalInteger(parsedCentrifugeSpeedRpm) : null,
          durationMin: wasCentrifuged
            ? toOptionalInteger(parsedCentrifugeDurationMin)
            : null,
          cushionUsed: wasCentrifuged ? centrifugeCushionUsed : null,
          cushionType: wasCentrifuged ? toOptionalText(centrifugeCushionType) : null,
          resuspensionVolumeMl: wasCentrifuged
            ? toOptionalNumber(parsedCentrifugeResuspensionVolumeMl)
            : null,
          notes: wasCentrifuged ? toOptionalText(centrifugeNotes) : null,
        },
        strawCount: parsedStrawCount,
        strawVolumeMl: parsedStrawVolumeMl,
        concentrationMillionsPerMl: toOptionalNumber(parsedConcentrationMillionsPerMl),
        strawsPerDose: toOptionalInteger(parsedStrawsPerDose),
        strawColor,
        strawColorOther: toOptionalText(strawColorOther),
        strawLabel: toOptionalText(strawLabel),
        postThawMotilityPercent: toOptionalNumber(parsedPostThawMotilityPercent),
        longevityHours: toOptionalNumber(parsedLongevityHours),
        storageDetails: toOptionalText(storageDetails),
        notes: toOptionalText(notes),
      });

      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save frozen batch.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = (): void => {
    Alert.alert(
      'Delete Frozen Batch',
      'Are you sure you want to delete this frozen batch?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteFrozenSemenBatch(frozenBatchId);
                navigation.goBack();
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Unable to delete frozen batch.';
                Alert.alert('Delete error', message);
              }
            })();
          },
        },
      ],
    );
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
          <View style={cardStyles.card}>
            <Text style={styles.sectionTitle}>Source</Text>
            <CardRow
              label="Batch source"
              value={
                linkedCollectionDate
                  ? `From collection ${formatLocalDate(linkedCollectionDate, 'MM-DD-YYYY')}`
                  : 'Imported / standalone'
              }
            />
            <CardRow
              label="Straws remaining"
              value={strawsRemaining == null ? '-' : String(strawsRemaining)}
            />
            <CardRow
              label="Sperm per Straw (M)"
              value={formatSpermPerStraw(totalSpermPerStrawMillions)}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Basics</Text>
            <BasicsStep
              freezeDate={freezeDate}
              setFreezeDate={setFreezeDate}
              rawSemenVolumeUsedMl={rawSemenVolumeUsedMl}
              setRawSemenVolumeUsedMl={setRawSemenVolumeUsedMl}
              isLinkedToCollection={Boolean(linkedCollectionId)}
              wasCentrifuged={wasCentrifuged}
              setWasCentrifuged={setWasCentrifuged}
              centrifugeSpeedRpm={centrifugeSpeedRpm}
              setCentrifugeSpeedRpm={setCentrifugeSpeedRpm}
              centrifugeDurationMin={centrifugeDurationMin}
              setCentrifugeDurationMin={setCentrifugeDurationMin}
              centrifugeCushionUsed={centrifugeCushionUsed}
              setCentrifugeCushionUsed={setCentrifugeCushionUsed}
              centrifugeCushionType={centrifugeCushionType}
              setCentrifugeCushionType={setCentrifugeCushionType}
              centrifugeResuspensionVolumeMl={centrifugeResuspensionVolumeMl}
              setCentrifugeResuspensionVolumeMl={setCentrifugeResuspensionVolumeMl}
              centrifugeNotes={centrifugeNotes}
              setCentrifugeNotes={setCentrifugeNotes}
              errors={errors}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Straws & Extender</Text>
            <StrawsStep
              extender={extender}
              setExtender={setExtender}
              extenderOther={extenderOther}
              setExtenderOther={setExtenderOther}
              strawCount={strawCount}
              setStrawCount={setStrawCount}
              strawVolumeMl={strawVolumeMl}
              setStrawVolumeMl={setStrawVolumeMl}
              concentrationMillionsPerMl={concentrationMillionsPerMl}
              setConcentrationMillionsPerMl={setConcentrationMillionsPerMl}
              totalSpermPerStrawMillions={totalSpermPerStrawMillions}
              strawsPerDose={strawsPerDose}
              setStrawsPerDose={setStrawsPerDose}
              strawColor={strawColor}
              setStrawColor={setStrawColor}
              strawColorOther={strawColorOther}
              setStrawColorOther={setStrawColorOther}
              strawLabel={strawLabel}
              setStrawLabel={setStrawLabel}
              errors={errors}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Quality</Text>
            <QualityStep
              postThawMotilityPercent={postThawMotilityPercent}
              setPostThawMotilityPercent={setPostThawMotilityPercent}
              longevityHours={longevityHours}
              setLongevityHours={setLongevityHours}
              errors={errors}
            />
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Storage & Notes</Text>
            <StorageStep
              storageDetails={storageDetails}
              setStorageDetails={setStorageDetails}
              notes={notes}
              setNotes={setNotes}
            />
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label={isSaving ? 'Saving...' : 'Save Frozen Batch'}
              onPress={() => {
                void onSave();
              }}
              disabled={isSaving}
            />
            <DeleteButton
              label="Delete Frozen Batch"
              onPress={onDelete}
              disabled={isSaving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
