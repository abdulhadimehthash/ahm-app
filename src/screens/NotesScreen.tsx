import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, FlatList, Platform, Pressable,
  StyleSheet, Text, View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { ActionItem, MeetingNote, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(iso: string) {
  const [y,m,d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m-1]} ${y}`;
}

export function NotesScreen({ navigation }: NativeStackScreenProps<RootStackParamList,'Notes'>) {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

  // Form
  const [meetClient, setMeetClient] = useState('');
  const [meetDate, setMeetDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [meetDiscussion, setMeetDiscussion] = useState('');
  const [meetActions, setMeetActions] = useState('');

  useEffect(() => { loadMeetings(); }, []);

  async function loadMeetings() {
    setLoading(true);
    const { data, error } = await supabase
      .from('meeting_notes')
      .select('*')
      .order('date', { ascending: false });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setMeetings((data ?? []).map(m => ({
      ...m,
      action_items: typeof m.action_items === 'string'
        ? JSON.parse(m.action_items)
        : (m.action_items ?? [])
    })));
  }

  async function saveMeeting() {
    if (!meetClient.trim() || !meetDiscussion.trim()) {
      Alert.alert('Missing', 'Enter client name and discussion.'); return;
    }
    const actions: ActionItem[] = meetActions.trim()
      ? meetActions.split('\n').filter(l => l.trim()).map(text => ({ text: text.trim(), done: false }))
      : [];
    const { error } = await supabase.from('meeting_notes').insert({
      client_name: meetClient.trim(),
      date: toIsoDate(meetDate),
      discussion: meetDiscussion.trim(),
      action_items: actions
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setMeetClient(''); setMeetDate(new Date()); setMeetDiscussion(''); setMeetActions('');
    setModalVisible(false);
    await loadMeetings();
  }

  async function toggleAction(meeting: MeetingNote, idx: number) {
    const updated = meeting.action_items.map((a, i) => i === idx ? { ...a, done: !a.done } : a);
    await supabase.from('meeting_notes').update({ action_items: updated }).eq('id', meeting.id);
    await loadMeetings();
  }

  async function deleteMeeting(id: string, name: string) {
    Alert.alert('Delete Meeting?', name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('meeting_notes').delete().eq('id', id);
        await loadMeetings();
      }}
    ]);
  }

  function toggleExpand(id: string) {
    setExpandedMeetings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Notes" navigation={navigation} />

        {loading ? (
          <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={meetings}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyText}>No meeting notes yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first note</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isExpanded = expandedMeetings.has(item.id);
              return (
                <View style={styles.card}>
                  <Pressable onPress={() => toggleExpand(item.id)} style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.clientName}>{item.client_name}</Text>
                      <Text style={styles.meetDate}>{formatDate(item.date)}</Text>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </Pressable>

                  <Text style={styles.discussion} numberOfLines={isExpanded ? undefined : 2}>
                    {item.discussion}
                  </Text>

                  {isExpanded && item.action_items.length > 0 && (
                    <View style={styles.actionsSection}>
                      <Text style={styles.actionsLabel}>Action Items</Text>
                      {item.action_items.map((action, idx) => (
                        <Pressable key={idx} onPress={() => toggleAction(item, idx)} style={styles.actionRow}>
                          <View style={[styles.actionCheck, action.done && styles.actionCheckDone]}>
                            {action.done && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <Text style={[styles.actionText, action.done && styles.actionTextDone]}>
                            {action.text}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {isExpanded && (
                    <Pressable onPress={() => deleteMeeting(item.id, item.client_name)} style={styles.deleteBtn}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>

      <FloatingButton onPress={() => setModalVisible(true)} />

      <FormModal visible={modalVisible} title="Add Meeting Note" onClose={() => setModalVisible(false)}>
        <Field label="Client Name" value={meetClient} onChangeText={setMeetClient} />

        <Text style={sharedStyles.label}>Meeting Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateBtn, { marginBottom: 16 }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={toIsoDate(meetDate)}
              onChange={(e: any) => { if (e.target.value) setMeetDate(new Date(e.target.value + 'T00:00:00')); }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>{formatDate(toIsoDate(meetDate))}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker value={meetDate} mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => { if (Platform.OS !== 'ios') setShowDatePicker(false); if (d) setMeetDate(d); }}
                textColor={colors.white} />
            )}
          </>
        )}

        <Field label="What was discussed" value={meetDiscussion} onChangeText={setMeetDiscussion}
          multiline numberOfLines={4} textAlignVertical="top"
          style={{ minHeight: 100, paddingTop: 12 }} />

        <Field label="Action items (one per line)" value={meetActions} onChangeText={setMeetActions}
          multiline numberOfLines={4} textAlignVertical="top"
          style={{ minHeight: 100, paddingTop: 12, marginBottom: 24 }} />

        <Pressable onPress={saveMeeting}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.saveBtnText}>Save Meeting</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  cardHeaderLeft: { flex: 1 },
  clientName: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  meetDate: { color: colors.muted, fontSize: 13 },
  expandIcon: { color: colors.muted, fontSize: 12, marginLeft: 8, marginTop: 2 },
  discussion: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  actionsSection: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  actionsLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  actionCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  actionCheckDone: { backgroundColor: colors.green, borderColor: colors.green },
  checkMark: { color: colors.white, fontSize: 12, fontWeight: '700' },
  actionText: { color: colors.white, fontSize: 14, flex: 1 },
  actionTextDone: { color: colors.muted, textDecorationLine: 'line-through' },
  deleteBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12, marginTop: 10 },
  deleteText: { color: colors.red, fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: colors.muted, fontSize: 14 },
  dateBtn: { minHeight: 52, backgroundColor: colors.surfaceLight, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 16 },
  dateBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  saveBtn: { minHeight: 56, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' }
});
