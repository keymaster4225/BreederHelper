import { useEffect, useState } from 'react';
import {
  Alert,
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
  FormTextInput,
  OptionSelector,
  formStyles,
} from '@/components/FormControls';
import {
  CollectionDoseEvent,
  CreateCollectionDoseEventInput,
  DoseEventType,
  UpdateCollectionDoseEventInput,
  UUID,
} from '@/models/types';
import { createDoseEvent, updateDoseEvent } from '@/storage/repositories';
import { borderRadius, colors, spacing } from '@/theme';
import {
  parseOptionalInteger,
  validateLocalDate,
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
  eventDate?: string;
  doseCount?: string;
};

const EVENT_TYPE_OPTIONS: Array<{ label: string; value: DoseEventType }> = [
  { label: 'Shipped', value: 'shipped' },
  { label: 'Used on site', value: 'usedOnSite' },
];

export function DoseEventModal({
  visible,
  collectionId,
  event,
  onSaved,
  onClose,
}: DoseEventModalProps): JSX.Element {
  const isEdit = event != null;
  const [eventType, setEventType] = useState<DoseEventType>('shipped');
  const [recipient, setRecipient] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [doseCount, setDoseCount] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setEventType(event?.eventType ?? 'shipped');
    setRecipient(event?.recipient ?? '');
    setEventDate(event?.eventDate ?? '');
    setDoseCount(event?.doseCount != null ? String(event.doseCount) : '');
    setNotes(event?.notes ?? '');
    setErrors({});
    setIsSaving(false);
  }, [event, visible]);

  const recipientLabel = eventType === 'shipped' ? 'Recipient' : 'Used For / Recipient';

  const validate = (): FormErrors => {
    const parsedDoseCount = parseOptionalInteger(doseCount);

    return {
      recipient: validateRequired(recipient, recipientLabel) ?? undefined,
      eventDate: validateLocalDate(eventDate, 'Event Date') ?? undefined,
      doseCount: validateNumberRange(parsedDoseCount, 'Dose Count', 1, 1000) ?? undefined,
    };
  };

  const handleSave = async (): Promise<void> => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsSaving(true);
    try {
      const baseInput: CreateCollectionDoseEventInput | UpdateCollectionDoseEventInput = {
        collectionId,
        eventType,
        recipient: recipient.trim(),
        doseCount: parseOptionalInteger(doseCount),
        eventDate: eventDate.trim() || null,
        notes: notes.trim() || null,
      };

      if (event) {
        const createInput = baseInput as CreateCollectionDoseEventInput;
        const updateInput: UpdateCollectionDoseEventInput = {
          eventType: createInput.eventType,
          recipient: createInput.recipient,
          doseCount: createInput.doseCount,
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
      const message = err instanceof Error ? err.message : 'Failed to save dose event.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
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
              <FormField label="Event Type" required>
                <OptionSelector value={eventType} onChange={setEventType} options={EVENT_TYPE_OPTIONS} />
              </FormField>

              <FormField label={recipientLabel} required error={errors.recipient}>
                <FormTextInput
                  value={recipient}
                  onChangeText={setRecipient}
                  placeholder={eventType === 'shipped' ? 'Farm, clinic, or recipient' : 'Mare, procedure, or notes'}
                />
              </FormField>

              <FormField label="Event Date" error={errors.eventDate}>
                <FormDateInput
                  value={eventDate}
                  onChange={setEventDate}
                  clearable
                  maximumDate={new Date()}
                  displayFormat="MM-DD-YYYY"
                />
              </FormField>

              <FormField label="Dose Count" error={errors.doseCount}>
                <FormTextInput
                  value={doseCount}
                  onChangeText={setDoseCount}
                  placeholder="Optional"
                  keyboardType="numeric"
                />
              </FormField>

              <FormField label="Notes">
                <FormTextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Optional"
                />
              </FormField>

              <View style={styles.actions}>
                <PrimaryButton
                  label={isEdit ? 'Update Dose Event' : 'Save Dose Event'}
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
    maxHeight: '90%',
    padding: spacing.lg,
  },
  formContent: {
    paddingBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
