import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text variant="displayMedium" style={styles.title}>BabySteps</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>Welcome back!</Text>
      
      <TextInput
        label="Email"
        mode="outlined"
        style={styles.input}
      />
      <TextInput
        label="Password"
        mode="outlined"
        secureTextEntry
        style={styles.input}
      />
      
      <Link href="/(app)/(tabs)" asChild>
        <Button mode="contained" style={styles.button}>
          Log In
        </Button>
      </Link>
      
      <Link href="/(auth)/register" asChild>
        <Button mode="text">Don't have an account? Sign up</Button>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  }
});
