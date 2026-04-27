import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { CardRow, cardStyles } from '@/components/RecordCardParts';
import {
  FormDateInput,
  FormField,
  FormPickerInput,
  FormTextInput,
  FormTimeInput,
  formStyles,
} from '@/components/FormControls';
import {
  CollectionWizardOnFarmRow,
  CollectionWizardOnFarmRowInput,
} from '@/hooks/useCollectionWizard';
import { Mare } from '@/models/types';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { normalizeBreedingRecordTime } from '@/utils/breedingRecordTime';
import { getCurrentTimeHHMM } from '@/utils/dailyLogTime';
import { toLocalDate } from '@/utils/dates';
import {
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
} from '@/utils/validation';

type Props = {
  visible: boolean;
  initialValue?: CollectionWizardOnFarmRow;
  defaultDate: string;
  defaultDoseSemenVolumeMl?: number | null;
  availableMares: readonly Mare[];
  onSave: (value: CollectionWizardOnFarmRowInput) => void;
  onClose: () => void;
};

type FormErrors = {
  mareId?: string;
  eventDate?: string;
  eventTime?: string;
  doseSemenVolumeMl?: string;
};

function formatMlInput(value: number | null | undefined): string {
  if (value == null) {
    return '';
  }

  return Number(value.toFixed(2)).toString();
}

export function OnFarmMareRowEditor({
  visible,
  initialValue,
  defaultDate,
  defaultDoseSemenVolumeMl,
  availableMares,
  onSave,
  onClose,
}: Props): JSX.Element {
  const [mareId, setMareId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [doseSemenVolumeMl, setDoseSemenVolumeMl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    setMareId(initialValue?.mareId ?? '');
    const nextEventDate = initialValue?.eventDate ?? defaultDate;
    setEventDate(nextEventDate);
    setEventTime(
      initialValue?.eventTime ??
        (nextEventDate === toLocalDate(new Date()) ? getCurrentTimeHHMM() : ''),
    );
    setDoseSemenVolumeMl(
      initialValue
        ? formatMlInput(initialValue.doseSemenVolumeMl)
        : formatMlInput(defaultDoseSemenVolumeMl),
    );
    setNotes(initialValue?.notes ?? '');
    setErrors({});
  }, [defaultDate, defaultDoseSemenVolumeMl, initialValue, visible]);

  const mareOptions = useMemo(
    () => availableMares.map((mare) => ({ label: mare.name, value: mare.id })),
    [availableMares],
  );

  const parsedDoseSemenVolumeMl = useMemo(
    () => parseOptionalNumber(doseSemenVolumeMl),
    [doseSemenVolumeMl],
  );

  const handleSave = (): void => {
    const parsedEventTime = normalizeBreedingRecordTime(eventTime);
    const nextErrors: FormErrors = {
      mareId: mareId ? undefined : 'Please select a mare.',
      eventDate:
        validateLocalDate(eventDate, 'Breeding date', true) ??
        validateLocalDateNotInFuture(eventDate) ??
        undefined,
      eventTime: parsedEventTime == null ? 'Breeding time is required.' : undefined,
      doseSemenVolumeMl:
        validateNumberRange(
          parsedDoseSemenVolumeMl,
          'Dose semen volume',
          0,
          10000,
        ) ?? undefined,
    };

    if (parsedDoseSemenVolumeMl === 0) {
      nextErrors.doseSemenVolumeMl = 'Dose semen volume must be greater than 0 when entered.';
    }

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    onSave({
      mareId,
      eventDate,
      eventTime: parsedEventTime!,
      doseSemenVolumeMl: parsedDoseSemenVolumeMl,
      doseCount: 1,
      notes: notes.trim() || null,
    });
  };

  const handleEventDateChange = (nextEventDate: string): void => {
    const today = toLocalDate(new Date());
    setEventDate(nextEventDate);

    if (initialValue) {
      return;
    }

    if (nextEventDate === today && eventTime === '') {
      setEventTime(getCurrentTimeHHMM());
      return;
    }

    if (eventDate === today && nextEventDate !== today) {
      setEventTime('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centered}
        >
          <Pressable style={styles.sheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <ScrollView
              contentContainerStyle={[formStyles.form, styles.formContent]}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <FormField label="Mare" required error={errors.mareId}>
                <FormPickerInput
                  value={mareId}
                  onChange={setMareId}
                  options={mareOptions}
                  placeholder={
                    availableMares.length === 0 ? 'No mares available' : 'Select mare'
                  }
                />
              </FormField>

              <FormField label="Breeding Date" required error={errors.eventDate}>
                <FormDateInput
                  value={eventDate}
                  onChange={handleEventDateChange}
                  maximumDate={new Date()}
                  displayFormat="MM-DD-YYYY"
                />
              </FormField>

              <FormField label="Breeding Time" required error={errors.eventTime}>
                <FormTimeInput
                  value={eventTime}
                  onChange={setEventTime}
                  placeholder="Select breeding time"
                  accessibilityLabel="Select on-farm breeding time"
                />
              </FormField>

              <FormField label="Dose Semen Volume (mL)" error={errors.doseSemenVolumeMl}>
                <FormTextInput
                  value={doseSemenVolumeMl}
                  onChangeText={setDoseSemenVolumeMl}
                  keyboardType="numeric"
                />
              </FormField>

              <View style={cardStyles.card}>
                <Text style={styles.summaryTitle}>On-Farm Summary</Text>
                {parsedDoseSemenVolumeMl == null || Number.isNaN(parsedDoseSemenVolumeMl) ? (
                  <Text style={styles.emptyText}>Semen volume not recorded.</Text>
                ) : (
                  <CardRow
                    label="Semen Used"
                    value={`${parsedDoseSemenVolumeMl.toFixed(2)} mL`}
                  />
                )}
              </View>

              <FormField label="Notes">
                <FormTextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </FormField>

              <View style={styles.actions}>
                <PrimaryButton
                  label={initialValue ? 'Update On-Farm Allocation' : 'Save On-Farm Allocation'}
                  onPress={handleSave}
                />
                <SecondaryButton label="Cancel" onPress={onClose} />
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxHeight: '92%',
    padding: spacing.lg,
  },
  formContent: {
    paddingBottom: spacing.sm,
  },
  summaryTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  actions: {
    gap: spacing.sm,
  },
});
