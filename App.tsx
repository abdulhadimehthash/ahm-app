import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from './src/lib/types';
import {
  prepareNotifications,
  scheduleRecurringNotifications,
  scheduleDynamicMorningNotification,
  scheduleDynamic3pmNotification,
  scheduleStreakWarningNotification,
} from './src/lib/notifications';
import { UndoProvider } from './src/lib/undoManager';
import { UndoToast } from './src/components/UndoToast';
import { LockScreen } from './src/screens/LockScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PasswordsScreen } from './src/screens/PasswordsScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { MoneyScreen } from './src/screens/MoneyScreen';
import { FinanceScreen } from './src/screens/FinanceScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { DailyScreen } from './src/screens/DailyScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { ProposalsScreen } from './src/screens/ProposalsScreen';
import { AIScreen } from './src/screens/AIScreen';
import { AIChatScreen } from './src/screens/AIChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { CopyVaultScreen } from './src/screens/CopyVaultScreen';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const LAST_OPEN_KEY = 'ahm_last_open';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.white,
    border: colors.border,
    primary: colors.white
  }
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useFonts({
    Feather: require('./assets/fonts/Feather.ttf'),
  });

  useEffect(() => {
    setInitialRoute('Lock');
    initApp();
  }, []);

  async function initApp() {
    await prepareNotifications();
    await scheduleRecurringNotifications();

    // Dynamic notifications — reschedule with fresh task count on every open
    try {
      await scheduleDynamicMorningNotification();
      await scheduleDynamic3pmNotification();
    } catch {
      // Supabase may not be ready; non-critical
    }

    // Streak check
    try {
      const lastOpen = await AsyncStorage.getItem(LAST_OPEN_KEY);
      if (lastOpen && Date.now() - parseInt(lastOpen, 10) > ONE_DAY_MS) {
        await scheduleStreakWarningNotification();
      }
      await AsyncStorage.setItem(LAST_OPEN_KEY, String(Date.now()));
    } catch {
      // Non-critical
    }
  }

  // Navigate to the correct screen when user taps a notification
  useEffect(() => {
    // App opened via notification tap (was killed)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    // Notification tapped while app is in background/foreground
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, []);

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const screen = response.notification.request.content.data?.screen as keyof RootStackParamList | undefined;
    if (!screen || !navigationRef.current) return;
    // Navigate after a brief delay to ensure the navigator is ready
    setTimeout(() => {
      try {
        navigationRef.current?.navigate(screen);
      } catch {
        // Navigation failed — app may still be loading
      }
    }, 500);
  }

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  return (
    <UndoProvider>
      <View style={{ flex: 1 }}>
        <NavigationContainer theme={theme} ref={navigationRef}>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.bg }
            }}
          >
            <Stack.Screen name="Lock"      component={LockScreen} />
            <Stack.Screen name="Home"      component={HomeScreen} />
            <Stack.Screen name="Passwords" component={PasswordsScreen} />
            <Stack.Screen name="Projects"  component={ProjectsScreen} />
            <Stack.Screen name="Money"     component={MoneyScreen} />
            <Stack.Screen name="Finance"   component={FinanceScreen} />
            <Stack.Screen name="Tasks"     component={TasksScreen} />
            <Stack.Screen name="Calendar"  component={CalendarScreen} />
            <Stack.Screen name="Daily"     component={DailyScreen} />
            <Stack.Screen name="Reminders" component={RemindersScreen} />
            <Stack.Screen name="Notes"     component={NotesScreen} />
            <Stack.Screen name="Documents"  component={DocumentsScreen} />
            <Stack.Screen name="Proposals"  component={ProposalsScreen} />
            <Stack.Screen name="AI"         component={AIScreen} />
            <Stack.Screen name="AIChat"     component={AIChatScreen} />
            <Stack.Screen name="Settings"   component={SettingsScreen} />
            <Stack.Screen name="Search"    component={SearchScreen} />
            <Stack.Screen name="CopyVault" component={CopyVaultScreen} />
            <Stack.Screen name="Contacts"  component={ContactsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        {/* Global undo toast — renders above all screens */}
        <UndoToast />
      </View>
    </UndoProvider>
  );
}
