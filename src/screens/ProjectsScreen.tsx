import React, { useEffect, useState, useRef, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, FlatList, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { ProjectEntry, MeetingNote, ActionItem, RootStackParamList } from '../lib/types';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

export function ProjectsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Projects'>) {
  const { showUndo } = useUndo();
  const [activeTab, setActiveTab] = useState<'projects' | 'notes'>('projects');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Projects States
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDomain, setProjDomain] = useState('');
  const [projDesc, setProjDesc] = useState('');

  // Meeting Notes States
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [clientName, setClientName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [discussion, setDiscussion] = useState('');
  
  // Action Items sub-form states
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionText, setNewActionText] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadProjects(), loadMeetingNotes()]);
    setLoading(false);
  }

  async function loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { Alert.alert('Error loading projects', error.message); return; }
    setProjects(data ?? []);
  }

  async function loadMeetingNotes() {
    const { data, error } = await supabase
      .from('meeting_notes')
      .select('*')
      .order('date', { ascending: false });
    if (error) { Alert.alert('Error loading meeting notes', error.message); return; }
    setMeetingNotes(data ?? []);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProjects(), loadMeetingNotes()]);
    setRefreshing(false);
  }, []);

  async function saveProject() {
    if (!projName.trim() || !projDomain.trim() || !projDesc.trim()) {
      Alert.alert('Missing details', 'Enter all fields.'); return;
    }
    const { error } = await supabase.from('projects').insert({
      name: projName.trim(), domain: projDomain.trim(), description: projDesc.trim()
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setProjName(''); setProjDomain(''); setProjDesc('');
    setProjectModalVisible(false);
    await loadProjects();
  }

  async function saveMeetingNote() {
    if (!clientName.trim() || !discussion.trim()) {
      Alert.alert('Missing details', 'Enter client name and discussion notes.'); return;
    }
    const { error } = await supabase.from('meeting_notes').insert({
      client_name: clientName.trim(),
      date: toIsoDate(meetingDate),
      discussion: discussion.trim(),
      action_items: actionItems
    });
    if (error) { Alert.alert('Error saving note', error.message); return; }
    
    // Reset form
    setClientName('');
    setDiscussion('');
    setMeetingDate(new Date());
    setActionItems([]);
    setNewActionText('');
    setNotesModalVisible(false);
    await loadMeetingNotes();
  }

  function addActionItem() {
    if (!newActionText.trim()) return;
    setActionItems([...actionItems, { text: newActionText.trim(), done: false }]);
    setNewActionText('');
  }

  function removeActionItem(index: number) {
    setActionItems(actionItems.filter((_, i) => i !== index));
  }

  async function toggleActionItem(note: MeetingNote, index: number) {
    const updatedItems = [...note.action_items];
    updatedItems[index].done = !updatedItems[index].done;

    // Update local state immediately
    setMeetingNotes(prev => prev.map(n => n.id === note.id ? { ...n, action_items: updatedItems } : n));

    const { error } = await supabase.from('meeting_notes')
      .update({ action_items: updatedItems })
      .eq('id', note.id);
    if (error) {
      Alert.alert('Error', error.message);
      await loadMeetingNotes();
    }
  }

  function handleDeleteProject(proj: ProjectEntry) {
    setProjects(prev => prev.filter(p => p.id !== proj.id));
    showUndo({
      label: `Deleted: ${proj.name}`,
      onRestore: async () => setProjects(prev => [proj, ...prev]),
      onConfirmDelete: async () => {
        await supabase.from('projects').delete().eq('id', proj.id);
      }
    });
  }

  function handleDeleteMeetingNote(note: MeetingNote) {
    setMeetingNotes(prev => prev.filter(n => n.id !== note.id));
    showUndo({
      label: `Deleted: Meeting with ${note.client_name}`,
      onRestore: async () => setMeetingNotes(prev => [note, ...prev].sort((a,b) => b.date.localeCompare(a.date))),
      onConfirmDelete: async () => {
        await supabase.from('meeting_notes').delete().eq('id', note.id);
      }
    });
  }

  async function copyReport() {
    if (activeTab === 'projects') {
      const report = projects.length
        ? projects.map((p, i) => `${i + 1}. ${p.name} (${p.domain})`).join('\n')
        : 'No projects saved.';
      await Clipboard.setStringAsync(report);
      Alert.alert('Report copied', 'Projects list copied to clipboard.');
    } else {
      const report = meetingNotes.length
        ? meetingNotes.map((n, i) => `${i + 1}. Client: ${n.client_name}\n   Date: ${n.date}\n   Notes: ${n.discussion}`).join('\n\n')
        : 'No meeting notes saved.';
      await Clipboard.setStringAsync(report);
      Alert.alert('Report copied', 'Meeting notes report copied to clipboard.');
    }
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader
          title="Projects"
          navigation={navigation}
          action={
            <Pressable onPress={copyReport}
              style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.7 }]}>
              <Feather name="share-2" size={14} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.reportBtnText}>Share</Text>
            </Pressable>
          }
        />

        {/* Segmented Control */}
        <View style={styles.segmentContainer}>
          <Pressable
            onPress={() => setActiveTab('projects')}
            style={[styles.segmentButton, activeTab === 'projects' && styles.activeSegmentButton]}
          >
            <Text style={[styles.segmentText, activeTab === 'projects' && styles.activeSegmentText]}>Projects</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('notes')}
            style={[styles.segmentButton, activeTab === 'notes' && styles.activeSegmentButton]}
          >
            <Text style={[styles.segmentText, activeTab === 'notes' && styles.activeSegmentText]}>Meeting Notes</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
        ) : activeTab === 'projects' ? (
          <FlatList
            data={projects}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📁</Text>
                <Text style={styles.emptyTitle}>No projects yet</Text>
                <Text style={styles.emptySub}>Tap + to start tracking a new project</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDeleteProject(item)}>
                <View style={styles.card}>
                  <Text style={styles.projName}>{item.name}</Text>
                  <View style={styles.domainTag}>
                    <Text style={styles.domainText}>{item.domain}</Text>
                  </View>
                  <Text style={styles.projDesc}>{item.description}</Text>
                </View>
              </SwipeRow>
            )}
          />
        ) : (
          <FlatList
            data={meetingNotes}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>No meeting notes yet</Text>
                <Text style={styles.emptySub}>Tap + to record your first meeting note</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDeleteMeetingNote(item)}>
                <View style={styles.card}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.clientName}>{item.client_name}</Text>
                    <Text style={styles.noteDate}>{item.date}</Text>
                  </View>
                  <Text style={styles.noteDiscussion}>{item.discussion}</Text>
                  
                  {item.action_items && item.action_items.length > 0 && (
                    <View style={styles.actionItemsContainer}>
                      <Text style={styles.actionHeader}>Action Items:</Text>
                      {item.action_items.map((ai, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() => toggleActionItem(item, idx)}
                          style={styles.actionRow}
                        >
                          <View style={[styles.checkbox, ai.done && styles.checkboxChecked]}>
                            {ai.done && <Feather name="check" size={10} color={colors.white} />}
                          </View>
                          <Text style={[styles.actionText, ai.done && styles.actionTextDone]}>
                            {ai.text}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </SwipeRow>
            )}
          />
        )}
      </View>

      <FloatingButton onPress={() => activeTab === 'projects' ? setProjectModalVisible(true) : setNotesModalVisible(true)} />

      {/* Add Project Form */}
      <FormModal visible={projectModalVisible} title="Add Project" onClose={() => setProjectModalVisible(false)}>
        <Field label="Project Name" value={projName} onChangeText={setProjName} />
        <Field label="Domain or Website URL" value={projDomain} onChangeText={setProjDomain} keyboardType="url" />
        <Field label="Description" value={projDesc} onChangeText={setProjDesc}
          multiline numberOfLines={4} textAlignVertical="top"
          style={{ marginBottom: 24, minHeight: 90, paddingTop: 16 }} />
        <Pressable onPress={saveProject}
          style={({ pressed }) => [sharedStyles.primaryButton, pressed && { opacity: 0.8 }]}>
          <Text style={sharedStyles.primaryButtonText}>Create Project</Text>
        </Pressable>
      </FormModal>

      {/* Add Meeting Notes Form */}
      <FormModal visible={notesModalVisible} title="Add Meeting Note" onClose={() => { setNotesModalVisible(false); setActionItems([]); }}>
        <Field label="Client Name" value={clientName} onChangeText={setClientName} />
        
        <Text style={sharedStyles.label}>Meeting Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateBtn, { marginBottom: 16 }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={toIsoDate(meetingDate)}
              onChange={(e: any) => { if (e.target.value) setMeetingDate(new Date(e.target.value + 'T00:00:00')); }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
              <Text style={styles.dateBtnText}>{toIsoDate(meetingDate)}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={meetingDate}
                mode="date"
                display={Platform.OS==='ios'?'spinner':'default'}
                onChange={(_,d) => { if (Platform.OS!=='ios') setShowDatePicker(false); if(d) setMeetingDate(d); }}
                textColor={colors.white}
              />
            )}
          </>
        )}

        <Field label="Discussion Notes" value={discussion} onChangeText={setDiscussion}
          multiline numberOfLines={5} textAlignVertical="top"
          style={{ minHeight: 100, paddingTop: 12 }} />

        {/* Action Items Builder */}
        <Text style={[sharedStyles.label, { marginTop: 12 }]}>Add Action Items</Text>
        <View style={styles.actionInputRow}>
          <TextInput
            value={newActionText}
            onChangeText={setNewActionText}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.placeholder}
            style={[sharedStyles.input, { flex: 1, marginBottom: 0, minHeight: 48 }]}
          />
          <Pressable onPress={addActionItem} style={styles.addActionBtn}>
            <Feather name="plus" size={20} color={colors.white} />
          </Pressable>
        </View>

        {actionItems.length > 0 && (
          <View style={styles.actionItemsBuilderList}>
            {actionItems.map((item, idx) => (
              <View key={idx} style={styles.actionBuilderRow}>
                <Text style={styles.actionBuilderText}>{item.text}</Text>
                <Pressable onPress={() => removeActionItem(idx)} style={{ padding: 4 }}>
                  <Feather name="trash-2" size={14} color={colors.red} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable onPress={saveMeetingNote}
          style={({ pressed }) => [sharedStyles.primaryButton, pressed && { opacity: 0.8 }, { marginTop: 20 }]}>
          <Text style={sharedStyles.primaryButtonText}>Save Meeting Note</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  reportBtn: { height: 36, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  reportBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeSegmentButton: {
    backgroundColor: colors.white,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  activeSegmentText: {
    color: colors.black,
  },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18 },
  projName: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  domainTag: { alignSelf: 'flex-start', backgroundColor: colors.surfaceLight, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  domainText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  projDesc: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clientName: { color: colors.white, fontSize: 18, fontWeight: '700' },
  noteDate: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  noteDiscussion: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  actionItemsContainer: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  actionHeader: { color: colors.white, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 2 },
  checkbox: { width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: colors.border, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  actionText: { color: colors.white, fontSize: 13, flex: 1 },
  actionTextDone: { color: colors.muted, textDecorationLine: 'line-through' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: colors.muted, fontSize: 14 },
  delBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  dateBtn: { minHeight: 52, backgroundColor: colors.surfaceLight, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, justifyContent: 'center', marginBottom: 16 },
  dateBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  actionInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  addActionBtn: { width: 48, height: 48, backgroundColor: colors.green, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionItemsBuilderList: { backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  actionBuilderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionBuilderText: { color: colors.white, fontSize: 13, flex: 1, marginRight: 8 }
});
