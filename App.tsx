import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppBootstrap } from './src/storage/useAppBootstrap';

export default function App(): JSX.Element | null {
  const { isReady, error } = useAppBootstrap();
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (error) {
    throw error;
  }

  if (!fontsLoaded || !isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
