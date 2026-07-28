import { Stack } from 'expo-router';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function AuthLayout() {
  const { user, initializing } = useAuth();

  if (!initializing && user) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
