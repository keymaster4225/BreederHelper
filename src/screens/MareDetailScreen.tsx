import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

import { useMareDetailData } from '@/hooks/useMareDetailData';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getMareDetailTabIndex } from '@/screens/detailTabRoutes';
import { colors, spacing } from '@/theme';
import {
  BreedingTab,
  DailyLogsTab,
  FoalingTab,
  MareDetailHeader,
  MareDetailTabStrip,
  MedicationsTab,
  PregnancyTab,
} from '@/screens/mare-detail';

type Props = NativeStackScreenProps<RootStackParamList, 'MareDetail'>;

const TAB_OPTIONS = [
  { label: 'Logs' },
  { label: 'Breeding' },
  { label: 'Pregnancy' },
  { label: 'Foaling' },
  { label: 'Meds' },
] as const;

export function MareDetailScreen({ navigation, route }: Props): JSX.Element {
  const mareId = route.params.mareId;
  const initialTabIndex = getMareDetailTabIndex(route.params.initialTab);
  const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);
  const pagerRef = useRef<PagerView>(null);
  const handleSetTitle = useCallback((title: string) => {
    navigation.setOptions({ title });
  }, [navigation]);
  const {
    mare,
    dailyLogs,
    breedingRecords,
    pregnancyChecks,
    foalingRecords,
    medicationLogs,
    foalByFoalingRecordId,
    stallionNameById,
    breedingById,
    age,
    isCurrentlyPregnant,
    isLoading,
    error,
    loadData,
  } = useMareDetailData({
    mareId,
    setTitle: handleSetTitle,
  });

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handlePageSelected = useCallback((e: PagerViewOnPageSelectedEvent) => {
    setActiveTabIndex(e.nativeEvent.position);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  return (
    <Screen>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {mare ? (
        <>
          <MareDetailHeader
            mare={mare}
            age={age}
            isCurrentlyPregnant={isCurrentlyPregnant}
            onCalendarPress={() => navigation.navigate('MareCalendar', { mareId })}
          />

          <MareDetailTabStrip tabs={TAB_OPTIONS} activeTabIndex={activeTabIndex} onTabPress={handleTabPress} />

          <PagerView
            ref={pagerRef}
            testID="mare-detail-pager"
            style={styles.pager}
            initialPage={initialTabIndex}
            onPageSelected={handlePageSelected}
          >
            <DailyLogsTab key="0" mareId={mareId} dailyLogs={dailyLogs} navigation={navigation} />
            <BreedingTab key="1" mareId={mareId} breedingRecords={breedingRecords} stallionNameById={stallionNameById} navigation={navigation} />
            <PregnancyTab
              key="2"
              mareId={mareId}
              gestationLengthDays={mare.gestationLengthDays}
              pregnancyChecks={pregnancyChecks}
              breedingById={breedingById}
              dailyLogs={dailyLogs}
              navigation={navigation}
            />
            <FoalingTab key="3" mareId={mareId} foalingRecords={foalingRecords} foalByFoalingRecordId={foalByFoalingRecordId} navigation={navigation} />
            <MedicationsTab key="4" mareId={mareId} medicationLogs={medicationLogs} navigation={navigation} />
          </PagerView>
        </>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loadingOverlay} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    alignSelf: 'center',
    position: 'absolute',
    top: spacing.xl,
    zIndex: 20,
  },
  pager: {
    flex: 1,
  },
  errorText: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
