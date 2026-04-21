import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import {
  FormDateInput,
  FormField,
  FormPickerInput,
  FormTextInput,
  formStyles,
} from '@/components/FormControls';
import { CollectionWizardOnFarmRow } from '@/hooks/useCollectionWizard';
import { Mare } from '@/models/types';
import { borderRadius, colors, spacing } from '@/theme';
import {
  parseOptionalInteger,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
} from '@/utils/validation';

type Props = {
  visible: boolean;
  initialValue?: CollectionWizardOnFarmRow;
  defaultDate: string;
  availableMares: readonly Mare[];
  onSave: (value: CollectionWizardOnFarmRow) => void;
  onClose: () => void;
};

type FormErrors = {
  mareId?: string;
  eventDate?: string;
  doseCount?: string;
};

export function OnFarmMareRowEditor({
  visible,
  initialValue,
  defaultDate,
  availableMares,
  onSave,
  onClose,
}: Props): JSX.Element {
  const [mareId, setMareId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [doseCount, setDoseCount] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    setMareId(initialValue?.mareId ?? '');
    setEventDate(initialValue?.eventDate ?? defaultDate);
    setDoseCount(initialValue?.doseCount != null ? String(initialValue.doseCount) : '');
    setNotes(initialValue?.notes ?? '');
    setErrors({});
  }, [defaultDate, initialValue, visible]);

  const mareOptions = useMemo(
    () => availableMares.map((mare) => ({ label: mare.name, value: mare.id })),
    [availableMares],
  );

  const handleSave = (): void => {
    const parsedDoseCount = parseOptionalInteger(doseCount);
    const nextErrors: FormErrors = {
      mareId: mareId ? undefined : 'Please select a mare.',
      eventDate:
        validateLocalDate(eventDate, 'Breeding date', true) ??
        validateLocalDateNotInFuture(eventDate) ??
        undefined,
      doseCount: validateNumberRange(parsedDoseCount, 'Dose Count', 1, 1000) ?? undefined,
    };

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || parsedDoseCount == null) {
      return;
    }

    onSave({
      mareId,
      eventDate,
      doseCount: parsedDoseCount,
      notes: notes.trim() || null,
    });
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
                  placeholder={availableMares.length === 0 ? 'No mares available' : 'Select mare'}
                />
              </FormField>

              <FormField label="Breeding Date" required error={errors.eventDate}>
                <FormDateInput
                  value={eventDate}
                  onChange={setEventDate}
                  maximumDate={new Date()}
                  displayFormat="MM-DD-YYYY"
                />
              </FormField>

              <FormField label="Dose Count" required error={errors.doseCount}>
                <FormTextInput value={doseCount} onChangeText={setDoseCount} keyboardType="numeric" />
              </FormField>

              <FormField label="Notes">
                <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
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
  actions: {
    gap: spacing.sm,
  },
});
