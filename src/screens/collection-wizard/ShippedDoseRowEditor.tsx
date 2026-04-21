import { useEffect, useState } from 'react';
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
  FormAutocompleteInput,
  FormDateInput,
  FormField,
  FormTextInput,
  formStyles,
} from '@/components/FormControls';
import { CollectionWizardShippedRow } from '@/hooks/useCollectionWizard';
import { borderRadius, colors, spacing } from '@/theme';
import { CARRIER_SERVICES, getCarrierServiceSuggestions } from '@/utils/carrierServices';
import { CONTAINER_TYPES, getContainerTypeSuggestions } from '@/utils/containerTypes';
import {
  parseOptionalInteger,
  validateLocalDate,
  validateLocalDateNotInFuture,
  validateNumberRange,
  validateRequired,
} from '@/utils/validation';

type Props = {
  visible: boolean;
  initialValue?: CollectionWizardShippedRow;
  defaultDate: string;
  onSave: (value: CollectionWizardShippedRow) => void;
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
};

export function ShippedDoseRowEditor({
  visible,
  initialValue,
  defaultDate,
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
  const [doseCount, setDoseCount] = useState('');
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
    setDoseCount(initialValue?.doseCount != null ? String(initialValue.doseCount) : '');
    setNotes(initialValue?.notes ?? '');
    setErrors({});
  }, [defaultDate, initialValue, visible]);

  const handleSave = (): void => {
    const parsedDoseCount = parseOptionalInteger(doseCount);
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
      doseCount: validateNumberRange(parsedDoseCount, 'Dose Count', 1, 1000) ?? undefined,
    };

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || parsedDoseCount == null) {
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

              <FormField label="Notes">
                <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
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
  actions: {
    gap: spacing.sm,
  },
});
