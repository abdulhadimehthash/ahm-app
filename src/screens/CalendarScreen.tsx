import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, FlatList, PanResponder, Platform,
  Pressable, ScrollView, StyleSheet, Text, View
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { cancelCalendarTodoNotification, prepareNotifications, scheduleCalendarTodoNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { CalendarTodo, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildCalDays(year: number, month: number): (number|null)[] {
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [];
  for (let i=0;i<first;i++) cells.push(null);
  for (let d=1;d<=last;d++) cells.push(d);
  return cells;
}

export function CalendarScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Calendar'>) {
  const [todos, setTodos] = useState<CalendarTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [modalVisible, setModalVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDate, setTaskDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const calPanResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_,g) => Math.abs(g.dx)>25 && Math.abs(g.dy)<30,
    onPanResponderRelease: (_,g) => {
      if (g.dx < -60) setViewMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1));
      else if (g.dx > 60) setViewMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1));
    }
  })).current;

  useEffect(() => { prepareNotifications(); loadTodos(); }, []);

  async function loadTodos() {
    setLoading(true);
    const { data, error } = await supabase.from('calendar_todos').select('*').order('due_date', { ascending: true });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setTodos(data ?? []);
  }

  const calDays = useMemo(() => buildCalDays(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const datesWithTodos = useMemo(() => { const s = new Set<string>(); todos.forEach(t => s.add(t.due_date)); return s; }, [todos]);
  const todosForSelected = useMemo(() => todos.filter(t => t.due_date === selectedDate), [todos, selectedDate]);
  const today = toIsoDate(new Date());

  async function saveTodo() {
    if (!taskName.trim()) { Alert.alert('Missing', 'Enter a task name.'); return; }
    const due_date = toIsoDate(taskDate);
    const notifId = await scheduleCalendarTodoNotification({ name: taskName.trim(), due_date });
    const { error } = await supabase.from('calendar_todos').insert({ name: taskName.trim(), due_date, completed: false, notification_id: notifId ?? null });
    if (error) { Alert.alert('Error', error.message); return; }
    setTaskName(''); setTaskDate(new Date()); setModalVisible(false);
    await loadTodos();
  }

  async function toggleTodo(todo: CalendarTodo) {
    await supabase.from('calendar_todos').update({ completed: !todo.completed }).eq('id', todo.id);
    await loadTodos();
  }

  async function deleteTodo(todo: CalendarTodo) {
    Alert.alert('Delete?', todo.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await cancelCalendarTodoNotification(todo.notification_id);
        await supabase.from('calendar_todos').delete().eq('id', todo.id);
        await loadTodos();
      }}
    ]);
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
                const hasTodo = datesWithTodos.has(iso);
                return (
                  <Pressable key={iso} onPress={() => setSelectedDate(iso)} style={styles.cell}>
                    <View style={[styles.dayCircle, isSel && styles.dayCircleSel, isToday && !isSel && styles.dayCircleToday]}>
                      <Text style={[styles.dayNum, isSel && styles.dayNumSel, isToday && !isSel && styles.dayNumToday]}>{day}</Text>
                    </View>
                    {hasTodo && <View style={[styles.dot, isSel && styles.dotSel]} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Agenda */}
          <Text style={styles.agendaTitle}>{selectedDate === today ? "Today's To-Dos" : `To-Dos · ${selectedDate}`}</Text>
          {loading ? <ActivityIndicator color={colors.white} style={{ marginTop:20 }} />
            : todosForSelected.length === 0 ? <Text style={styles.empty}>No to-dos for this day.</Text>
            : todosForSelected.map(todo => (
              <Pressable key={todo.id} onPress={() => toggleTodo(todo)} onLongPress={() => deleteTodo(todo)}
                style={({ pressed }) => [styles.todoCard, pressed && { opacity:0.8 }]}>
                <View style={[styles.todoCheck, todo.completed && styles.todoCheckDone]}>
                  {todo.completed && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.todoName, todo.completed && styles.todoNameDone]}>{todo.name}</Text>
              </Pressable>
            ))
          }
        </ScrollView>
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />
      <FormModal visible={modalVisible} title="Add To-Do" onClose={() => setModalVisible(false)}>
        <Field label="Task Name" value={taskName} onChangeText={setTaskName} />
        <Text style={sharedStyles.label}>Due Date</Text>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>{toIsoDate(taskDate)}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker value={taskDate} mode="date" display={Platform.OS==='ios'?'spinner':'default'}
            minimumDate={new Date()} onChange={(_,d) => { if (Platform.OS!=='ios') setShowDatePicker(false); if(d) setTaskDate(d); }}
            textColor={colors.white} />
        )}
        <Pressable onPress={saveTodo} style={({ pressed }) => [styles.saveBtn, pressed && { opacity:0.85 }]}>
          <Text style={styles.saveBtnText}>Save To-Do</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  calCard: { backgroundColor:colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:16, marginBottom:20, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:4 },
  monthNav: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  navBtn: { width:36, height:36, alignItems:'center', justifyContent:'center', backgroundColor:colors.surfaceLight, borderRadius:10, borderWidth:1, borderColor:colors.border },
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
  todoCard: { backgroundColor:colors.card, borderRadius:14, borderWidth:1, borderColor:colors.border, padding:14, flexDirection:'row', alignItems:'center', marginBottom:10 },
  todoCheck: { width:24, height:24, borderRadius:8, borderWidth:2, borderColor:colors.border, marginRight:12, alignItems:'center', justifyContent:'center' },
  todoCheckDone: { backgroundColor:colors.green, borderColor:colors.green },
  checkMark: { color:colors.white, fontSize:13, fontWeight:'700' },
  todoName: { color:colors.white, fontSize:15, fontWeight:'600', flex:1 },
  todoNameDone: { color:colors.muted, textDecorationLine:'line-through' },
  empty: { color:colors.muted, textAlign:'center', marginTop:20, fontSize:14 },
  dateBtn: { minHeight:52, backgroundColor:colors.surfaceLight, borderRadius:12, borderWidth:1, borderColor:colors.border, paddingHorizontal:16, justifyContent:'center', marginBottom:20 },
  dateBtnText: { color:colors.white, fontSize:16, fontWeight:'600' },
  saveBtn: { minHeight:56, borderRadius:12, backgroundColor:colors.green, alignItems:'center', justifyContent:'center', marginTop:8 },
  saveBtnText: { color:colors.white, fontSize:16, fontWeight:'700' }
});
