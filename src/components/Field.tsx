import React from 'react';
import { StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { sharedStyles } from '../theme/styles';
import { colors } from '../theme/colors';

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={sharedStyles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={sharedStyles.input}
        {...props}
      />
    </View>
  );
}
