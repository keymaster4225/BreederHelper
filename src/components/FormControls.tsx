import { ReactNode, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { fromLocalDate, toLocalDate } from '@/utils/dates';

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
      placeholderTextColor="#8c959f"
    />
  );
}

type FormDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
};

export function FormDateInput({ value, onChange, placeholder = 'Select date', clearable }: FormDateInputProps): JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = useMemo(() => fromLocalDate(value) ?? new Date(), [value]);

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
        <Text style={value ? styles.dateValue : styles.datePlaceholder}>{value || placeholder}</Text>
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
  value: T;
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
    gap: 14,
    paddingBottom: 20,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#9bbcf3',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: '#1b1f24',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  dateWrap: {
    gap: 8,
  },
  dateValue: {
    color: '#1b1f24',
  },
  datePlaceholder: {
    color: '#8c959f',
  },
  clearButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearButtonText: {
    color: '#1b1f24',
    fontWeight: '600',
  },
  errorText: {
    color: '#b42318',
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionActive: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb',
  },
  optionText: {
    color: '#1b1f24',
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#ffffff',
  },
});
