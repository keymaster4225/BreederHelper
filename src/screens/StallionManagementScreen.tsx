import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { DeleteButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { Stallion } from '@/models/types';
import {
  createStallion,
  listStallions,
  softDeleteStallion,
  updateStallion,
} from '@/storage/repositories';
import { borderRadius, colors, elevation, spacing, typography } from '@/theme';
import { newId } from '@/utils/id';
import { validateRequired } from '@/utils/validation';

type FormErrors = {
  name?: string;
};

export function StallionManagementScreen(): JSX.Element {
  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStallionId, setEditingStallionId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const loadStallions = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await listStallions();
      setStallions(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stallions.';
      Alert.alert('Load error', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStallions();
    }, [loadStallions])
  );

  const clearForm = (): void => {
    setEditingStallionId(null);
    setName('');
    setBreed('');
    setSire('');
    setDam('');
    setNotes('');
    setErrors({});
  };

  const startEdit = (stallion: Stallion): void => {
    setEditingStallionId(stallion.id);
    setName(stallion.name);
    setBreed(stallion.breed ?? '');
    setSire(stallion.sire ?? '');
    setDam(stallion.dam ?? '');
    setNotes(stallion.notes ?? '');
    setErrors({});
  };

  const onSave = async (): Promise<void> => {
    const nameError = validateRequired(name, 'Name') ?? undefined;
    setErrors({ name: nameError });
    if (nameError) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingStallionId) {
        await updateStallion(editingStallionId, {
          name: name.trim(),
          breed: breed.trim() || null,
          sire: sire.trim() || null,
          dam: dam.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await createStallion({
          id: newId(),
          name: name.trim(),
          breed: breed.trim() || null,
          sire: sire.trim() || null,
          dam: dam.trim() || null,
          notes: notes.trim() || null,
        });
      }

      clearForm();
      await loadStallions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save stallion.';
      Alert.alert('Save error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (stallion: Stallion): void => {
    Alert.alert(
      'Delete Stallion',
      `Delete ${stallion.name}? Existing breeding records will prevent deletion.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await softDeleteStallion(stallion.id);
                if (editingStallionId === stallion.id) {
                  clearForm();
                }
                await loadStallions();
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unable to delete stallion.';
                Alert.alert('Delete error', message);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={formStyles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>{editingStallionId ? 'Edit Stallion' : 'Add Stallion'}</Text>

        <FormField label="Name" required error={errors.name}>
          <FormTextInput value={name} onChangeText={setName} placeholder="Stallion name" />
        </FormField>

        <FormField label="Breed">
          <FormTextInput value={breed} onChangeText={setBreed} placeholder="Optional" />
        </FormField>

        <FormField label="Sire">
          <FormTextInput value={sire} onChangeText={setSire} placeholder="Optional" />
        </FormField>

        <FormField label="Dam">
          <FormTextInput value={dam} onChangeText={setDam} placeholder="Optional" />
        </FormField>

        <FormField label="Notes">
          <FormTextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
        </FormField>

        <View style={styles.actionRow}>
          <PrimaryButton
            label={editingStallionId ? 'Update Stallion' : 'Add Stallion'}
            onPress={() => {
              void onSave();
            }}
            disabled={isSaving}
          />

          {editingStallionId ? (
            <SecondaryButton label="Cancel" onPress={clearForm} />
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Stallions</Text>
        {isLoading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
        {!isLoading && stallions.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="horse-variant" size={56} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyHeading}>No stallions yet</Text>
            <Text style={styles.emptySubtitle}>Add stallions to reference in breeding records.</Text>
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {stallions.map((stallion) => (
            <View key={stallion.id} style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{stallion.name}</Text>
                <Text style={styles.cardMeta}>Breed: {stallion.breed || '-'}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={({ pressed }) => [styles.inlineButton, pressed && styles.inlineButtonPressed]}
                  onPress={() => startEdit(stallion)}
                >
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </Pressable>
                <DeleteButton label="Delete" onPress={() => confirmDelete(stallion)} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.onSurface,
    ...typography.titleMedium,
  },
  listWrap: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    ...elevation.level1,
  },
  cardMain: {
    flex: 1,
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  cardTitle: {
    ...typography.titleSmall,
  },
  cardMeta: {
    color: colors.onSurfaceVariant,
    ...typography.bodySmall,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineButton: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineButtonText: {
    color: colors.onSurface,
    ...typography.labelMedium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    ...typography.bodyMedium,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyHeading: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  inlineButtonPressed: {
    opacity: 0.7,
  },
});
