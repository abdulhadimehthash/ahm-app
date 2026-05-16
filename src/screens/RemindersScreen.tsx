import React, { useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, FlatList, PanResponder, Platform,
  Pressable, StyleSheet, Text, View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  cancelReminderNotifications,
  prepareNotifications,
  scheduleReminderNotification
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { Reminder, RootStackParamList } from '../lib/types';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
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

export function RemindersScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Reminders'>) {
  const { showUndo } = useUndo();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  useEffect(() => { prepareNotifications(); loadReminders(); }, []);

  async function loadReminders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('remind_at', { ascending: true });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setReminders(data ?? []);
  }

  async function saveReminder() {
    if (!description.trim()) { Alert.alert('Missing', 'Enter a reminder description.'); return; }
    const combined = new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      time.getHours(), time.getMinutes(), 0
    );
    if (combined <= new Date()) { Alert.alert('Invalid', 'Please choose a future date and time.'); return; }

    const { notification_id, notification_early_id } = await scheduleReminderNotification({
      description: description.trim(),
      remind_at: combined.toISOString()
    });

    const { error } = await supabase.from('reminders').insert({
      description: description.trim(),
      remind_at: combined.toISOString(),
      fired: false,
      notification_id: notification_id ?? null,
      notification_early_id: notification_early_id ?? null,
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setDescription(''); setDate(new Date()); setTime(new Date());
    setModalVisible(false);
    await loadReminders();
  }

  function handleDelete(reminder: Reminder) {
    // Cancel notifications immediately
    cancelReminderNotifications(reminder);
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    showUndo({
      label: `Deleted: ${reminder.description}`,
      onRestore: async () => {
        setReminders((prev) =>
          [...prev, reminder].sort((a, b) =>
            new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
          )
        );
      },
      onConfirmDelete: async () => {
        await supabase.from('reminders').delete().eq('id', reminder.id);
      },
    });
  }

  const now = new Date();
  const upcoming = reminders.filter(r => new Date(r.remind_at) > now);
  const past = reminders.filter(r => new Date(r.remind_at) <= now);

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Reminders" navigation={navigation} />

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={[...upcoming, ...past]}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔔</Text>
                <Text style={styles.emptyText}>No reminders yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first reminder</Text>
              </View>
            }
            ListHeaderComponent={upcoming.length > 0 ? (
              <Text style={styles.sectionLabel}>Upcoming</Text>
            ) : null}
            renderItem={({ item, index }) => {
              const isPast = new Date(item.remind_at) <= now;
              const showPastHeader = isPast && (index === 0 || new Date(reminders[index - 1]?.remind_at) > now);
              return (
                <>
                  {showPastHeader && <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Past</Text>}
                  <SwipeRow onDelete={() => handleDelete(item)}>
                    <View style={[styles.card, isPast && styles.cardPast]}>
                      <View style={[styles.dot, { backgroundColor: isPast ? colors.red : colors.green }]} />
                      <View style={styles.cardContent}>
                        <Text style={[styles.cardTitle, isPast && styles.cardTitlePast]}>
                          {item.description}
                        </Text>
                        <Text style={styles.cardTime}>{formatDateTime(item.remind_at)}</Text>
                      </View>
                    </View>
                  </SwipeRow>
                </>
              );
            }}
          />
        )}
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />

      <FormModal visible={modalVisible} title="Add Reminder" onClose={() => setModalVisible(false)}>
        <Field
          label="What to remind you?"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 80, paddingTop: 12 }}
        />

        <Text style={sharedStyles.label}>Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.pickerBtn, { marginBottom: 16 }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`}
              min={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
              onChange={(e: any) => { if (e.target.value) setDate(new Date(e.target.value + 'T00:00:00')); }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowDate(true)} style={styles.pickerBtn}>
              <Text style={styles.pickerBtnText}>
                {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_, d) => { if (Platform.OS !== 'ios') setShowDate(false); if (d) setDate(d); }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Text style={sharedStyles.label}>Time</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.pickerBtn, { marginBottom: 24 }]}>
            {/* @ts-ignore */}
            <input
              type="time"
              value={`${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`}
              onChange={(e: any) => {
                if (e.target.value) {
                  const [h, m] = e.target.value.split(':').map(Number);
                  const t = new Date(); t.setHours(h, m, 0, 0); setTime(t);
                }
              }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowTime(true)} style={[styles.pickerBtn, { marginBottom: 24 }]}>
              <Text style={styles.pickerBtnText}>
                {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </Text>
            </Pressable>
            {showTime && (
              <DateTimePicker
                value={time} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, t) => { if (Platform.OS !== 'ios') setShowTime(false); if (t) setTime(t); }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Pressable
          onPress={saveReminder}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Set Reminder</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardPast: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  cardContent: { flex: 1 },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardTitlePast: { textDecorationLine: 'line-through', color: colors.muted },
  cardTime: { color: colors.muted, fontSize: 13 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: colors.muted, fontSize: 14 },
  pickerBtn: { minHeight: 52, backgroundColor: colors.surfaceLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 16 },
  pickerBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  saveBtn: { minHeight: 56, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  delBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 }
});
