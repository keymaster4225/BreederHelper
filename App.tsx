import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useAppBootstrap } from './src/storage/useAppBootstrap';

const SPLASH_DURATION_MS = 1200;

export default function App(): JSX.Element | null {
  const { isReady, error } = useAppBootstrap();
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (!fontsLoaded || !isReady) {
      return;
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [fontsLoaded, isReady]);

  if (error) {
    throw error;
  }

  if (!fontsLoaded || !isReady) {
    return null;
  }

  if (showSplash) {
    return (
      <SafeAreaProvider>
        <WelcomeScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
