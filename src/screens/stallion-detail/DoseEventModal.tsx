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
import { useDoseEventForm } from '@/hooks/useDoseEventForm';
import {
  FormAutocompleteInput,
  FormDateInput,
  FormField,
  FormTextInput,
  formStyles,
} from '@/components/FormControls';
import { CollectionDoseEvent, UUID } from '@/models/types';
import { borderRadius, colors, spacing, typography } from '@/theme';

type DoseEventModalProps = {
  visible: boolean;
  collectionId: UUID;
  event?: CollectionDoseEvent;
  onSaved: () => void;
  onClose: () => void;
};

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
  const {
    isEdit,
    isSaving,
    recipient,
    recipientPhone,
    recipientStreet,
    recipientCity,
    recipientState,
    recipientZip,
    carrierService,
    containerType,
    trackingNumber,
    eventDate,
    doseCount,
    doseSemenVolumeMl,
    doseExtenderVolumeMl,
    notes,
    errors,
    totalPerDoseMl,
    totalSemenUsedMl,
    totalExtenderUsedMl,
    carrierServiceOptions,
    getCarrierServiceSuggestions,
    containerTypeOptions,
    getContainerTypeSuggestions,
    setRecipient,
    setRecipientPhone,
    setRecipientStreet,
    setRecipientCity,
    setRecipientState,
    setRecipientZip,
    setCarrierService,
    setContainerType,
    setTrackingNumber,
    setEventDate,
    setDoseCount,
    setDoseSemenVolumeMl,
    setDoseExtenderVolumeMl,
    setNotes,
    handleSave,
  } = useDoseEventForm({
    visible,
    collectionId,
    event,
    onSaved,
    onClose,
  });

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
                  options={carrierServiceOptions}
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
                  options={containerTypeOptions}
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
