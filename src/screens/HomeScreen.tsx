import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { AhmLogo } from '../components/AhmLogo';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

type HomeRoute = Exclude<keyof RootStackParamList, 'Lock' | 'Home'>;

interface Item {
  label: string;
  route: HomeRoute;
  icon: string;
}

const items: Item[] = [
  { label: 'Passwords', route: 'Passwords', icon: '🔑' },
  { label: 'Projects', route: 'Projects', icon: '📁' },
  { label: 'Finance', route: 'Finance', icon: '💰' },
  { label: 'Tasks', route: 'Tasks', icon: '✅' }
];

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return (
    <View style={sharedStyles.screen}>
      <ScrollView 
        style={sharedStyles.contentContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <AhmLogo />
        </View>
        
        <View style={styles.grid}>
          {items.map((item) => (
            <Pressable 
              key={item.route} 
              onPress={() => navigation.navigate(item.route)} 
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed
              ]}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.cardLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 48
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between'
  },
  card: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6
  },
  cardPressed: {
    backgroundColor: colors.surfaceLight,
    transform: [{ scale: 0.96 }],
    borderColor: colors.borderLight
  },
  icon: {
    fontSize: 32,
    marginBottom: 12
  },
  cardLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  }
});
