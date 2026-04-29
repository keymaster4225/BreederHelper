import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useStallionDetailData } from '@/hooks/useStallionDetailData';
import { useHorseExport } from '@/hooks/useHorseExport';
import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { getStallionDetailTabIndex } from '@/screens/detailTabRoutes';
import { colors, spacing } from '@/theme';
import { MareDetailTabStrip } from '@/screens/mare-detail/MareDetailTabStrip';
import {
  StallionDetailHeader,
  CollectionsTab,
  BreedingHistoryTab,
  FrozenBatchesTab,
} from '@/screens/stallion-detail';

type Props = NativeStackScreenProps<RootStackParamList, 'StallionDetail'>;

const TAB_OPTIONS = [
  { label: 'Collections' },
  { label: 'Breeding' },
  { label: 'Frozen' },
] as const;

export function StallionDetailScreen({ navigation, route }: Props): JSX.Element {
  const stallionId = route.params.stallionId;
  const initialTabIndex = getStallionDetailTabIndex(route.params.initialTab);
  const [activeTabIndex, setActiveTabIndex] = useState(initialTabIndex);
  const pagerRef = useRef<PagerView>(null);
  const { isExporting, exportStallionPackage } = useHorseExport();

  const handleSetTitle = useCallback((title: string) => {
    navigation.setOptions({ title });
  }, [navigation]);

  const {
    stallion,
    collections,
    linkedBreedings,
    legacyBreedings,
    breedingRecordById,
    doseEventsByCollectionId,
    frozenBatches,
    frozenBatchesByCollectionId,
    mareNameById,
    age,
    isLoading,
    error,
    loadData,
    deleteDoseEventRecord,
    deleteFrozenBatchRecord,
  } = useStallionDetailData({ stallionId, setTitle: handleSetTitle });

  const handleExportStallion = useCallback(() => {
    void (async () => {
      const result = await exportStallionPackage(stallionId);
      if (!result.ok) {
        Alert.alert('Export failed', result.errorMessage);
        return;
      }

      const shareMessage = result.shared
        ? 'The share sheet opened so you can send or save this horse package.'
        : 'The horse package was saved locally. Share it from app storage when needed.';

      Alert.alert('Stallion package ready', `${result.fileName}\n\n${shareMessage}`);
    })();
  }, [exportStallionPackage, stallionId]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleExportStallion}
            hitSlop={8}
            accessibilityLabel="Export stallion package"
            disabled={isExporting}
            style={({ pressed }) => [
              isExporting && styles.headerActionDisabled,
              pressed && !isExporting && styles.headerActionPressed,
            ]}
          >
            <MaterialCommunityIcons name="share-variant" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('StallionForm', { stallionId })}
            hitSlop={8}
            accessibilityLabel="Edit Stallion"
            style={({ pressed }) => pressed ? styles.headerActionPressed : undefined}
          >
            <MaterialCommunityIcons name="pencil" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      ),
    });
  }, [handleExportStallion, isExporting, navigation, stallionId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handlePageSelected = useCallback((e: PagerViewOnPageSelectedEvent) => {
    setActiveTabIndex(e.nativeEvent.position);
  }, []);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const isDeleted = stallion?.deletedAt != null;

  return (
    <Screen>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {stallion ? (
        <>
          <StallionDetailHeader
            stallion={stallion}
            age={age}
          />

          <MareDetailTabStrip tabs={TAB_OPTIONS} activeTabIndex={activeTabIndex} onTabPress={handleTabPress} />

          <PagerView
            ref={pagerRef}
            testID="stallion-detail-pager"
            style={styles.pager}
            initialPage={initialTabIndex}
            onPageSelected={handlePageSelected}
          >
            <CollectionsTab
              key="0"
              stallionId={stallionId}
              stallion={stallion}
              collections={collections}
              doseEventsByCollectionId={doseEventsByCollectionId}
              frozenBatchesByCollectionId={frozenBatchesByCollectionId}
              breedingRecordById={breedingRecordById}
              mareNameById={mareNameById}
              isDeleted={isDeleted}
              onDoseEventsChanged={loadData}
              onDeleteDoseEvent={deleteDoseEventRecord}
              onDeleteFrozenBatch={deleteFrozenBatchRecord}
              navigation={navigation}
            />
            <BreedingHistoryTab
              key="1"
              linkedBreedings={linkedBreedings}
              legacyBreedings={legacyBreedings}
              mareNameById={mareNameById}
              navigation={navigation}
            />
            <FrozenBatchesTab
              key="2"
              stallionId={stallionId}
              collections={collections}
              frozenBatches={frozenBatches}
              isDeleted={isDeleted}
              navigation={navigation}
            />
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
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerActionPressed: {
    opacity: 0.6,
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
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
