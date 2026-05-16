import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../theme/colors';

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    color: colors.white,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: colors.surfaceLight,
    marginBottom: 16,
  },
});
