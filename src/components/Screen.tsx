import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

export function Screen({ children }: Props): JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    padding: 16,
  },
});
