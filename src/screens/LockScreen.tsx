import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { AhmLogo } from '../components/AhmLogo';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const accessPin = '982010';

export function LockScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Lock'>) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function unlock() {
    if (pin === accessPin) {
      setError('');
      navigation.replace('Home');
      return;
    }
    setError('Incorrect PIN');
    setPin('');
  }

  return (
    <View style={sharedStyles.screen}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[sharedStyles.contentContainer, styles.container]}
      >
        <View style={styles.logoContainer}>
          <AhmLogo />
        </View>
        
        <View style={styles.form}>
          <Text style={styles.heading}>Enter PIN</Text>
          <TextInput
            value={pin}
            onChangeText={(value) => {
              setError('');
              const cleaned = value.replace(/\D/g, '').slice(0, 6);
              setPin(cleaned);
              if (cleaned.length === 6) {
                // Auto-submit if 6 digits are entered
                if (cleaned === accessPin) {
                  navigation.replace('Home');
                }
              }
            }}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={colors.muted}
            style={[styles.pinInput, !!error && styles.inputError]}
            autoFocus
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          
          <Pressable 
            onPress={unlock} 
            style={({ pressed }) => [
              sharedStyles.primaryButton,
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
          >
            <Text style={sharedStyles.primaryButtonText}>Unlock App</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    paddingBottom: 40
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60
  },
  form: {
    width: '100%'
  },
  heading: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5
  },
  pinInput: {
    height: 72,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: colors.white,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 8
  },
  inputError: {
    borderColor: colors.red
  },
  error: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20
  }
});
