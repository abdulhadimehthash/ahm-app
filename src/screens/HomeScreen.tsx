import React, { useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Animated, Dimensions, Pressable, ScrollView,
  StyleSheet, Text, View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning, Hadi 👋';
  if (hour < 17) return 'Good Afternoon, Hadi 👋';
  return 'Good Evening, Hadi 👋';
}

type HomeRoute = Exclude<keyof RootStackParamList, 'Lock' | 'Home'>;

interface Item {
  label: string;
  route: HomeRoute;
  icon: keyof typeof Feather.glyphMap;
}

const items: Item[] = [
  { label: 'Passwords',   route: 'Passwords',  icon: 'lock'        },
  { label: 'Projects',    route: 'Projects',   icon: 'folder'      },
  { label: 'Money',       route: 'Money',      icon: 'dollar-sign' },
  { label: 'Tasks',       route: 'Tasks',      icon: 'check-square'},
  { label: 'Finance',     route: 'Finance',    icon: 'bar-chart-2' },
  { label: 'Calendar',    route: 'Calendar',   icon: 'calendar'    },
  { label: 'Daily',       route: 'Daily',      icon: 'sun'         },
  { label: 'Reminders',   route: 'Reminders',  icon: 'bell'        },
  { label: 'Notes',       route: 'Notes',      icon: 'file-text'   },
  { label: 'Documents',   route: 'Documents',  icon: 'file'        },
  { label: 'Proposals',   route: 'Proposals',  icon: 'send'        },
  { label: 'AI',          route: 'AI',         icon: 'cpu'         },
  { label: 'Copy Vault',  route: 'CopyVault',  icon: 'copy'        },
  { label: 'Contacts',    route: 'Contacts',   icon: 'users'       },
];

const GAP = 12;
const H_PAD = 20;
const SCREEN_W = Dimensions.get('window').width;
const TILE_SIZE = (Math.min(SCREEN_W, 420) - H_PAD * 2 - GAP) / 2;

function Tile({ item, onPress }: { item: Item; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.timing(scale, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }

  return (
    <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.tileInner}
      >
        <Feather name={item.icon} size={28} color={colors.white} />
        <Text style={styles.tileLabel}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>AHM</Text>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => navigation.navigate('Search')}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="search" size={18} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="settings" size={18} color={colors.white} />
            </Pressable>
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>

        {/* Tile grid */}
        <View style={styles.grid}>
          {items.map((item) => (
            <Tile
              key={item.route}
              item={item}
              onPress={() => navigation.navigate(item.route)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  scroll: {
    width: '100%',
    maxWidth: 420,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    marginBottom: 8,
  },
  logo: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  tileInner: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  tileLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
