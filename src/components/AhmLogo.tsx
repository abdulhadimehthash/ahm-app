import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function AhmLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.wrap, compact && styles.compactWrap]}>
      <Text style={[styles.text, compact && styles.compactText]}>AHM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 0, // Keep it sharp for minimal look
    marginBottom: 32
  },
  compactWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 0
  },
  text: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2
  },
  compactText: {
    fontSize: 18,
    letterSpacing: 1
  }
});
