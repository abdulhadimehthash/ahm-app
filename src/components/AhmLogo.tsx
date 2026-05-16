import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

// Simple text logo — no border box
export function AhmLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Text style={compact ? styles.compact : styles.logo}>AHM</Text>
  );
}

const styles = StyleSheet.create({
  logo: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
  },
  compact: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
  },
});
