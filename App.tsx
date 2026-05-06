import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/lib/types';
import { LockScreen } from './src/screens/LockScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PasswordsScreen } from './src/screens/PasswordsScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { FinanceScreen } from './src/screens/FinanceScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.black,
    card: colors.black,
    text: colors.white,
    border: colors.border,
    primary: colors.white
  }
};

export default function App() {
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Lock"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.black }
        }}
      >
        <Stack.Screen name="Lock" component={LockScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Passwords" component={PasswordsScreen} />
        <Stack.Screen name="Projects" component={ProjectsScreen} />
        <Stack.Screen name="Finance" component={FinanceScreen} />
        <Stack.Screen name="Tasks" component={TasksScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
