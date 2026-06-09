import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform, Switch, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenHeader } from '../components/ScreenHeader';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';
import { supabase } from '../lib/supabase';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import { cancelNotification } from '../lib/notifications';

const SESSION_KEY = 'ahm_unlock_session';
const PIN_KEY = 'ahm_custom_pin';
const DEFAULT_PIN = '982010';
const LOCK_TIMER_KEY = 'ahm_lock_timer';
const NOTIFS_ENABLED_KEY = 'ahm_notifications_enabled';

export function SettingsScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Settings'>) {
  const [changingPin, setChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [lockTimer, setLockTimer] = useState('Immediately');
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const storedTimer = await AsyncStorage.getItem(LOCK_TIMER_KEY);
      if (storedTimer) setLockTimer(storedTimer);
      
      const storedNotifs = await AsyncStorage.getItem(NOTIFS_ENABLED_KEY);
      if (storedNotifs !== null) setNotifsEnabled(storedNotifs === 'true');
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }

  async function updateLockTimer(value: string) {
    setLockTimer(value);
    await AsyncStorage.setItem(LOCK_TIMER_KEY, value);
  }

  async function toggleNotifications(value: boolean) {
    setNotifsEnabled(value);
    await AsyncStorage.setItem(NOTIFS_ENABLED_KEY, String(value));
    if (!value) {
      // If disabling notifications, clear all scheduled briefs/reminders
      try {
        await cancelNotification('daily_morning');
        await cancelNotification('daily_afternoon');
      } catch (e) {
        console.error('Failed to cancel daily briefs:', e);
      }
    }
  }

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

  async function exportData() {
    setExporting(true);
    try {
      const [
        passwords, projects, finance, expenses, dayPlans,
        birthdays, meetings, reminders, copyVault, contacts
      ] = await Promise.all([
        supabase.from('password_entries').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('finance_entries').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('day_plans').select('*'),
        supabase.from('birthdays').select('*'),
        supabase.from('meeting_notes').select('*'),
        supabase.from('reminders').select('*'),
        supabase.from('copy_vault').select('*'),
        supabase.from('contacts').select('*'),
      ]);

      const exportObj = {
        passwords: passwords.data ?? [],
        projects: projects.data ?? [],
        finance: finance.data ?? [],
        expenses: expenses.data ?? [],
        dayPlans: dayPlans.data ?? [],
        birthdays: birthdays.data ?? [],
        meetings: meetings.data ?? [],
        reminders: reminders.data ?? [],
        copyVault: copyVault.data ?? [],
        contacts: contacts.data ?? [],
        exportedAt: new Date().toISOString()
      };

      const jsonStr = JSON.stringify(exportObj, null, 2);
      
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(jsonStr);
        Alert.alert('Data Exported', 'Backup JSON data copied to clipboard (sharing is unavailable on web).');
        return;
      }

      const fileUri = FileSystem.cacheDirectory + 'ahm_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        await Clipboard.setStringAsync(jsonStr);
        Alert.alert('Data Exported', 'Backup JSON data copied to clipboard (sharing is disabled).');
        return;
      }

      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export AHM Backup' });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setExporting(false);
    }
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
              <View style={styles.rowLeft}>
                <Feather name="lock" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Change PIN</Text>
              </View>
              <Feather name={changingPin ? "chevron-down" : "chevron-right"} size={16} color={colors.muted} />
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
            
            {/* Auto Lock Timer */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="clock" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Auto-lock Timeout</Text>
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={lockTimer}
                  onValueChange={updateLockTimer}
                  dropdownIconColor={colors.white}
                  style={styles.inlinePicker}
                >
                  <Picker.Item label="Immediately" value="Immediately" color={Platform.OS === 'ios' ? colors.white : undefined} />
                  <Picker.Item label="5 Min" value="5m" color={Platform.OS === 'ios' ? colors.white : undefined} />
                  <Picker.Item label="15 Min" value="15m" color={Platform.OS === 'ios' ? colors.white : undefined} />
                  <Picker.Item label="1 Hour" value="1h" color={Platform.OS === 'ios' ? colors.white : undefined} />
                  <Picker.Item label="Never" value="Never" color={Platform.OS === 'ios' ? colors.white : undefined} />
                </Picker>
              </View>
            </View>
            
            <View style={styles.separator} />
            <Pressable onPress={lockNow} style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="log-out" size={16} color={colors.red} style={{ marginRight: 12 }} />
                <Text style={[styles.rowLabel, { color: colors.red }]}>Lock App Now</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </Pressable>
          </View>

          {/* PREFERENCES */}
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="bell" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Enable Notifications</Text>
              </View>
              <Switch
                value={notifsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#3E3E3E', true: colors.green }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          {/* DATA EXPORT */}
          <Text style={styles.sectionLabel}>Data Management</Text>
          <View style={styles.group}>
            <Pressable onPress={exportData} disabled={exporting} style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="download" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Export Backup (JSON)</Text>
              </View>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Feather name="chevron-right" size={16} color={colors.muted} />
              )}
            </Pressable>
          </View>

          {/* ABOUT */}
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="info" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>App Name</Text>
              </View>
              <Text style={styles.rowValue}>AHM</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="tag" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Version</Text>
              </View>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Feather name="database" size={16} color={colors.white} style={{ marginRight: 12 }} />
                <Text style={styles.rowLabel}>Backend</Text>
              </View>
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
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { color:colors.white, fontSize:15, fontWeight:'600' },
  rowValue: { color:colors.muted, fontSize:14 },
  separator: { height:1, backgroundColor:colors.border, marginLeft:18 },
  pinForm: { paddingHorizontal:18, paddingBottom:16 },
  pinInput: { height:48, backgroundColor:colors.surfaceLight, borderRadius:16, borderWidth:1, borderColor:colors.border, color:colors.white, paddingHorizontal:14, fontSize:15, marginBottom:10 },
  smallBtn: { backgroundColor:colors.white, borderRadius:16, height:44, alignItems:'center', justifyContent:'center' },
  smallBtnText: { color:colors.black, fontWeight:'700', fontSize:14 },
  pickerContainer: { width: 140, height: 40, justifyContent: 'center', overflow: 'hidden' },
  inlinePicker: { color: colors.white, backgroundColor: 'transparent', width: 140, height: 40 }
});
