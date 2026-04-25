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
  FormAutocompleteInput,
  FormDateInput,
  FormField,
  FormTextInput,
  formStyles,
} from '@/components/FormControls';
import {
  CollectionWizardShippedRow,
  CollectionWizardShippedRowInput,
} from '@/hooks/useCollectionWizard';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { CARRIER_SERVICES, getCarrierServiceSuggestions } from '@/utils/carrierServices';
import { CONTAINER_TYPES, getContainerTypeSuggestions } from '@/utils/containerTypes';
import {
  parseOptionalInteger,
  parseOptionalNumber,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

type Props = {
  visible: boolean;
  initialValue?: CollectionWizardShippedRow;
  defaultDate: string;
  defaultDoseSemenVolumeMl?: number | null;
  defaultDoseExtenderVolumeMl?: number | null;
  onSave: (value: CollectionWizardShippedRowInput) => void;
  onClose: () => void;
};

type FormErrors = {
  recipient?: string;
  recipientPhone?: string;
  recipientStreet?: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  carrierService?: string;
  containerType?: string;
  eventDate?: string;
  doseSemenVolumeMl?: string;
  doseExtenderVolumeMl?: string;
  doseCount?: string;
};

function formatMlInput(value: number | null | undefined): string {
  if (value == null) {
    return '';
  }

  return Number(value.toFixed(2)).toString();
}

function formatMl(value: number): string {
  return `${value.toFixed(2)} mL`;
}

export function ShippedDoseRowEditor({
  visible,
  initialValue,
  defaultDate,
  defaultDoseSemenVolumeMl,
  defaultDoseExtenderVolumeMl,
  onSave,
  onClose,
}: Props): JSX.Element {
  const [recipient, setRecipient] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientStreet, setRecipientStreet] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientState, setRecipientState] = useState('');
  const [recipientZip, setRecipientZip] = useState('');
  const [carrierService, setCarrierService] = useState('');
  const [containerType, setContainerType] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [doseSemenVolumeMl, setDoseSemenVolumeMl] = useState('');
  const [doseExtenderVolumeMl, setDoseExtenderVolumeMl] = useState('');
  const [doseCount, setDoseCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    setRecipient(initialValue?.recipient ?? '');
    setRecipientPhone(initialValue?.recipientPhone ?? '');
    setRecipientStreet(initialValue?.recipientStreet ?? '');
    setRecipientCity(initialValue?.recipientCity ?? '');
    setRecipientState(initialValue?.recipientState ?? '');
    setRecipientZip(initialValue?.recipientZip ?? '');
    setCarrierService(initialValue?.carrierService ?? '');
    setContainerType(initialValue?.containerType ?? '');
    setTrackingNumber(initialValue?.trackingNumber ?? '');
    setEventDate(initialValue?.eventDate ?? defaultDate);
    setDoseSemenVolumeMl(
      initialValue
        ? formatMlInput(initialValue.doseSemenVolumeMl)
        : formatMlInput(defaultDoseSemenVolumeMl),
    );
    setDoseExtenderVolumeMl(
      initialValue
        ? formatMlInput(initialValue.doseExtenderVolumeMl)
        : formatMlInput(defaultDoseExtenderVolumeMl),
    );
    setDoseCount(initialValue?.doseCount != null ? String(initialValue.doseCount) : '1');
    setNotes(initialValue?.notes ?? '');
    setErrors({});
  }, [
    defaultDate,
    defaultDoseExtenderVolumeMl,
    defaultDoseSemenVolumeMl,
    initialValue,
    visible,
  ]);

  const parsedSemenVolume = useMemo(
    () => parseOptionalNumber(doseSemenVolumeMl),
    [doseSemenVolumeMl],
  );
  const parsedExtenderVolume = useMemo(
    () => parseOptionalNumber(doseExtenderVolumeMl),
    [doseExtenderVolumeMl],
  );
  const parsedDoseCount = useMemo(() => parseOptionalInteger(doseCount), [doseCount]);

  const totalPerDoseMl =
    parsedSemenVolume != null &&
    !Number.isNaN(parsedSemenVolume) &&
    parsedExtenderVolume != null &&
    !Number.isNaN(parsedExtenderVolume)
      ? parsedSemenVolume + parsedExtenderVolume
      : null;
  const totalSemenUsedMl =
    totalPerDoseMl != null &&
    parsedSemenVolume != null &&
    !Number.isNaN(parsedSemenVolume) &&
    parsedDoseCount != null &&
    !Number.isNaN(parsedDoseCount)
      ? parsedSemenVolume * parsedDoseCount
      : null;
  const totalExtenderUsedMl =
    totalPerDoseMl != null &&
    parsedExtenderVolume != null &&
    !Number.isNaN(parsedExtenderVolume) &&
    parsedDoseCount != null &&
    !Number.isNaN(parsedDoseCount)
      ? parsedExtenderVolume * parsedDoseCount
      : null;

  const handleSave = (): void => {
    const nextErrors: FormErrors = {
      recipient: validateRequired(recipient, 'Recipient name') ?? undefined,
      recipientPhone: validateRequired(recipientPhone, 'Recipient phone') ?? undefined,
      recipientStreet: validateRequired(recipientStreet, 'Recipient street') ?? undefined,
      recipientCity: validateRequired(recipientCity, 'Recipient city') ?? undefined,
      recipientState: validateRequired(recipientState, 'Recipient state') ?? undefined,
      recipientZip: validateRequired(recipientZip, 'Recipient ZIP') ?? undefined,
      carrierService: validateRequired(carrierService, 'Carrier/service') ?? undefined,
      containerType: validateRequired(containerType, 'Container type') ?? undefined,
      eventDate:
        validateLocalDate(eventDate, 'Ship date', true) ??
        validateLocalDateNotInFuture(eventDate) ??
        undefined,
      doseSemenVolumeMl:
        validateNumberRange(parsedSemenVolume, 'Dose semen volume', 0, 10000) ?? undefined,
      doseExtenderVolumeMl:
        validateNumberRange(parsedExtenderVolume, 'Dose extender volume', 0, 10000) ??
        undefined,
      doseCount: validateNumberRange(parsedDoseCount, 'Dose count', 1, 1000) ?? undefined,
    };

    if (parsedSemenVolume === 0) {
      nextErrors.doseSemenVolumeMl = 'Dose semen volume must be greater than 0.';
    }

    setErrors(nextErrors);

    if (
      Object.values(nextErrors).some(Boolean) ||
      parsedDoseCount == null ||
      parsedSemenVolume == null ||
      parsedExtenderVolume == null
    ) {
      return;
    }

    onSave({
      recipient: recipient.trim(),
      recipientPhone: recipientPhone.trim(),
      recipientStreet: recipientStreet.trim(),
      recipientCity: recipientCity.trim(),
      recipientState: recipientState.trim(),
      recipientZip: recipientZip.trim(),
      carrierService: carrierService.trim(),
      containerType: containerType.trim(),
      trackingNumber: trackingNumber.trim() || null,
      eventDate,
      doseSemenVolumeMl: parsedSemenVolume,
      doseExtenderVolumeMl: parsedExtenderVolume,
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
              <FormField label="Recipient Name" required error={errors.recipient}>
                <FormTextInput
                  value={recipient}
                  onChangeText={setRecipient}
                  placeholder="Farm or clinic"
                />
              </FormField>

              <FormField label="Recipient Phone" required error={errors.recipientPhone}>
                <FormTextInput
                  value={recipientPhone}
                  onChangeText={setRecipientPhone}
                  keyboardType="phone-pad"
                />
              </FormField>

              <FormField label="Recipient Street" required error={errors.recipientStreet}>
                <FormTextInput value={recipientStreet} onChangeText={setRecipientStreet} />
              </FormField>

              <FormField label="Recipient City" required error={errors.recipientCity}>
                <FormTextInput value={recipientCity} onChangeText={setRecipientCity} />
              </FormField>

              <FormField label="Recipient State" required error={errors.recipientState}>
                <FormTextInput
                  value={recipientState}
                  onChangeText={setRecipientState}
                  autoCapitalize="characters"
                />
              </FormField>

              <FormField label="Recipient ZIP" required error={errors.recipientZip}>
                <FormTextInput
                  value={recipientZip}
                  onChangeText={setRecipientZip}
                  keyboardType="numeric"
                />
              </FormField>

              <FormField label="Carrier / Service" required error={errors.carrierService}>
                <FormAutocompleteInput
                  value={carrierService}
                  onChangeText={setCarrierService}
                  options={CARRIER_SERVICES}
                  getSuggestions={getCarrierServiceSuggestions}
                  placeholder="Type or choose a carrier"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </FormField>

              <FormField label="Container Type" required error={errors.containerType}>
                <FormAutocompleteInput
                  value={containerType}
                  onChangeText={setContainerType}
                  options={CONTAINER_TYPES}
                  getSuggestions={getContainerTypeSuggestions}
                  placeholder="Type or choose a container"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </FormField>

              <FormField label="Tracking Number">
                <FormTextInput
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                />
              </FormField>

              <FormField label="Ship Date" required error={errors.eventDate}>
                <FormDateInput
                  value={eventDate}
                  onChange={setEventDate}
                  maximumDate={new Date()}
                  displayFormat="MM-DD-YYYY"
                />
              </FormField>

              <FormField
                label="Dose Semen Volume (mL)"
                required
                error={errors.doseSemenVolumeMl}
              >
                <FormTextInput
                  value={doseSemenVolumeMl}
                  onChangeText={setDoseSemenVolumeMl}
                  keyboardType="numeric"
                />
              </FormField>

              <FormField
                label="Dose Extender Volume (mL)"
                required
                error={errors.doseExtenderVolumeMl}
              >
                <FormTextInput
                  value={doseExtenderVolumeMl}
                  onChangeText={setDoseExtenderVolumeMl}
                  keyboardType="numeric"
                />
              </FormField>

              <FormField label="Dose Count" required error={errors.doseCount}>
                <FormTextInput
                  value={doseCount}
                  onChangeText={setDoseCount}
                  keyboardType="numeric"
                />
              </FormField>

              {totalPerDoseMl != null &&
              totalSemenUsedMl != null &&
              totalExtenderUsedMl != null ? (
                <View style={cardStyles.card}>
                  <Text style={styles.summaryTitle}>Row Totals</Text>
                  <CardRow label="Total Per Dose" value={formatMl(totalPerDoseMl)} />
                  <CardRow label="Total Semen Used" value={formatMl(totalSemenUsedMl)} />
                  <CardRow label="Total Extender Used" value={formatMl(totalExtenderUsedMl)} />
                </View>
              ) : null}

              <FormField label="Notes">
                <FormTextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </FormField>

              <View style={styles.actions}>
                <PrimaryButton
                  label={initialValue ? 'Update Shipment' : 'Save Shipment'}
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
  actions: {
    gap: spacing.sm,
  },
});
