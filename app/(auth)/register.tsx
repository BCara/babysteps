import { View, StyleSheet } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text variant="displayMedium" style={styles.title}>Create Account</Text>
      
      <TextInput
        label="Name"
        mode="outlined"
        style={styles.input}
      />
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
          Sign Up
        </Button>
      </Link>
      
      <Link href="/(auth)/login" asChild>
        <Button mode="text">Already have an account? Log in</Button>
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
    marginBottom: 32,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  }
});
