import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppBootstrap } from './src/storage/useAppBootstrap';

export default function App(): JSX.Element | null {
  const { isReady, error } = useAppBootstrap();

  if (error) {
    throw error;
  }

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}

