import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Lora_400Regular, Lora_700Bold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

import { AppNavigator } from './src/navigation/AppNavigator';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useAppBootstrap } from './src/storage/useAppBootstrap';

const SPLASH_DURATION_MS = 1200;

export default function App(): JSX.Element | null {
  const { isReady, error, errorReportId } = useAppBootstrap();
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
    return (
      <SafeAreaProvider>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Startup Error</Text>
          <Text style={styles.errorBody}>
            The app could not initialize local data.
          </Text>
          <Text selectable style={styles.errorDetails}>
            {error.message}
          </Text>
          {errorReportId ? (
            <Text selectable style={styles.errorMeta}>
              Report ID: {errorReportId}
            </Text>
          ) : null}
        </View>
      </SafeAreaProvider>
    );
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

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#1f1f1f',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: '#444444',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorDetails: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
  errorMeta: {
    color: '#777777',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
