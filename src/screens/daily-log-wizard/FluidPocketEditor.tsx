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
import { FormField, FormPickerInput, FormTextInput, formStyles } from '@/components/FormControls';
import { FLUID_LOCATION_OPTIONS } from '@/models/enums';
import type { FluidLocation } from '@/models/types';
import { borderRadius, colors, spacing } from '@/theme';

type Props = {
  visible: boolean;
  initialValue?: {
    depthMm: number;
    location: FluidLocation;
  };
  onSave: (value: { depthMm: number; location: FluidLocation }) => void;
  onClose: () => void;
};

type FormErrors = {
  depthMm?: string;
  location?: string;
};

function parseDepth(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Number.NaN;
  }

  return parsed;
}

export function FluidPocketEditor({
  visible,
  initialValue,
  onSave,
  onClose,
}: Props): JSX.Element {
  const [depthMm, setDepthMm] = useState('');
  const [location, setLocation] = useState<FluidLocation | ''>('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    setDepthMm(initialValue ? String(initialValue.depthMm) : '');
    setLocation(initialValue?.location ?? '');
    setErrors({});
  }, [initialValue, visible]);

  const handleSave = (): void => {
    const parsedDepth = parseDepth(depthMm);

    const nextErrors: FormErrors = {
      depthMm:
        parsedDepth == null
          ? 'Depth is required.'
          : Number.isNaN(parsedDepth)
            ? 'Depth must be a positive whole number.'
            : undefined,
      location: location ? undefined : 'Location is required.',
    };

    setErrors(nextErrors);
    if (nextErrors.depthMm || nextErrors.location) {
      return;
    }

    onSave({
      depthMm: parsedDepth as number,
      location: location as FluidLocation,
    });
  };

  const locationOptions = useMemo(
    () => FLUID_LOCATION_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
    [],
  );

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
              <FormField label="Depth (mm)" required error={errors.depthMm}>
                <FormTextInput
                  value={depthMm}
                  onChangeText={setDepthMm}
                  keyboardType="numeric"
                  placeholder="e.g. 12"
                />
              </FormField>

              <FormField label="Location" required error={errors.location}>
                <FormPickerInput
                  value={location}
                  onChange={(value) => setLocation(value as FluidLocation)}
                  options={locationOptions}
                  placeholder="Select location"
                />
              </FormField>

              <View style={styles.actions}>
                <PrimaryButton
                  label={initialValue ? 'Update Pocket' : 'Add Pocket'}
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
