import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';
import { useAuth } from '../src/providers/AuthProvider';

export default function Index() {
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

  return <Redirect href="/(app)/(tabs)" />;
}
