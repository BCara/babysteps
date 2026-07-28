import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { BabyProvider } from '../../src/providers/BabyProvider';
import { EventProvider } from '../../src/providers/EventProvider';

export default function AppLayout() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <BabyProvider>
      <EventProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="onboarding"
            options={{ presentation: 'modal', gestureEnabled: false }}
          />
        </Stack>
      </EventProvider>
    </BabyProvider>
  );
}
