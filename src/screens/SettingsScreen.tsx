import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const SESSION_KEY = 'ahm_unlock_session';
const PIN_KEY = 'ahm_custom_pin';
const DEFAULT_PIN = '982010';

export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Settings'>) {
  const [changingPin, setChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  async function changePin() {
    const storedPin = (await AsyncStorage.getItem(PIN_KEY)) ?? DEFAULT_PIN;
    if (currentPin !== storedPin) { Alert.alert('Wrong PIN', 'Current PIN is incorrect.'); return; }
    if (newPin.length < 4) { Alert.alert('Invalid', 'PIN must be at least 4 digits.'); return; }
    if (newPin !== confirmPin) { Alert.alert('Mismatch', 'New PINs do not match.'); return; }
    await AsyncStorage.setItem(PIN_KEY, newPin);
    setCurrentPin(''); setNewPin(''); setConfirmPin('');
    setChangingPin(false);
    Alert.alert('PIN Changed', 'Your PIN has been updated.');
  }

  async function lockNow() {
    await AsyncStorage.removeItem(SESSION_KEY);
    navigation.reset({ index:0, routes:[{ name:'Lock' }] });
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Settings" navigation={navigation} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* SECURITY */}
          <Text style={styles.sectionLabel}>Security</Text>
          <View style={styles.group}>
            <Pressable onPress={() => setChangingPin(!changingPin)} style={styles.row}>
              <Text style={styles.rowLabel}>Change PIN</Text>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
            {changingPin && (
              <View style={styles.pinForm}>
                <TextInput style={styles.pinInput} placeholder="Current PIN" placeholderTextColor={colors.muted}
                  secureTextEntry keyboardType="number-pad" value={currentPin} onChangeText={setCurrentPin} maxLength={8} />
                <TextInput style={styles.pinInput} placeholder="New PIN" placeholderTextColor={colors.muted}
                  secureTextEntry keyboardType="number-pad" value={newPin} onChangeText={setNewPin} maxLength={8} />
                <TextInput style={[styles.pinInput,{marginBottom:12}]} placeholder="Confirm New PIN" placeholderTextColor={colors.muted}
                  secureTextEntry keyboardType="number-pad" value={confirmPin} onChangeText={setConfirmPin} maxLength={8} />
                <Pressable onPress={changePin} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Update PIN</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.separator} />
            <Pressable onPress={lockNow} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.red }]}>Lock App Now</Text>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          </View>

          {/* ABOUT */}
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>App Name</Text>
              <Text style={styles.rowValue}>AHM</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Backend</Text>
              <Text style={styles.rowValue}>Supabase</Text>
            </View>
          </View>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color:colors.muted, fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginBottom:10, marginTop:24 },
  group: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, overflow:'hidden' },
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:16, paddingHorizontal:18 },
  rowLabel: { color:colors.white, fontSize:15, fontWeight:'600' },
  rowValue: { color:colors.muted, fontSize:14 },
  rowChevron: { color:colors.muted, fontSize:20 },
  separator: { height:1, backgroundColor:colors.border, marginLeft:18 },
  pinForm: { paddingHorizontal:18, paddingBottom:16 },
  pinInput: { height:48, backgroundColor:colors.surfaceLight, borderRadius:10, borderWidth:1, borderColor:colors.border, color:colors.white, paddingHorizontal:14, fontSize:15, marginBottom:10 },
  smallBtn: { backgroundColor:colors.white, borderRadius:10, height:44, alignItems:'center', justifyContent:'center' },
  smallBtnText: { color:colors.black, fontWeight:'700', fontSize:14 }
});
