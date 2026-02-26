import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

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
