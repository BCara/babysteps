import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, List, Switch, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text variant="headlineMedium" style={styles.title}>Settings</Text>

        <List.Section>
          <List.Subheader>Account</List.Subheader>
          <List.Item
            title="Profile"
            left={props => <List.Icon {...props} icon="account" />}
          />
          <List.Item
            title="Subscription"
            description="Free Tier"
            left={props => <List.Icon {...props} icon="star" />}
          />
        </List.Section>

        <List.Section>
          <List.Subheader>Preferences</List.Subheader>
          <List.Item
            title="Dark Mode"
            left={props => <List.Icon {...props} icon="theme-light-dark" />}
            right={props => <Switch value={false} onValueChange={() => {}} />}
          />
          <List.Item
            title="Notifications"
            left={props => <List.Icon {...props} icon="bell" />}
          />
        </List.Section>

        <List.Section>
          <List.Subheader>Integrations</List.Subheader>
          <List.Item
            title="Alexa Skill"
            description="Not connected"
            left={props => <List.Icon {...props} icon="amazon-alexa" />}
          />
          <List.Item
            title="Gemini AI"
            description="Not connected"
            left={props => <List.Icon {...props} icon="robot" />}
          />
        </List.Section>

        <View style={styles.logoutContainer}>
          <Link href="/(auth)/login" asChild>
            <Button mode="outlined" style={styles.logoutButton}>
              Log Out
            </Button>
          </Link>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  title: {
    padding: 24,
    fontWeight: 'bold',
  },
  logoutContainer: {
    padding: 24,
    alignItems: 'center',
  },
  logoutButton: {
    width: '100%',
  }
});
