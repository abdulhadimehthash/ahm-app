import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Platform, Pressable,
  ScrollView, StyleSheet, Text, View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { Field } from '../components/Field';
import { FormModal } from '../components/FormModal';
import {
  scheduleDayPlanNotifications,
  cancelDayPlanNotifications
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { DayPlan, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'Personal': return colors.green;
    case 'Work': return '#3B82F6';
    case 'Important': return colors.red;
    default: return '#888888';
  }
}

function formatPlanDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = daysOfWeek[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
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

export function DayDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'DayDetail'>) {
  const { planId } = route.params;

  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit fields
  const [editVisible, setEditVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [planDate, setPlanDate] = useState(new Date());
  const [planTime, setPlanTime] = useState(new Date());
  const [details, setDetails] = useState('');
  const [planType, setPlanType] = useState('Personal');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadPlan();
  }, [planId]);

  async function loadPlan() {
    setLoading(true);
    const { data, error } = await supabase
      .from('day_plans')
      .select('*')
      .eq('id', planId)
      .single();
    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Plan not found.');
      navigation.goBack();
      return;
    }

    setPlan(data);
  }

  function handleOpenEdit() {
    if (!plan) return;
    setTitle(plan.title);
    
    const [y, m, d] = plan.plan_date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    setPlanDate(dateObj);

    // Parse time
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
    setEditVisible(true);
  }

  async function saveEdit() {
    if (!plan) return;
    if (!title.trim()) {
      Alert.alert('Missing', 'Please enter what you are planning.');
      return;
    }

    const dateStr = toIsoDate(planDate);
    const timeStr = formatTime12hr(planTime);

    // Cancel old notifications first
    await cancelDayPlanNotifications(plan);

    // Schedule new notifications
    const { notification_id, notification_early_id } = await scheduleDayPlanNotifications({
      title: title.trim(),
      plan_date: dateStr,
      plan_time: timeStr
    });

    const { error } = await supabase
      .from('day_plans')
      .update({
        title: title.trim(),
        plan_date: dateStr,
        plan_time: timeStr,
        details: details.trim() || null,
        notification_id,
        notification_early_id,
        plan_type: planType
      })
      .eq('id', plan.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setEditVisible(false);
    await loadPlan();
  }

  async function handleDelete() {
    if (!plan) return;

    Alert.alert('Delete Plan?', `Are you sure you want to delete "${plan.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelDayPlanNotifications(plan);
          const { error } = await supabase.from('day_plans').delete().eq('id', plan.id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            navigation.goBack();
          }
        }
      }
    ]);
  }

  if (loading) {
    return (
      <View style={[sharedStyles.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  if (!plan) return null;

  const typeColor = getTypeColor(plan.plan_type);

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.navBtn}>
            <Feather name="arrow-left" size={20} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Plan Details</Text>
          <Pressable onPress={handleOpenEdit} style={styles.navBtn}>
            <Feather name="edit-2" size={18} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Tag Type Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { borderColor: typeColor }]}>
              <View style={[styles.badgeDot, { backgroundColor: typeColor }]} />
              <Text style={[styles.badgeText, { color: colors.white }]}>{plan.plan_type}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.titleText}>{plan.title}</Text>

          {/* Time & Date Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={16} color={colors.muted} style={styles.infoIcon} />
              <Text style={styles.infoText}>{formatPlanDate(plan.plan_date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="clock" size={16} color={colors.green} style={styles.infoIcon} />
              <Text style={[styles.infoText, { color: colors.green, fontWeight: '700' }]}>{plan.plan_time}</Text>
            </View>
          </View>

          {/* Details */}
          {!!plan.details && (
            <View style={styles.detailsContainer}>
              <Text style={styles.detailsHeader}>Details</Text>
              <Text style={styles.detailsText}>{plan.details}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Delete Button at bottom */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
        >
          <Feather name="trash-2" size={16} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>Delete Plan</Text>
        </Pressable>
      </View>

      {/* Edit Form Modal */}
      <FormModal visible={editVisible} title="Edit Plan" onClose={() => setEditVisible(false)}>
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
          onPress={saveEdit}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700'
  },
  navBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    paddingBottom: 120
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 16
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: colors.card
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  titleText: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 20
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginBottom: 24
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoIcon: {
    marginRight: 12,
    width: 20,
    textAlign: 'center'
  },
  infoText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600'
  },
  detailsContainer: {
    gap: 8
  },
  detailsHeader: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  detailsText: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 24
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20
  },
  deleteBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  deleteBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700'
  },
  pickerBtn: {
    minHeight: 52,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
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
    borderRadius: 20,
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
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  saveBtnText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700'
  }
});
