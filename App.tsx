import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useAppBootstrap } from './src/storage/useAppBootstrap';
import { getOnboardingComplete } from './src/utils/onboarding';

export default function App(): JSX.Element | null {
  const { isReady, error } = useAppBootstrap();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (!isReady) {
      return;
    }
    getOnboardingComplete().then(setOnboardingComplete);
  }, [isReady]);

  if (error) {
    throw error;
  }

  if (!fontsLoaded || !isReady || onboardingComplete === null) {
    return null;
  }

  if (!onboardingComplete) {
    return (
      <SafeAreaProvider>
        <WelcomeScreen onComplete={() => setOnboardingComplete(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
