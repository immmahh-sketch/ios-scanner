import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DocsProvider } from './src/state/DocsContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { HomeScreen } from './src/screens/HomeScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { ExportScreen } from './src/screens/ExportScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DownloadsScreen } from './src/screens/DownloadsScreen';
import { RtwDownloadScreen } from './src/screens/RtwDownloadScreen';
import { ReceiptDetailsScreen } from './src/screens/ReceiptDetailsScreen';
import { SendEmailScreen } from './src/screens/SendEmailScreen';
import { theme } from './src/theme';
import type { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.bg,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <DocsProvider>
            <StatusBar style="light" />
            <NavigationContainer theme={navTheme}>
              <Stack.Navigator
                screenOptions={{
                  headerStyle: { backgroundColor: theme.colors.bg },
                  headerTintColor: theme.colors.text,
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: theme.colors.bg },
                }}
              >
                <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
                <Stack.Screen
                  name="Review"
                  component={ReviewScreen}
                  options={{ title: 'Review' }}
                />
                <Stack.Screen
                  name="Export"
                  component={ExportScreen}
                  options={{ title: 'Name & Send' }}
                />
                <Stack.Screen
                  name="ReceiptDetails"
                  component={ReceiptDetailsScreen}
                  options={{ title: 'Receipt' }}
                />
                <Stack.Screen
                  name="SendEmail"
                  component={SendEmailScreen}
                  options={{ title: 'Send email' }}
                />
                <Stack.Screen
                  name="Downloads"
                  component={DownloadsScreen}
                  options={{ title: 'Downloads' }}
                />
                <Stack.Screen
                  name="RtwDownload"
                  component={RtwDownloadScreen}
                  options={{ title: 'RTW documents' }}
                />
                <Stack.Screen
                  name="Settings"
                  component={SettingsScreen}
                  options={{ title: 'Settings' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </DocsProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
