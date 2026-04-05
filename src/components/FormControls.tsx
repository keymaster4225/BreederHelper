import { ReactNode, useMemo, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { formatLocalDate, fromLocalDate, toLocalDate } from '@/utils/dates';
import { borderRadius, colors, spacing, typography } from '@/theme';

type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
};

export function FormField({ label, required, error, children }: FormFieldProps): JSX.Element {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

type FormTextInputProps = TextInputProps & {
  multiline?: boolean;
};

export function FormTextInput({ multiline, style, ...rest }: FormTextInputProps): JSX.Element {
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      style={[styles.input, multiline ? styles.notesInput : null, style]}
      placeholderTextColor={colors.onSurfaceVariant}
    />
  );
}

type FormDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  displayFormat?: 'YYYY-MM-DD' | 'MM-DD-YYYY';
  maximumDate?: Date;
};

export function FormDateInput({
  value,
  onChange,
  placeholder = 'Select date',
  clearable,
  displayFormat = 'YYYY-MM-DD',
  maximumDate,
}: FormDateInputProps): JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = useMemo(() => fromLocalDate(value) ?? new Date(), [value]);
  const displayValue = useMemo(() => formatLocalDate(value, displayFormat), [displayFormat, value]);

  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date): void => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type !== 'set' || !selectedDate) {
      return;
    }

    onChange(toLocalDate(selectedDate));
  };

  return (
    <View style={styles.dateWrap}>
      <Pressable style={styles.input} onPress={() => { Keyboard.dismiss(); setShowPicker(true); }} accessibilityRole="button">
        <Text style={displayValue ? styles.dateValue : styles.datePlaceholder}>
          {displayValue || placeholder}
        </Text>
      </Pressable>
      {clearable && value ? (
        <Pressable style={styles.clearButton} onPress={() => onChange('')}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximumDate}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

type PickerOption = {
  label: string;
  value: string;
};

type FormPickerInputProps = {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  onShowAll?: () => void;
  showAllLabel?: string;
};

export function FormPickerInput({
  value,
  onChange,
  options,
  placeholder = 'Select\u2026',
  onShowAll,
  showAllLabel = 'Show all',
}: FormPickerInputProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? (value || null);

  return (
    <>
      <Pressable
        style={styles.input}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={selectedLabel ? styles.dateValue : styles.datePlaceholder}>
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <ScrollView bounces={false}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [styles.modalOption, pressed && styles.modalOptionPressed]}
                  onPress={() => { onChange(option.value); setOpen(false); }}
                >
                  <Text style={[styles.modalOptionText, option.value === value && styles.modalOptionTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              {onShowAll ? (
                <Pressable
                  style={({ pressed }) => [styles.modalOption, pressed && styles.modalOptionPressed]}
                  onPress={() => { onShowAll(); setOpen(false); }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.primary }]}>
                    {showAllLabel}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type FormSelectInputProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
};

export function FormSelectInput({
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: FormSelectInputProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.input}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={value ? styles.dateValue : styles.datePlaceholder}>
          {value || placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <ScrollView bounces={false}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  style={({ pressed }) => [styles.modalOption, pressed && styles.modalOptionPressed]}
                  onPress={() => { onChange(option); setOpen(false); }}
                >
                  <Text style={[styles.modalOptionText, option === value && styles.modalOptionTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type Option<T extends string> = {
  label: string;
  value: T;
};

type OptionSelectorBaseProps<T extends string> = {
  value: T | null;
  options: Option<T>[];
};

type OptionSelectorProps<T extends string> = OptionSelectorBaseProps<T> & (
  | { allowDeselect?: false; onChange: (value: T) => void }
  | { allowDeselect: true; onChange: (value: T | null) => void }
);

export function OptionSelector<T extends string>(props: OptionSelectorProps<T>): JSX.Element {
  const { value, options } = props;
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (props.allowDeselect && active) {
                (props.onChange as (value: T | null) => void)(null);
              } else {
                props.onChange(option.value);
              }
            }}
            style={[styles.option, active ? styles.optionActive : null]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type FormCheckboxProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function FormCheckbox({ label, value, onChange }: FormCheckboxProps): JSX.Element {
  return (
    <Pressable
      style={checkboxStyles.row}
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <View style={[checkboxStyles.box, value ? checkboxStyles.boxChecked : null]}>
        {value ? <Text style={checkboxStyles.checkmark}>✓</Text> : null}
      </View>
      <Text style={checkboxStyles.label}>{label}</Text>
    </Pressable>
  );
}

const checkboxStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.sm,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    color: colors.onSurface,
    ...typography.labelLarge,
  },
});

export const formStyles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
});

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    color: colors.onSurface,
    ...typography.labelLarge,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center' as const,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  dateWrap: {
    gap: spacing.sm,
  },
  dateValue: {
    color: colors.onSurface,
  },
  datePlaceholder: {
    color: colors.onSurfaceVariant,
  },
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  errorText: {
    color: colors.error,
    ...typography.bodySmall,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  optionTextActive: {
    color: colors.onPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    maxHeight: 360,
    overflow: 'hidden',
  },
  modalOption: {
    minHeight: 48,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalOptionPressed: {
    backgroundColor: colors.surfaceVariant,
  },
  modalOptionText: {
    color: colors.onSurface,
    ...typography.bodyLarge,
  },
  modalOptionTextActive: {
    color: colors.primary,
    ...typography.labelLarge,
  },
});
