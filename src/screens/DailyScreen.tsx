import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, FlatList, PanResponder,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { scheduleAllBirthdayNotifications, cancelAllBirthdayNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { BirthdayEntry, RootStackParamList, TaskEntry } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function daysUntil(day: number, month: number): number {
  const today = new Date();
  let next = new Date(today.getFullYear(), month-1, day);
  if (next <= today) next = new Date(today.getFullYear()+1, month-1, day);
  return Math.ceil((next.getTime() - today.getTime()) / (1000*60*60*24));
}

function getHour() { return new Date().getHours(); }

// Swipeable row for birthdays
function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const tx = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_,g) => Math.abs(g.dx)>8 && Math.abs(g.dy)<20,
    onPanResponderMove: (_,g) => { if(g.dx<0) tx.setValue(Math.max(g.dx,-80)); },
    onPanResponderRelease: (_,g) => {
      if(g.dx<-40) Animated.spring(tx,{toValue:-80,useNativeDriver:true}).start();
      else Animated.spring(tx,{toValue:0,useNativeDriver:true}).start();
    }
  })).current;
  return (
    <View style={{ overflow:'hidden', borderRadius:16, marginBottom:12 }}>
      <Pressable onPress={() => { Animated.spring(tx,{toValue:0,useNativeDriver:true}).start(); onDelete(); }} style={styles.delBtn}>
        <Text style={styles.delBtnText}>Delete</Text>
      </Pressable>
      <Animated.View style={{ transform:[{translateX:tx}] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export function DailyScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Daily'>) {
  const hour = getHour();
  const isMorning = hour < 12;
  const isEvening = hour >= 20;

  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingBirthdays, setLoadingBirthdays] = useState(true);

  // Morning brief
  const [morningGoal, setMorningGoal] = useState('');
  const [morningDismissed, setMorningDismissed] = useState(false);

  // EOD report
  const [eodReflection, setEodReflection] = useState('');
  const [eodDismissed, setEodDismissed] = useState(false);

  // Birthday form
  const [bdModalVisible, setBdModalVisible] = useState(false);
  const [bdName, setBdName] = useState('');
  const [bdDay, setBdDay] = useState('1');
  const [bdMonth, setBdMonth] = useState('1');
  const [bdNote, setBdNote] = useState('');

  // Tomorrow prep
  const [prepVisible, setPrepVisible] = useState(false);
  const [prep1, setPrep1] = useState('');
  const [prep2, setPrep2] = useState('');
  const [prep3, setPrep3] = useState('');

  useEffect(() => {
    loadTasks();
    loadBirthdays();
  }, []);

  async function loadTasks() {
    setLoadingTasks(true);
    const { data } = await supabase.from('tasks').select('*').order('finish_date', { ascending: true });
    setLoadingTasks(false);
    setTasks(data ?? []);
  }

  async function loadBirthdays() {
    setLoadingBirthdays(true);
    const { data, error } = await supabase.from('birthdays').select('*');
    setLoadingBirthdays(false);
    setBirthdays(data ?? []);
  }

  const today = new Date().toISOString().split('T')[0];
  const pendingToday = tasks.filter(t => t.finish_date === today);

  const sortedBirthdays = useMemo(() =>
    [...birthdays].sort((a,b) => daysUntil(a.day,a.month) - daysUntil(b.day,b.month)),
    [birthdays]
  );

  // Using imported birthday notification helpers

  async function saveBirthday() {
    const day = parseInt(bdDay);
    const month = parseInt(bdMonth);
    if (!bdName.trim() || isNaN(day) || isNaN(month) || day<1||day>31||month<1||month>12) {
      Alert.alert('Invalid', 'Enter a name and valid day/month.'); return;
    }
    const { data, error } = await supabase.from('birthdays').insert({ name: bdName.trim(), day, month, note: bdNote.trim()||null }).select().single();
    if (error || !data) { Alert.alert('Error', error?.message || 'Failed to save birthday'); return; }
    
    await scheduleAllBirthdayNotifications(data);
    
    setBdName(''); setBdDay('1'); setBdMonth('1'); setBdNote('');
    setBdModalVisible(false);
    await loadBirthdays();
  }

  async function deleteBirthday(id: string) {
    Alert.alert('Delete birthday?', '', [
      { text: 'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await cancelAllBirthdayNotifications(id);
        await supabase.from('birthdays').delete().eq('id',id);
        await loadBirthdays();
      }}
    ]);
  }

  async function saveTomorrowPrep() {
    if (!prep1.trim() && !prep2.trim() && !prep3.trim()) {
      Alert.alert('Add at least one priority.'); return;
    }
    const { error } = await supabase.from('tomorrow_prep').insert({
      item1: prep1.trim()||null, item2: prep2.trim()||null, item3: prep3.trim()||null,
      date: today
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setPrep1(''); setPrep2(''); setPrep3('');
    setPrepVisible(false);
    Alert.alert('Saved!', "Tomorrow's priorities saved.");
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Daily" navigation={navigation} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* Morning Brief */}
          {isMorning && !morningDismissed && (
            <View style={styles.briefCard}>
              <Text style={styles.briefGreeting}>Good Morning ☀️</Text>
              <View style={styles.briefStats}>
                <View style={styles.briefStat}>
                  <Text style={styles.briefStatNum}>{loadingTasks ? '—' : pendingToday.length}</Text>
                  <Text style={styles.briefStatLabel}>Tasks due today</Text>
                </View>
              </View>
              <TextInput
                style={styles.briefInput}
                placeholder="Set one goal for today..."
                placeholderTextColor={colors.muted}
                value={morningGoal}
                onChangeText={setMorningGoal}
              />
              <Pressable onPress={() => setMorningDismissed(true)} style={styles.dismissBtn}>
                <Text style={styles.dismissBtnText}>Start Day</Text>
              </Pressable>
            </View>
          )}

          {/* End of Day */}
          {isEvening && !eodDismissed && (
            <View style={[styles.briefCard, { borderColor: colors.green }]}>
              <Text style={styles.briefGreeting}>End of Day 🌙</Text>
              <View style={styles.briefStats}>
                <View style={styles.briefStat}>
                  <Text style={[styles.briefStatNum, { color: colors.red }]}>
                    {loadingTasks ? '—' : pendingToday.length}
                  </Text>
                  <Text style={styles.briefStatLabel}>Pending today</Text>
                </View>
              </View>
              <TextInput
                style={styles.briefInput}
                placeholder="One-line reflection for today..."
                placeholderTextColor={colors.muted}
                value={eodReflection}
                onChangeText={setEodReflection}
              />
              <Pressable onPress={() => setEodDismissed(true)} style={[styles.dismissBtn, { backgroundColor: colors.green }]}>
                <Text style={[styles.dismissBtnText, { color: colors.white }]}>Close Day</Text>
              </Pressable>
            </View>
          )}

          {/* Tomorrow Prep button */}
          <Pressable onPress={() => setPrepVisible(true)}
            style={({ pressed }) => [styles.prepBtn, pressed && { opacity:0.8 }]}>
            <Text style={styles.prepBtnText}>📋  Plan Tomorrow</Text>
          </Pressable>

          {/* Birthdays section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎂  Birthdays</Text>
            <Pressable onPress={() => setBdModalVisible(true)} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </Pressable>
          </View>

          {loadingBirthdays ? (
            <ActivityIndicator color={colors.white} style={{ marginTop: 12 }} />
          ) : sortedBirthdays.length === 0 ? (
            <Text style={styles.empty}>No birthdays saved.</Text>
          ) : (
            sortedBirthdays.map(bd => {
              const days = daysUntil(bd.day, bd.month);
              const isToday = days === 0 || days === 365;
              const isSoon = days <= 7;
              return (
                <SwipeRow key={bd.id} onDelete={() => deleteBirthday(bd.id)}>
                  <View style={[styles.bdCard, isToday && styles.bdCardToday]}>
                    <View style={styles.bdLeft}>
                      <Text style={styles.bdName}>{bd.name}</Text>
                      <Text style={styles.bdDate}>{bd.day} {MONTH_NAMES[bd.month-1]}</Text>
                      {bd.note ? <Text style={styles.bdNote}>{bd.note}</Text> : null}
                    </View>
                    <View style={styles.bdRight}>
                      <Text style={[styles.bdDays, isToday && { color: colors.green }, isSoon && !isToday && { color: colors.red }]}>
                        {isToday ? '🎉 Today' : `${days}d`}
                      </Text>
                    </View>
                  </View>
                </SwipeRow>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Tomorrow Prep modal */}
      <FormModal visible={prepVisible} title="Tomorrow's Priorities" onClose={() => setPrepVisible(false)}>
        <Text style={styles.prepHint}>What are your 3 priorities for tomorrow?</Text>
        <Field label="Priority 1" value={prep1} onChangeText={setPrep1} />
        <Field label="Priority 2" value={prep2} onChangeText={setPrep2} />
        <Field label="Priority 3" value={prep3} onChangeText={setPrep3} style={{ marginBottom:24 }} />
        <Pressable onPress={saveTomorrowPrep} style={({ pressed }) => [styles.saveBtn, pressed&&{opacity:0.85}]}>
          <Text style={styles.saveBtnText}>Save Priorities</Text>
        </Pressable>
      </FormModal>

      {/* Birthday modal */}
      <FormModal visible={bdModalVisible} title="Add Birthday" onClose={() => setBdModalVisible(false)}>
        <Field label="Name" value={bdName} onChangeText={setBdName} />
        <View style={styles.dayMonthRow}>
          <View style={{ flex:1, marginRight:8 }}>
            <Field label="Day (1-31)" value={bdDay} onChangeText={setBdDay} keyboardType="number-pad" />
          </View>
          <View style={{ flex:1 }}>
            <Field label="Month (1-12)" value={bdMonth} onChangeText={setBdMonth} keyboardType="number-pad" />
          </View>
        </View>
        <Field label="Note (optional)" value={bdNote} onChangeText={setBdNote} style={{ marginBottom:24 }} />
        <Pressable onPress={saveBirthday} style={({ pressed }) => [styles.saveBtn, pressed&&{opacity:0.85}]}>
          <Text style={styles.saveBtnText}>Save Birthday</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  briefCard: { backgroundColor:colors.card, borderRadius:16, borderWidth:1.5, borderColor:colors.border, padding:20, marginBottom:16 },
  briefGreeting: { color:colors.white, fontSize:22, fontWeight:'800', marginBottom:16, letterSpacing:-0.5 },
  briefStats: { flexDirection:'row', marginBottom:16 },
  briefStat: { marginRight:24 },
  briefStatNum: { color:colors.white, fontSize:32, fontWeight:'800', letterSpacing:-1 },
  briefStatLabel: { color:colors.muted, fontSize:12, fontWeight:'600', marginTop:2 },
  briefInput: { backgroundColor:colors.surfaceLight, borderRadius:16, borderWidth:1, borderColor:colors.border, color:colors.white, paddingHorizontal:14, paddingVertical:12, fontSize:15, marginBottom:16 },
  dismissBtn: { backgroundColor:colors.white, borderRadius:16, height:48, alignItems:'center', justifyContent:'center' },
  dismissBtnText: { color:colors.black, fontWeight:'700', fontSize:15 },
  prepBtn: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16, marginBottom:20, flexDirection:'row', alignItems:'center' },
  prepBtnText: { color:colors.white, fontSize:15, fontWeight:'700' },
  sectionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  sectionTitle: { color:colors.white, fontSize:16, fontWeight:'700' },
  addBtn: { backgroundColor:colors.surfaceLight, borderRadius:16, borderWidth:1, borderColor:colors.border, paddingVertical:6, paddingHorizontal:12 },
  addBtnText: { color:colors.white, fontSize:13, fontWeight:'700' },
  bdCard: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  bdCardToday: { borderColor:colors.green },
  bdLeft: { flex:1 },
  bdName: { color:colors.white, fontSize:16, fontWeight:'700', marginBottom:4 },
  bdDate: { color:colors.muted, fontSize:13 },
  bdNote: { color:colors.muted, fontSize:12, marginTop:4, fontStyle:'italic' },
  bdRight: { marginLeft:12 },
  bdDays: { color:colors.muted, fontSize:13, fontWeight:'700' },
  dayMonthRow: { flexDirection:'row' },
  prepHint: { color:colors.muted, fontSize:14, marginBottom:16, lineHeight:20 },
  saveBtn: { minHeight:56, borderRadius:16, backgroundColor:colors.green, alignItems:'center', justifyContent:'center', marginTop:8 },
  saveBtnText: { color:colors.white, fontSize:16, fontWeight:'700' },
  delBtn: { position:'absolute', right:0, top:0, bottom:0, width:80, backgroundColor:colors.red, alignItems:'center', justifyContent:'center', borderRadius:16 },
  delBtnText: { color:colors.white, fontWeight:'700', fontSize:13 },
  empty: { color:colors.muted, textAlign:'center', marginTop:20, fontSize:14 }
});
