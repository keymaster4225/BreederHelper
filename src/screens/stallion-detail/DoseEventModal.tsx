import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import {
  FormAutocompleteInput,
  FormDateInput,
  FormField,
  FormTextInput,
  formStyles,
} from '@/components/FormControls';
import {
  CollectionDoseEvent,
  CreateCollectionDoseEventInput,
  UpdateCollectionDoseEventInput,
  UUID,
} from '@/models/types';
import { createDoseEvent, updateDoseEvent } from '@/storage/repositories';
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

type DoseEventModalProps = {
  visible: boolean;
  collectionId: UUID;
  event?: CollectionDoseEvent;
  onSaved: () => void;
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
  doseCount?: string;
  doseSemenVolumeMl?: string;
  doseExtenderVolumeMl?: string;
};

function isFiniteNumber(value: number | null): value is number {
  return value != null && Number.isFinite(value);
}

function formatMl(value: number | null): string {
  return value == null ? 'Enter values to calculate' : `${value.toFixed(2)} mL`;
}

export function DoseEventModal({
  visible,
  collectionId,
  event,
  onSaved,
  onClose,
}: DoseEventModalProps): JSX.Element {
  const isEdit = event != null;
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
  const [doseCount, setDoseCount] = useState('');
  const [doseSemenVolumeMl, setDoseSemenVolumeMl] = useState('');
  const [doseExtenderVolumeMl, setDoseExtenderVolumeMl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setRecipient(event?.recipient ?? '');
    setRecipientPhone(event?.recipientPhone ?? '');
    setRecipientStreet(event?.recipientStreet ?? '');
    setRecipientCity(event?.recipientCity ?? '');
    setRecipientState(event?.recipientState ?? '');
    setRecipientZip(event?.recipientZip ?? '');
    setCarrierService(event?.carrierService ?? '');
    setContainerType(event?.containerType ?? '');
    setTrackingNumber(event?.trackingNumber ?? '');
    setEventDate(event?.eventDate ?? '');
    setDoseCount(event?.doseCount != null ? String(event.doseCount) : '');
    setDoseSemenVolumeMl(
      event?.doseSemenVolumeMl != null ? String(event.doseSemenVolumeMl) : '',
    );
    setDoseExtenderVolumeMl(
      event?.doseExtenderVolumeMl != null ? String(event.doseExtenderVolumeMl) : '',
    );
    setNotes(event?.notes ?? '');
    setErrors({});
    setIsSaving(false);
  }, [event, visible]);

  const totalPerDoseMl = useMemo(() => {
    const semen = parseOptionalNumber(doseSemenVolumeMl);
    const extender = parseOptionalNumber(doseExtenderVolumeMl);
    if (!isFiniteNumber(semen) || !isFiniteNumber(extender)) {
      return null;
    }
    return semen + extender;
  }, [doseExtenderVolumeMl, doseSemenVolumeMl]);

  const totalSemenUsedMl = useMemo(() => {
    const semen = parseOptionalNumber(doseSemenVolumeMl);
    const count = parseOptionalInteger(doseCount);
    if (!isFiniteNumber(semen) || !isFiniteNumber(count)) {
      return null;
    }
    return semen * count;
  }, [doseCount, doseSemenVolumeMl]);

  const totalExtenderUsedMl = useMemo(() => {
    const extender = parseOptionalNumber(doseExtenderVolumeMl);
    const count = parseOptionalInteger(doseCount);
    if (!isFiniteNumber(extender) || !isFiniteNumber(count)) {
      return null;
    }
    return extender * count;
  }, [doseCount, doseExtenderVolumeMl]);

  const validate = (): FormErrors => {
    const parsedDoseCount = parseOptionalInteger(doseCount);
    const parsedDoseSemenVolumeMl = parseOptionalNumber(doseSemenVolumeMl);
    const parsedDoseExtenderVolumeMl = parseOptionalNumber(doseExtenderVolumeMl);

    return {
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
      doseCount:
        parsedDoseCount == null
          ? 'Dose Count is required.'
          : validateNumberRange(parsedDoseCount, 'Dose Count', 1, 1000) ?? undefined,
      doseSemenVolumeMl:
        parsedDoseSemenVolumeMl == null
          ? 'Dose Semen Volume (mL) is required.'
          : validateNumberRange(
              parsedDoseSemenVolumeMl,
              'Dose Semen Volume (mL)',
              0.01,
              1000,
            ) ?? undefined,
      doseExtenderVolumeMl:
        parsedDoseExtenderVolumeMl == null
          ? 'Dose Extender Volume (mL) is required.'
          : validateNumberRange(
              parsedDoseExtenderVolumeMl,
              'Dose Extender Volume (mL)',
              0,
              1000,
            ) ?? undefined,
    };
  };

  const handleSave = async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    const parsedDoseCount = parseOptionalInteger(doseCount);
    const parsedDoseSemenVolumeMl = parseOptionalNumber(doseSemenVolumeMl);
    const parsedDoseExtenderVolumeMl = parseOptionalNumber(doseExtenderVolumeMl);

    if (
      !isFiniteNumber(parsedDoseCount) ||
      !isFiniteNumber(parsedDoseSemenVolumeMl) ||
      !isFiniteNumber(parsedDoseExtenderVolumeMl)
    ) {
      Alert.alert('Save error', 'Shipment dose values are invalid.');
      return;
    }

    setIsSaving(true);
    try {
      const baseInput: CreateCollectionDoseEventInput | UpdateCollectionDoseEventInput = {
        collectionId,
        eventType: 'shipped',
        recipient: recipient.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientStreet: recipientStreet.trim(),
        recipientCity: recipientCity.trim(),
        recipientState: recipientState.trim(),
        recipientZip: recipientZip.trim(),
        carrierService: carrierService.trim(),
        containerType: containerType.trim(),
        trackingNumber: trackingNumber.trim() || null,
        doseCount: parsedDoseCount,
        doseSemenVolumeMl: parsedDoseSemenVolumeMl,
        doseExtenderVolumeMl: parsedDoseExtenderVolumeMl,
        eventDate: eventDate.trim(),
        notes: notes.trim() || null,
      };

      if (event) {
        const createInput = baseInput as CreateCollectionDoseEventInput;
        const updateInput: UpdateCollectionDoseEventInput = {
          eventType: createInput.eventType,
          recipient: createInput.recipient,
          recipientPhone: createInput.recipientPhone,
          recipientStreet: createInput.recipientStreet,
          recipientCity: createInput.recipientCity,
          recipientState: createInput.recipientState,
          recipientZip: createInput.recipientZip,
          carrierService: createInput.carrierService,
          containerType: createInput.containerType,
          trackingNumber: createInput.trackingNumber,
          doseCount: createInput.doseCount,
          doseSemenVolumeMl: createInput.doseSemenVolumeMl,
          doseExtenderVolumeMl: createInput.doseExtenderVolumeMl,
          eventDate: createInput.eventDate,
          notes: createInput.notes,
        };
        await updateDoseEvent(event.id, updateInput);
      } else {
        await createDoseEvent(baseInput as CreateCollectionDoseEventInput);
      }

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save shipment.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
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
              <FormField label="Recipient Name" required error={errors.recipient}>
                <FormTextInput value={recipient} onChangeText={setRecipient} placeholder="Farm or clinic" />
              </FormField>

              <FormField label="Recipient Phone" required error={errors.recipientPhone}>
                <FormTextInput value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" />
              </FormField>

              <FormField label="Recipient Street" required error={errors.recipientStreet}>
                <FormTextInput value={recipientStreet} onChangeText={setRecipientStreet} />
              </FormField>

              <FormField label="Recipient City" required error={errors.recipientCity}>
                <FormTextInput value={recipientCity} onChangeText={setRecipientCity} />
              </FormField>

              <FormField label="Recipient State" required error={errors.recipientState}>
                <FormTextInput value={recipientState} onChangeText={setRecipientState} autoCapitalize="characters" />
              </FormField>

              <FormField label="Recipient ZIP" required error={errors.recipientZip}>
                <FormTextInput value={recipientZip} onChangeText={setRecipientZip} keyboardType="numeric" />
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
                <FormTextInput value={trackingNumber} onChangeText={setTrackingNumber} placeholder="Optional" />
              </FormField>

              <FormField label="Ship Date" required error={errors.eventDate}>
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

              <FormField label="Dose Semen Volume (mL)" required error={errors.doseSemenVolumeMl}>
                <FormTextInput
                  value={doseSemenVolumeMl}
                  onChangeText={setDoseSemenVolumeMl}
                  keyboardType="decimal-pad"
                />
              </FormField>

              <FormField label="Dose Extender Volume (mL)" required error={errors.doseExtenderVolumeMl}>
                <FormTextInput
                  value={doseExtenderVolumeMl}
                  onChangeText={setDoseExtenderVolumeMl}
                  keyboardType="decimal-pad"
                />
              </FormField>

              <View style={styles.totalsCard}>
                <Text style={styles.totalsHeading}>Shipment Totals</Text>
                <Text style={styles.totalsLine}>{`Per-dose total: ${formatMl(totalPerDoseMl)}`}</Text>
                <Text style={styles.totalsLine}>{`Total semen used: ${formatMl(totalSemenUsedMl)}`}</Text>
                <Text style={styles.totalsLine}>{`Total extender used: ${formatMl(totalExtenderUsedMl)}`}</Text>
              </View>

              <FormField label="Notes">
                <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
              </FormField>

              <View style={styles.actions}>
                <PrimaryButton
                  label={isEdit ? 'Update Shipment' : 'Save Shipment'}
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={isSaving}
                />
                <SecondaryButton label="Cancel" onPress={onClose} disabled={isSaving} />
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
  totalsCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  totalsHeading: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  totalsLine: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  actions: {
    gap: spacing.sm,
  },
});
