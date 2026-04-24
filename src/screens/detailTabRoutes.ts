import type { RootStackParamList } from '@/navigation/AppNavigator';

export type MareDetailTabKey = NonNullable<RootStackParamList['MareDetail']['initialTab']>;
export type StallionDetailTabKey = NonNullable<RootStackParamList['StallionDetail']['initialTab']>;

export const MARE_DETAIL_TAB_KEY_TO_INDEX: Readonly<Record<MareDetailTabKey, number>> = {
  dailyLogs: 0,
  breeding: 1,
  pregnancy: 2,
  foaling: 3,
  meds: 4,
};

export const STALLION_DETAIL_TAB_KEY_TO_INDEX: Readonly<Record<StallionDetailTabKey, number>> = {
  collections: 0,
  breeding: 1,
  frozen: 2,
};

function resolveTabIndex(tabKeyToIndex: Readonly<Partial<Record<string, number>>>, tabKey?: string): number {
  return tabKeyToIndex[tabKey ?? ''] ?? 0;
}

export function getMareDetailTabIndex(tabKey: RootStackParamList['MareDetail']['initialTab']): number {
  return resolveTabIndex(MARE_DETAIL_TAB_KEY_TO_INDEX, tabKey);
}

export function getStallionDetailTabIndex(tabKey: RootStackParamList['StallionDetail']['initialTab']): number {
  return resolveTabIndex(STALLION_DETAIL_TAB_KEY_TO_INDEX, tabKey);
}
