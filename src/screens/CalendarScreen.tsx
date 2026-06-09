import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, FlatList, PanResponder, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  cancelAllDayPlanNotifications,
  prepareNotifications,
  scheduleAllDayPlanNotifications
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { DayPlan, RootStackParamList } from '../lib/types';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PLAN_TYPES = ['Work', 'Meeting', 'Personal', 'Other'];

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime12hr(d: Date) {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const modifier = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${String(hours).padStart(2, '0')}:${minutes} ${modifier}`;
}

function buildCalDays(year: number, month: number): (number|null)[] {
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0;i<first;i++) cells.push(null);
  for (let d=1;d<=last;d++) cells.push(d);
  return cells;
}

// Swipe row for deletion
function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const tx = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => { if (g.dx < 0) tx.setValue(Math.max(g.dx, -80)); },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) Animated.spring(tx, { toValue: -80, useNativeDriver: true }).start();
        else Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 10 }}>
      <Pressable
        onPress={() => { Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start(); onDelete(); }}
        style={styles.delBtn}
      >
        <Text style={styles.delBtnText}>Delete</Text>
      </Pressable>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export function CalendarScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Calendar'>) {
  const { showUndo } = useUndo();
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [modalVisible, setModalVisible] = useState(false);
  
  // Add plan form states
  const [planTitle, setPlanTitle] = useState('');
  const [planDetails, setPlanDetails] = useState('');
  const [planType, setPlanType] = useState('Other');
  const [planDate, setPlanDate] = useState(new Date());
  const [planTime, setPlanTime] = useState(new Date());
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const calPanResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_,g) => Math.abs(g.dx)>25 && Math.abs(g.dy)<30,
    onPanResponderRelease: (_,g) => {
      if (g.dx < -60) setViewMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1));
      else if (g.dx > 60) setViewMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1));
    }
  })).current;

  useEffect(() => { prepareNotifications(); loadPlans(); }, []);

  async function loadPlans() {
    setLoading(true);
    const { data, error } = await supabase.from('day_plans').select('*').order('plan_time', { ascending: true });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setPlans(data ?? []);
  }

  const calDays = useMemo(() => buildCalDays(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const datesWithPlans = useMemo(() => {
    const s = new Set<string>();
    plans.forEach(p => {
      if (p.plan_date) {
        s.add(p.plan_date);
      }
    });
    return s;
  }, [plans]);
  
  const plansForSelected = useMemo(() => plans.filter(p => p.plan_date === selectedDate), [plans, selectedDate]);
  const today = toIsoDate(new Date());

  async function savePlan() {
    if (!planTitle.trim()) { Alert.alert('Missing', 'Enter a plan title.'); return; }
    
    const formattedDate = toIsoDate(planDate);
    const formattedTime = formatTime12hr(planTime);
    
    // Insert into DB
    const { data, error } = await supabase.from('day_plans').insert({
      title: planTitle.trim(),
      plan_date: formattedDate,
      plan_time: formattedTime,
      details: planDetails.trim() || null,
      plan_type: planType,
      notification_id: null,
      notification_early_id: null
    }).select().single();
    
    if (error || !data) { Alert.alert('Error', error?.message || 'Failed to save plan'); return; }
    
    // Schedule local notifications
    try {
      await scheduleAllDayPlanNotifications(data);
    } catch (e) {
      console.error('Failed to schedule day plan notifications:', e);
    }
    
    // Reset form
    setPlanTitle('');
    setPlanDetails('');
    setPlanType('Other');
    setPlanDate(new Date());
    setPlanTime(new Date());
    setModalVisible(false);
    await loadPlans();
  }

  async function deletePlan(plan: DayPlan) {
    // Cancel notifications immediately
    await cancelAllDayPlanNotifications(plan.id);
    
    // Optimistically remove from state
    setPlans(prev => prev.filter(p => p.id !== plan.id));
    
    showUndo({
      label: `Deleted plan: ${plan.title}`,
      onRestore: async () => {
        setPlans(prev => [...prev, plan].sort((a,b) => a.plan_time.localeCompare(b.plan_time)));
        // Re-schedule notifications
        await scheduleAllDayPlanNotifications(plan);
      },
      onConfirmDelete: async () => {
        await supabase.from('day_plans').delete().eq('id', plan.id);
      }
    });
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Calendar" navigation={navigation} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Calendar */}
          <View style={styles.calCard} {...calPanResponder.panHandlers}>
            <View style={styles.monthNav}>
              <Pressable onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))} style={styles.navBtn}>
                <Text style={styles.navBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</Text>
              <Pressable onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))} style={styles.navBtn}>
                <Text style={styles.navBtnText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.dayHeaders}>
              {DAYS.map(d => <Text key={d} style={styles.dayHeader}>{d}</Text>)}
            </View>
            <View style={styles.grid}>
              {calDays.map((day, i) => {
                if (day === null) return <View key={`e${i}`} style={styles.cell} />;
                const iso = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isToday = iso === today;
                const isSel = iso === selectedDate;
                const hasPlan = datesWithPlans.has(iso);
                return (
                  <Pressable key={iso} onPress={() => setSelectedDate(iso)} style={styles.cell}>
                    <View style={[styles.dayCircle, isSel && styles.dayCircleSel, isToday && !isSel && styles.dayCircleToday]}>
                      <Text style={[styles.dayNum, isSel && styles.dayNumSel, isToday && !isSel && styles.dayNumToday]}>{day}</Text>
                    </View>
                    {hasPlan && <View style={[styles.dot, isSel && styles.dotSel]} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Agenda */}
          <Text style={styles.agendaTitle}>{selectedDate === today ? "Today's Plans" : `Plans · ${selectedDate}`}</Text>
          {loading ? <ActivityIndicator color={colors.white} style={{ marginTop:20 }} />
            : plansForSelected.length === 0 ? <Text style={styles.empty}>No plans for this day.</Text>
            : plansForSelected.map(plan => (
              <SwipeRow key={plan.id} onDelete={() => deletePlan(plan)}>
                <View style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={styles.planLeft}>
                      <Feather name="calendar" size={16} color={colors.green} style={{ marginRight: 8 }} />
                      <Text style={styles.planTimeText}>{plan.plan_time}</Text>
                    </View>
                    <View style={styles.typeTag}>
                      <Text style={styles.typeTagText}>{plan.plan_type}</Text>
                    </View>
                  </View>
                  <Text style={styles.planTitleText}>{plan.title}</Text>
                  {plan.details && <Text style={styles.planDetailsText}>{plan.details}</Text>}
                </View>
              </SwipeRow>
            ))
          }
        </ScrollView>
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />
      
      <FormModal visible={modalVisible} title="Add Day Plan" onClose={() => setModalVisible(false)}>
        <Field label="Plan Title" value={planTitle} onChangeText={setPlanTitle} />
        
        <Field label="Details / Location" value={planDetails} onChangeText={setPlanDetails} multiline numberOfLines={2} />
        
        <Text style={sharedStyles.label}>Plan Type</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={planType}
            onValueChange={(v) => setPlanType(v)}
            dropdownIconColor={colors.white}
            style={styles.picker}
          >
            {PLAN_TYPES.map((item) => (
              <Picker.Item key={item} label={item} value={item} color={Platform.OS === 'ios' ? colors.white : undefined} />
            ))}
          </Picker>
        </View>

        <Text style={sharedStyles.label}>Plan Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateBtn, { marginBottom: 16 }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={toIsoDate(planDate)}
              onChange={(e: any) => { if (e.target.value) setPlanDate(new Date(e.target.value + 'T00:00:00')); }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>{toIsoDate(planDate)}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={planDate}
                mode="date"
                display={Platform.OS==='ios'?'spinner':'default'}
                minimumDate={new Date()}
                onChange={(_,d) => { if (Platform.OS!=='ios') setShowDatePicker(false); if(d) setPlanDate(d); }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Text style={sharedStyles.label}>Plan Time</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateBtn, { marginBottom: 20 }]}>
            {/* @ts-ignore */}
            <input
              type="time"
              value={`${String(planTime.getHours()).padStart(2, '0')}:${String(planTime.getMinutes()).padStart(2, '0')}`}
              onChange={(e: any) => {
                if (e.target.value) {
                  const [h, m] = e.target.value.split(':').map(Number);
                  const t = new Date(); t.setHours(h, m, 0, 0); setPlanTime(t);
                }
              }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowTimePicker(true)} style={[styles.dateBtn, { marginBottom: 20 }]}>
              <Text style={styles.dateBtnText}>{formatTime12hr(planTime)}</Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={planTime}
                mode="time"
                display={Platform.OS==='ios'?'spinner':'default'}
                onChange={(_,t) => { if (Platform.OS!=='ios') setShowTimePicker(false); if(t) setPlanTime(t); }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Pressable onPress={savePlan} style={({ pressed }) => [styles.saveBtn, pressed && { opacity:0.85 }]}>
          <Text style={styles.saveBtnText}>Save Plan</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  calCard: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16, marginBottom:20, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:4 },
  monthNav: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  navBtn: { width:36, height:36, alignItems:'center', justifyContent:'center', backgroundColor:colors.surfaceLight, borderRadius:16, borderWidth:1, borderColor:colors.border },
  navBtnText: { color:colors.white, fontSize:22, fontWeight:'600' },
  monthLabel: { color:colors.white, fontSize:16, fontWeight:'700' },
  dayHeaders: { flexDirection:'row', marginBottom:8 },
  dayHeader: { flex:1, textAlign:'center', color:colors.muted, fontSize:10, fontWeight:'700', textTransform:'uppercase' },
  grid: { flexDirection:'row', flexWrap:'wrap' },
  cell: { width:`${100/7}%`, alignItems:'center', marginBottom:4 },
  dayCircle: { width:38, height:38, borderRadius:19, alignItems:'center', justifyContent:'center' },
  dayCircleSel: { backgroundColor:colors.white },
  dayCircleToday: { borderWidth:1.5, borderColor:colors.green },
  dayNum: { color:colors.white, fontSize:13, fontWeight:'500' },
  dayNumSel: { color:colors.black, fontWeight:'700' },
  dayNumToday: { color:colors.green, fontWeight:'700' },
  dot: { width:4, height:4, borderRadius:2, backgroundColor:colors.green, marginTop:2 },
  dotSel: { backgroundColor:colors.black },
  agendaTitle: { color:colors.white, fontSize:15, fontWeight:'700', marginBottom:12 },
  planCard: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planLeft: { flexDirection: 'row', alignItems: 'center' },
  planTimeText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  typeTag: { backgroundColor: 'rgba(255, 255, 255, 0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  typeTagText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  planTitleText: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  planDetailsText: { color: colors.muted, fontSize: 13 },
  empty: { color:colors.muted, textAlign:'center', marginTop:20, fontSize:14 },
  dateBtn: { minHeight:52, backgroundColor:colors.surfaceLight, borderRadius:16, borderWidth:1, borderColor:colors.border, paddingHorizontal:16, justifyContent:'center', marginBottom:16 },
  dateBtnText: { color:colors.white, fontSize:16, fontWeight:'600' },
  saveBtn: { minHeight:56, borderRadius:16, backgroundColor:colors.green, alignItems:'center', justifyContent:'center', marginTop:8 },
  saveBtnText: { color:colors.white, fontSize:16, fontWeight:'700' },
  delBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginBottom: 16, overflow: 'hidden', backgroundColor: colors.bg },
  picker: { color: colors.white, backgroundColor: colors.bg, height: 56 }
});
