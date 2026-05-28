import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, FlatList, PanResponder,
  Platform, Pressable, RefreshControl, StyleSheet, Text, View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Field } from '../components/Field';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  scheduleAllDayPlanNotifications,
  cancelAllDayPlanNotifications,
  convertTo24hr,
  parsePlanDateTime
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { DayPlan, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

function buildCalDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const last = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= last; d++) cells.push(d);
  return cells;
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'Personal': return colors.green;
    case 'Work': return '#3B82F6';
    case 'Important': return colors.red;
    default: return '#888888';
  }
}

function formatSelectedDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}

function timeToMinutes(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatTime12hr(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = String(minutes).padStart(2, '0');
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutesStr} ${ampm}`;
}

function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const tx = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => { if (g.dx < 0) tx.setValue(Math.max(g.dx, -80)); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -40) Animated.spring(tx, { toValue: -80, useNativeDriver: true }).start();
      else Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
    }
  })).current;
  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 12 }}>
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

export function DayScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Day'>) {
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(getTodayIST());

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DayPlan | null>(null);

  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(new Date());
  const [planTime, setPlanTime] = useState(new Date());
  const [details, setDetails] = useState('');
  const [planType, setPlanType] = useState('Personal');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadPlans();

    // Reload plans when screen gets focus (e.g. returning from details after deleting/editing)
    const unsubscribe = navigation.addListener('focus', () => {
      loadPlans();
    });
    return unsubscribe;
  }, [navigation]);

  async function loadPlans() {
    setLoading(true);
    const { data, error } = await supabase
      .from('day_plans')
      .select('*');
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setPlans(data ?? []);
  }

  async function handleRefresh() {
    setRefreshing(true);
    const { data } = await supabase.from('day_plans').select('*');
    setRefreshing(false);
    if (data) setPlans(data);
  }

  const calDays = useMemo(() => buildCalDays(viewMonth.getFullYear(), viewMonth.getMonth()), [viewMonth]);
  const datesWithPlans = useMemo(() => {
    const s = new Set<string>();
    plans.forEach(p => s.add(p.plan_date));
    return s;
  }, [plans]);

  const plansForSelected = useMemo(() => {
    return plans
      .filter(p => p.plan_date === selectedDate)
      .sort((a, b) => timeToMinutes(a.plan_time) - timeToMinutes(b.plan_time));
  }, [plans, selectedDate]);

  const today = getTodayIST();

  function openAddModal() {
    setEditingPlan(null);
    setTitle('');
    const [y, m, d] = selectedDate.split('-').map(Number);
    setPlanDate(new Date(y, m - 1, d));
    setPlanTime(new Date());
    setDetails('');
    setPlanType('Personal');
    setModalVisible(true);
  }

  function openEditModal(plan: DayPlan) {
    setEditingPlan(plan);
    setTitle(plan.title);

    const [y, m, d] = plan.plan_date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    setPlanDate(dateObj);

    const timeObj = new Date(dateObj);
    const match = plan.plan_time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      timeObj.setHours(hours, mins, 0, 0);
    }
    setPlanTime(timeObj);

    setDetails(plan.details || '');
    setPlanType(plan.plan_type || 'Personal');
    setModalVisible(true);
  }

  // Using imported day plan notification helpers

  async function savePlan() {
    if (!title.trim()) {
      Alert.alert('Missing', 'Please enter what you are planning.');
      return;
    }

    const dateStr = toIsoDate(planDate);
    const timeStr = formatTime12hr(planTime);

    if (editingPlan) {
      // Cancel old notifications first
      await cancelAllDayPlanNotifications(editingPlan.id);
    }

    let error;
    let data;
    if (editingPlan) {
      const res = await supabase
        .from('day_plans')
        .update({
          title: title.trim(),
          plan_date: dateStr,
          plan_time: timeStr,
          details: details.trim() || null,
          plan_type: planType
        })
        .eq('id', editingPlan.id)
        .select()
        .single();
      error = res.error;
      data = res.data;
    } else {
      const res = await supabase.from('day_plans').insert({
        title: title.trim(),
        plan_date: dateStr,
        plan_time: timeStr,
        details: details.trim() || null,
        plan_type: planType
      }).select().single();
      error = res.error;
      data = res.data;
    }

    if (error || !data) {
      Alert.alert('Error', error?.message || 'Failed to save plan');
      return;
    }

    // Schedule notifications for saved plan
    await scheduleAllDayPlanNotifications(data);

    setModalVisible(false);
    setEditingPlan(null);
    await loadPlans();
  }

  async function handleDelete(plan: DayPlan) {
    Alert.alert('Delete Plan?', `Are you sure you want to delete "${plan.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelAllDayPlanNotifications(plan.id);
          const { error } = await supabase.from('day_plans').delete().eq('id', plan.id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            await loadPlans();
          }
        }
      }
    ]);
  }

  function handleLongPress(plan: DayPlan) {
    Alert.alert('Plan Actions', plan.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEditModal(plan) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(plan) }
    ]);
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Day" navigation={navigation} />

        {/* Top Fixed Calendar */}
        <View style={styles.calCard}>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</Text>
            <Pressable onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.dayHeaders}>
            {DAYS.map((d, index) => <Text key={`hdr-${index}`} style={styles.dayHeader}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {calDays.map((day, i) => {
              if (day === null) return <View key={`empty-${i}`} style={styles.cell} />;
              const iso = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = iso === today;
              const isSel = iso === selectedDate;
              const hasPlans = datesWithPlans.has(iso);
              return (
                <Pressable key={iso} onPress={() => setSelectedDate(iso)} style={styles.cell}>
                  <View style={[
                    styles.dayCircle,
                    isSel && styles.dayCircleSel,
                    isToday && !isSel && styles.dayCircleToday
                  ]}>
                    <Text style={[
                      styles.dayNum,
                      isSel && styles.dayNumSel,
                      isToday && !isSel && styles.dayNumToday
                    ]}>{day}</Text>
                  </View>
                  {hasPlans && <View style={[styles.dot, isSel && styles.dotSel]} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected date view & plan list (Middle Section) */}
        <View style={{ flex: 1 }}>
          <View style={styles.selectedDateHeader}>
            <Text style={styles.selectedDateTitle}>{formatSelectedDate(selectedDate)}</Text>
            <Text style={styles.selectedDateSubtitle}>
              {plansForSelected.length} {plansForSelected.length === 1 ? 'thing' : 'things'} planned
            </Text>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={plansForSelected}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.white} />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Nothing planned for this day</Text>
                  <Text style={styles.emptySubtext}>— tap + to add something</Text>
                </View>
              }
              renderItem={({ item }) => (
                <SwipeRow onDelete={() => handleDelete(item)}>
                  <Pressable
                    onPress={() => navigation.navigate('DayDetail', { planId: item.id })}
                    onLongPress={() => handleLongPress(item)}
                    style={styles.planCard}
                  >
                    <View style={styles.planCardLeft}>
                      <Text style={styles.planTimeText}>{item.plan_time}</Text>
                    </View>
                    <View style={styles.planCardMiddle}>
                      <Text style={styles.planTitleText}>{item.title}</Text>
                      {!!item.details && (
                        <Text style={styles.planDetailsText} numberOfLines={2}>{item.details}</Text>
                      )}
                    </View>
                    <View style={styles.planCardRight}>
                      <View style={[styles.typeIndicatorDot, { backgroundColor: getTypeColor(item.plan_type) }]} />
                    </View>
                  </Pressable>
                </SwipeRow>
              )}
            />
          )}
        </View>
      </View>

      {/* Plan Day Button (Fixed Bottom) */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={openAddModal}
          style={({ pressed }) => [styles.planBtn, pressed && { opacity: 0.85 }]}
        >
          <Feather name="plus" size={18} color={colors.black} style={{ marginRight: 8 }} />
          <Text style={styles.planBtnText}>Plan Day</Text>
        </Pressable>
      </View>

      {/* Form Modal for Add / Edit Plan */}
      <FormModal
        visible={modalVisible}
        title={editingPlan ? "Edit Plan" : "Add Plan"}
        onClose={() => {
          setModalVisible(false);
          setEditingPlan(null);
        }}
      >
        <Field
          label="What are you planning"
          placeholder="What's the plan?"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={sharedStyles.label}>Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.pickerBtn, { marginBottom: 16 }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={`${planDate.getFullYear()}-${String(planDate.getMonth() + 1).padStart(2, '0')}-${String(planDate.getDate()).padStart(2, '0')}`}
              onChange={(e: any) => { if (e.target.value) setPlanDate(new Date(e.target.value + 'T00:00:00')); }}
              style={styles.webPickerInput}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.pickerBtn}>
              <Text style={styles.pickerBtnText}>
                {planDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={planDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (d) setPlanDate(d);
                }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Text style={sharedStyles.label}>Time</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.pickerBtn, { marginBottom: 16 }]}>
            {/* @ts-ignore */}
            <input
              type="time"
              value={`${String(planTime.getHours()).padStart(2, '0')}:${String(planTime.getMinutes()).padStart(2, '0')}`}
              onChange={(e: any) => {
                if (e.target.value) {
                  const [h, m] = e.target.value.split(':').map(Number);
                  const t = new Date(planDate);
                  t.setHours(h, m, 0, 0);
                  setPlanTime(t);
                }
              }}
              style={styles.webPickerInput}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowTimePicker(true)} style={styles.pickerBtn}>
              <Text style={styles.pickerBtnText}>
                {planTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={planTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, t) => {
                  if (Platform.OS !== 'ios') setShowTimePicker(false);
                  if (t) setPlanTime(t);
                }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Field
          label="Details (optional)"
          placeholder="Any details..."
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, paddingTop: 6 }}
        />

        <Text style={sharedStyles.label}>Plan Type</Text>
        <View style={styles.typeChips}>
          {['Personal', 'Work', 'Important', 'Other'].map(type => {
            const isSel = planType === type;
            const color = getTypeColor(type);
            return (
              <Pressable
                key={type}
                onPress={() => setPlanType(type)}
                style={[
                  styles.typeChip,
                  isSel && styles.typeChipSel,
                  isSel && { borderColor: color }
                ]}
              >
                <View style={[styles.typeDot, { backgroundColor: color }]} />
                <Text style={[styles.typeChipText, isSel && styles.typeChipTextSel]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={savePlan}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>{editingPlan ? "Save Plan" : "Add Plan"}</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  calCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  navBtnText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '600'
  },
  monthLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700'
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    marginBottom: 4
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayCircleSel: {
    backgroundColor: colors.white
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.white
  },
  dayNum: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '500'
  },
  dayNumSel: {
    color: colors.black,
    fontWeight: '700'
  },
  dayNumToday: {
    color: colors.white,
    fontWeight: '700'
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.green,
    marginTop: 2
  },
  dotSel: {
    backgroundColor: colors.black
  },
  selectedDateHeader: {
    marginBottom: 16
  },
  selectedDateTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4
  },
  selectedDateSubtitle: {
    color: colors.muted,
    fontSize: 13
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  planCardLeft: {
    width: 90,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingRight: 12,
    marginRight: 12
  },
  planTimeText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '700'
  },
  planCardMiddle: {
    flex: 1
  },
  planTitleText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  planDetailsText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  planCardRight: {
    paddingLeft: 8
  },
  typeIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20
  },
  emptyText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4
  },
  emptySubtext: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20
  },
  planBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  planBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700'
  },
  pickerBtn: {
    minHeight: 52,
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 16
  },
  pickerBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600'
  },
  webPickerInput: {
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    width: '100%',
    outline: 'none',
    cursor: 'pointer'
  } as any,
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight
  },
  typeChipSel: {
    backgroundColor: colors.card
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8
  },
  typeChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600'
  },
  typeChipTextSel: {
    color: colors.white
  },
  saveBtn: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  saveBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700'
  },
  delBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16
  },
  delBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13
  }
});
