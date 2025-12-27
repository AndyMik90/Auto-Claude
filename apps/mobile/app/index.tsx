/**
 * Index Screen
 * Entry point that redirects users based on onboarding status
 * Shows loading state while checking settings, then redirects to onboarding or main app
 */

import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Redirect } from 'expo-router';
import { colors } from '../theme';
import { useIsOnboardingCompleted, useIsSettingsHydrated } from '../stores/settingsStore';

/**
 * Main index route - redirects based on onboarding completion status
 */
export default function IndexScreen() {
  const isHydrated = useIsSettingsHydrated();
  const isOnboardingCompleted = useIsOnboardingCompleted();

  // While the settings store is rehydrating from AsyncStorage, show loading
  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          AutoClaude Mobile
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Mobile companion app for AutoClaude
        </Text>
        <ActivityIndicator
          animating={true}
          color={colors.accent.primary}
          size="large"
          style={styles.loader}
        />
      </View>
    );
  }

  // Once hydrated, redirect based on onboarding status
  if (isOnboardingCompleted) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/onboarding" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: colors.text.primary,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  loader: {
    marginTop: 20,
  },
});
