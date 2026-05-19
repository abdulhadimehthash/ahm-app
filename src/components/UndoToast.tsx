import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';

export function UndoToast() {
  const { activeLabel, restore, secondsLeft } = useUndo();
  const translateY = useRef(new Animated.Value(120)).current;
  const shakeThrottle = useRef(0);
  const isActive = activeLabel !== null;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isActive ? 0 : 120,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [isActive]);

  // Subscribe to accelerometer only when undo is active
  useEffect(() => {
    if (!isActive) return;
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (mag > 2.8 && now - shakeThrottle.current > 1000) {
        shakeThrottle.current = now;
        restore();
      }
    });
    return () => sub.remove();
  }, [isActive, restore]);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      pointerEvents={isActive ? 'auto' : 'none'}
    >
      <View style={styles.inner}>
        <View style={styles.left}>
          <Text style={styles.label} numberOfLines={1}>
            {activeLabel}
          </Text>
          {isActive && <Text style={styles.sub}>Shake or tap Undo · {secondsLeft}s</Text>}
        </View>
        <Pressable
          onPress={restore}
          style={({ pressed }) => [styles.undoBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 108,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  inner: {
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 14,
  },
  left: { flex: 1, marginRight: 12 },
  label: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  sub: { color: colors.muted, fontSize: 12 },
  undoBtn: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  undoText: {
    color: colors.black,
    fontWeight: '800',
    fontSize: 13,
  },
});
