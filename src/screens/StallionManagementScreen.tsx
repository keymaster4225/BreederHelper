import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { FormField, FormTextInput, formStyles } from '@/components/FormControls';
import { Screen } from '@/components/Screen';
import { Stallion } from '@/models/types';
import {
  createStallion,
  listStallions,
  softDeleteStallion,
  updateStallion,
} from '@/storage/repositories';
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
          <Pressable
            disabled={isSaving}
            style={[formStyles.saveButton, styles.flexButton, isSaving ? formStyles.saveButtonDisabled : null]}
            onPress={() => {
              void onSave();
            }}
          >
            <Text style={formStyles.saveButtonText}>{isSaving ? 'Saving...' : editingStallionId ? 'Save Changes' : 'Add Stallion'}</Text>
          </Pressable>

          {editingStallionId ? (
            <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={clearForm}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Stallions</Text>
        {isLoading ? <Text>Loading stallions...</Text> : null}
        {!isLoading && stallions.length === 0 ? <Text>No stallions yet.</Text> : null}

        <View style={styles.listWrap}>
          {stallions.map((stallion) => (
            <View key={stallion.id} style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{stallion.name}</Text>
                <Text style={styles.cardMeta}>Breed: {stallion.breed || '-'}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.inlineButton} onPress={() => startEdit(stallion)}>
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => confirmDelete(stallion)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
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
    color: '#1b1f24',
    fontSize: 16,
    fontWeight: '700',
  },
  listWrap: {
    gap: 10,
    paddingBottom: 10,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  cardMain: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#57606a',
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineButtonText: {
    color: '#1b1f24',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ffe3e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  deleteButtonText: {
    color: '#b42318',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#d0d7de',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#1b1f24',
    fontWeight: '600',
  },
});
