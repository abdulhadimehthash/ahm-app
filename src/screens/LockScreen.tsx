import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';

const DEFAULT_PIN = '982010';
const PIN_KEY = 'ahm_custom_pin';

export function LockScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Lock'>) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [accessPin, setAccessPin] = useState(DEFAULT_PIN);

  useEffect(() => {
    AsyncStorage.getItem(PIN_KEY).then((stored) => {
      if (stored) setAccessPin(stored);
    });

    // Handle auto-lock check
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const sessionVal = await AsyncStorage.getItem('ahm_unlock_session');
      const storedLockTimer = await AsyncStorage.getItem('ahm_lock_timer') || 'Immediately';
      
      if (sessionVal && storedLockTimer !== 'Immediately') {
        const diff = Date.now() - parseInt(sessionVal, 10);
        let skip = false;
        
        if (storedLockTimer === 'Never') {
          skip = true;
        } else if (storedLockTimer === '5m' && diff < 5 * 60 * 1000) {
          skip = true;
        } else if (storedLockTimer === '15m' && diff < 15 * 60 * 1000) {
          skip = true;
        } else if (storedLockTimer === '1h' && diff < 60 * 60 * 1000) {
          skip = true;
        }
        
        if (skip) {
          navigation.replace('Home');
        }
      }
    } catch (e) {
      console.error('Failed to check lock session', e);
    }
  }

  async function saveSession() {
    await AsyncStorage.setItem('ahm_unlock_session', Date.now().toString());
  }

  async function unlock() {
    if (pin === accessPin) {
      setError('');
      await saveSession();
      navigation.replace('Home');
      return;
    }
    setError('Incorrect PIN');
    setPin('');
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>AHM</Text>
          <Text style={styles.subtitle}>Personal Manager</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>PIN</Text>
          <TextInput
            value={pin}
            onChangeText={async (value) => {
              setError('');
              const cleaned = value.replace(/\D/g, '').slice(0, 8);
              setPin(cleaned);
              if (cleaned.length >= 4 && cleaned === accessPin) {
                await saveSession();
                navigation.replace('Home');
              } else if (cleaned.length >= 4 && cleaned.length === accessPin.length && cleaned !== accessPin) {
                setError('Incorrect PIN');
                setPin('');
              }
            }}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
            placeholder="••••••"
            placeholderTextColor={colors.muted}
            style={[styles.pinInput, !!error && styles.inputError]}
            autoFocus
          />
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={unlock}
            style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.unlockBtnText}>Unlock</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logo: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  form: {
    width: '100%',
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  pinInput: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 10,
  },
  inputError: {
    borderColor: colors.red,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 20,
  },
  unlockBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  unlockBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
