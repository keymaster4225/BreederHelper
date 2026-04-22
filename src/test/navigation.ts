import { jest } from '@jest/globals';

import type { RootStackParamList } from '@/navigation/AppNavigator';

type NavigationStub = {
  navigate: ReturnType<typeof jest.fn>;
  goBack: ReturnType<typeof jest.fn>;
  setOptions: ReturnType<typeof jest.fn>;
};

export function createNavigationStub(): NavigationStub {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  };
}

export function createRouteStub<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params: RootStackParamList[RouteName]
): { key: string; name: RouteName; params: RootStackParamList[RouteName] } {
  return {
    key: `${String(name)}-key`,
    name,
    params,
  };
}
