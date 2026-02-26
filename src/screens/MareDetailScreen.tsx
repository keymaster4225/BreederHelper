import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { BreedingRecord, DailyLog, FoalingRecord, Mare, PregnancyCheck, calculateDaysPostBreeding } from '@/models/types';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getMareById,
  listBreedingRecordsByMare,
  listDailyLogsByMare,
  listFoalingRecordsByMare,
  listPregnancyChecksByMare,
  listStallions,
} from '@/storage/repositories';
import { deriveAgeYears } from '@/utils/dates';

type Props = NativeStackScreenProps<RootStackParamList, 'MareDetail'>;
type DetailTab = 'dailyLogs' | 'breedingRecords' | 'pregnancyChecks' | 'foalingRecords';

const TAB_OPTIONS: { label: string; value: DetailTab }[] = [
  { label: 'Daily Logs', value: 'dailyLogs' },
  { label: 'Breeding', value: 'breedingRecords' },
  { label: 'Pregnancy', value: 'pregnancyChecks' },
  { label: 'Foaling', value: 'foalingRecords' },
];

export function MareDetailScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;

  const [mare, setMare] = useState<Mare | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyChecks, setPregnancyChecks] = useState<PregnancyCheck[]>([]);
  const [foalingRecords, setFoalingRecords] = useState<FoalingRecord[]>([]);
  const [stallionNameById, setStallionNameById] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<DetailTab>('dailyLogs');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [mareRecord, logs, breeding, checks, foaling, stallions] = await Promise.all([
        getMareById(mareId),
        listDailyLogsByMare(mareId),
        listBreedingRecordsByMare(mareId),
        listPregnancyChecksByMare(mareId),
        listFoalingRecordsByMare(mareId),
        listStallions(),
      ]);

      if (!mareRecord) {
        setError('Mare not found.');
        setMare(null);
        return;
      }

      const stallionMap = Object.fromEntries(stallions.map((stallion) => [stallion.id, stallion.name]));

      setMare(mareRecord);
      setDailyLogs(logs);
      setBreedingRecords(breeding);
      setPregnancyChecks(checks);
      setFoalingRecords(foaling);
      setStallionNameById(stallionMap);

      navigation.setOptions({ title: mareRecord.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mare details.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [mareId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const breedingById = useMemo(
    () => Object.fromEntries(breedingRecords.map((record) => [record.id, record])),
    [breedingRecords]
  );

  const age = deriveAgeYears(mare?.dateOfBirth ?? null);

  const renderTabContent = (): JSX.Element => {
    if (activeTab === 'dailyLogs') {
      return (
        <View style={styles.listWrap}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('DailyLogForm', { mareId })}
          >
            <Text style={styles.primaryButtonText}>Add Daily Log</Text>
          </Pressable>
          {dailyLogs.length === 0 ? <Text>No daily logs yet.</Text> : null}
          {dailyLogs.map((log) => (
            <View key={log.id} style={styles.card}>
              <Text style={styles.cardTitle}>{log.date}</Text>
              <Text>Teasing: {log.teasingScore ?? '-'}</Text>
              <Text>Edema: {log.edema ?? '-'}</Text>
              <Text>Right ovary: {log.rightOvary || '-'}</Text>
              <Text>Left ovary: {log.leftOvary || '-'}</Text>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.inlineButton}
                  onPress={() => navigation.navigate('DailyLogForm', { mareId, logId: log.id })}
                >
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === 'breedingRecords') {
      return (
        <View style={styles.listWrap}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('BreedingRecordForm', { mareId })}
          >
            <Text style={styles.primaryButtonText}>Add Breeding Record</Text>
          </Pressable>
          {breedingRecords.length === 0 ? <Text>No breeding records yet.</Text> : null}
          {breedingRecords.map((record) => (
            <View key={record.id} style={styles.card}>
              <Text style={styles.cardTitle}>{record.date}</Text>
              <Text>Method: {record.method}</Text>
              <Text>Stallion: {stallionNameById[record.stallionId] ?? 'Unknown'}</Text>
              {record.collectionDate ? <Text>Collection: {record.collectionDate}</Text> : null}
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.inlineButton}
                  onPress={() =>
                    navigation.navigate('BreedingRecordForm', { mareId, breedingRecordId: record.id })
                  }
                >
                  <Text style={styles.inlineButtonText}>Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (activeTab === 'pregnancyChecks') {
      return (
        <View style={styles.listWrap}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('PregnancyCheckForm', { mareId })}
          >
            <Text style={styles.primaryButtonText}>Add Pregnancy Check</Text>
          </Pressable>
          {pregnancyChecks.length === 0 ? <Text>No pregnancy checks yet.</Text> : null}
          {pregnancyChecks.map((check) => {
            const breeding = breedingById[check.breedingRecordId];
            const daysPost = breeding ? calculateDaysPostBreeding(check.date, breeding.date) : null;

            return (
              <View key={check.id} style={styles.card}>
                <Text style={styles.cardTitle}>{check.date}</Text>
                <Text>Result: {check.result}</Text>
                <Text>Heartbeat: {check.heartbeatDetected ? 'Yes' : 'No'}</Text>
                <Text>Days post-breeding: {daysPost ?? '-'}</Text>
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.inlineButton}
                    onPress={() =>
                      navigation.navigate('PregnancyCheckForm', { mareId, pregnancyCheckId: check.id })
                    }
                  >
                    <Text style={styles.inlineButtonText}>Edit</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    return (
      <View style={styles.listWrap}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('FoalingRecordForm', { mareId })}
        >
          <Text style={styles.primaryButtonText}>Add Foaling Record</Text>
        </Pressable>
        {foalingRecords.length === 0 ? <Text>No foaling records yet.</Text> : null}
        {foalingRecords.map((record) => (
          <View key={record.id} style={styles.card}>
            <Text style={styles.cardTitle}>{record.date}</Text>
            <Text>Outcome: {record.outcome}</Text>
            <Text>Foal sex: {record.foalSex ?? '-'}</Text>
            {record.complications ? <Text>Complications: {record.complications}</Text> : null}
            <View style={styles.cardActions}>
              <Pressable
                style={styles.inlineButton}
                onPress={() => navigation.navigate('FoalingRecordForm', { mareId, foalingRecordId: record.id })}
              >
                <Text style={styles.inlineButtonText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen>
      {isLoading ? <Text>Loading mare details...</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {mare ? (
        <>
          <View style={styles.headerCard}>
            <Text style={styles.headerName}>{mare.name}</Text>
            <Text style={styles.headerLine}>{mare.breed}</Text>
            {age !== null ? <Text style={styles.headerLine}>Age {age}</Text> : null}
            {mare.registrationNumber ? <Text style={styles.headerLine}>Reg #: {mare.registrationNumber}</Text> : null}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('EditMare', { mareId })}
            >
              <Text style={styles.secondaryButtonText}>Edit Mare</Text>
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            {TAB_OPTIONS.map((tab) => {
              const active = tab.value === activeTab;
              return (
                <Pressable
                  key={tab.value}
                  style={[styles.tabButton, active ? styles.tabButtonActive : null]}
                  onPress={() => setActiveTab(tab.value)}
                >
                  <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>{renderTabContent()}</ScrollView>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#f7f9fb',
    borderColor: '#d0d7de',
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    marginBottom: 12,
    padding: 12,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerLine: {
    color: '#57606a',
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb',
  },
  tabButtonText: {
    color: '#1b1f24',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  listWrap: {
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 3,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#d0d7de',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#1b1f24',
    fontWeight: '600',
  },
  errorText: {
    color: '#b42318',
    marginBottom: 8,
  },
});
