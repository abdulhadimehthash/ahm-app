import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';

export function ScreenHeader({
  title,
  navigation,
  action,
}: {
  title: string;
  navigation: NativeStackNavigationProp<RootStackParamList, any>;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Feather name="arrow-left" size={20} color={colors.white} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    position: 'absolute',
    left: 52,
    right: 52,
  },
  action: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
});
