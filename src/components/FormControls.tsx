import { ReactNode, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
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
};

export function FormDateInput({
  value,
  onChange,
  placeholder = 'Select date',
  clearable,
  displayFormat = 'YYYY-MM-DD',
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
      <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
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
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

type Option<T extends string> = {
  label: string;
  value: T;
};

type OptionSelectorProps<T extends string> = {
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function OptionSelector<T extends string>({ value, options, onChange }: OptionSelectorProps<T>): JSX.Element {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, active ? styles.optionActive : null]}
          >
            <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const formStyles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.primaryContainer,
  },
  saveButtonText: {
    color: colors.onPrimary,
    ...typography.labelLarge,
  },
});

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.onSurface,
    ...typography.labelLarge,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
});
