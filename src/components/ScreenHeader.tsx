import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';

export function ScreenHeader({
  title,
  navigation,
  action
}: {
  title: string;
  navigation: NativeStackNavigationProp<RootStackParamList, any>;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Pressable 
        onPress={() => navigation.goBack()} 
        style={({ pressed }) => [
          styles.back,
          pressed && { backgroundColor: colors.surfaceLight }
        ]}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between'
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  backText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600'
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1
  },
  action: {
    minWidth: 48,
    alignItems: 'flex-end'
  }
});
