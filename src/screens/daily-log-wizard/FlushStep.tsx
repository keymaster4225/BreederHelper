import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  type DailyLogWizardFlushDraft,
  type DailyLogWizardFlushProductDraft,
} from '@/hooks/useDailyLogWizard';
import { FormField, FormTextInput } from '@/components/FormControls';
import { cardStyles } from '@/components/RecordCardParts';
import { borderRadius, colors, spacing, typography } from '@/theme';

type Props = {
  flush: DailyLogWizardFlushDraft;
  errors: {
    baseSolution?: string;
    totalVolumeMl?: string;
    products?: string;
  };
  onBaseSolutionChange: (value: string) => void;
  onTotalVolumeMlChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAddProduct: () => void;
  onUpdateProduct: (
    clientId: string,
    patch: Partial<Pick<DailyLogWizardFlushProductDraft, 'dose' | 'notes' | 'productName'>>,
  ) => void;
  onRemoveProduct: (clientId: string) => void;
};

export function FlushStep({
  flush,
  errors,
  onBaseSolutionChange,
  onTotalVolumeMlChange,
  onNotesChange,
  onAddProduct,
  onUpdateProduct,
  onRemoveProduct,
}: Props): JSX.Element {
  return (
    <>
      <FormField label="Base Solution" required error={errors.baseSolution}>
        <FormTextInput
          value={flush.baseSolution}
          onChangeText={onBaseSolutionChange}
          placeholder="e.g., Lactated Ringers"
        />
      </FormField>

      <FormField label="Total Volume (mL)" required error={errors.totalVolumeMl}>
        <FormTextInput
          value={flush.totalVolumeMl}
          onChangeText={onTotalVolumeMlChange}
          placeholder="e.g., 500"
          keyboardType="decimal-pad"
        />
      </FormField>

      <FormField label="Flush Products" required error={errors.products}>
        <View style={styles.products}>
          {flush.products.map((product, index) => (
            <View key={product.clientId} style={cardStyles.card}>
              <View style={styles.productHeader}>
                <Text style={styles.productTitle}>{`Product ${index + 1}`}</Text>
                {flush.products.length > 1 ? (
                  <Pressable
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                    onPress={() => onRemoveProduct(product.clientId)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <FormField label="Product" required>
                <FormTextInput
                  value={product.productName}
                  onChangeText={(value) => onUpdateProduct(product.clientId, { productName: value })}
                  placeholder="Product name"
                />
              </FormField>

              <FormField label="Dose" required>
                <FormTextInput
                  value={product.dose}
                  onChangeText={(value) => onUpdateProduct(product.clientId, { dose: value })}
                  placeholder="e.g., 20 mL"
                />
              </FormField>

              <FormField label="Product Notes">
                <FormTextInput
                  value={product.notes}
                  onChangeText={(value) => onUpdateProduct(product.clientId, { notes: value })}
                  placeholder="Notes"
                  multiline
                />
              </FormField>
            </View>
          ))}

          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={onAddProduct}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>Add Product</Text>
          </Pressable>
        </View>
      </FormField>

      <FormField label="Flush Notes">
        <FormTextInput
          value={flush.notes}
          onChangeText={onNotesChange}
          placeholder="Procedure notes"
          multiline
        />
      </FormField>
    </>
  );
}

const styles = StyleSheet.create({
  products: {
    gap: spacing.md,
  },
  productHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  removeButton: {
    borderColor: colors.error,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  removeButtonText: {
    ...typography.labelSmall,
    color: colors.error,
  },
  addButton: {
    alignItems: 'center',
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  addButtonText: {
    ...typography.labelMedium,
    color: colors.onSurface,
  },
  pressed: {
    opacity: 0.7,
  },
});
