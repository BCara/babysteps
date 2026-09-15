import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { appThemes } from '../src/theme/appTheme';
import {
  AppearanceProvider,
  useAppearance,
} from '../src/providers/AppearanceProvider';
import { AuthProvider } from '../src/providers/AuthProvider';
import { MonetizationProvider } from '../src/providers/MonetizationProvider';
import { AiAssistantProvider } from '../src/providers/AiAssistantProvider';

function ThemedApp() {
  const { mode, tokens } = useAppearance();

  const navigationTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: tokens.bgPage,
      card: tokens.bgCard,
      text: tokens.textPrimary,
      border: tokens.borderHairline,
      primary: tokens.accent,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <PaperProvider theme={appThemes[mode]}>
        <AuthProvider>
          <MonetizationProvider>
            <AiAssistantProvider>
              <StatusBar style="light" backgroundColor={tokens.bgPage} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: tokens.bgPage },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </AiAssistantProvider>
          </MonetizationProvider>
        </AuthProvider>
      </PaperProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppearanceProvider>
        <ThemedApp />
      </AppearanceProvider>
    </GestureHandlerRootView>
  );
}
