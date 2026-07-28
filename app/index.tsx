import { Redirect } from 'expo-router';

// This is the entry point that redirects based on auth state.
export default function Index() {
  // TODO: Add auth state check here
  const isAuthenticated = false; // Mock state for now

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)/(tabs)" />;
}
