import React from 'react';
import { Pressable, StyleSheet, Text, Platform } from 'react-native';
import { colors } from '../theme/colors';

export function FloatingButton({ onPress, label = '+' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    // Fix for web centering
    zIndex: 100
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9
  },
  text: {
    color: colors.black,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '600'
  }
});
