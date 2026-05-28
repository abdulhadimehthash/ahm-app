import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { ProjectEntry, RootStackParamList } from '../lib/types';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

export function ProjectsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Projects'>) {
  const { showUndo } = useUndo();
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setProjects(data ?? []);
  }

  async function saveProject() {
    if (!name.trim() || !domain.trim() || !description.trim()) {
      Alert.alert('Missing details', 'Enter all fields.'); return;
    }
    const { error } = await supabase.from('projects').insert({
      name: name.trim(), domain: domain.trim(), description: description.trim()
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setName(''); setDomain(''); setDescription('');
    setModalVisible(false);
    await loadProjects();
  }

  async function copyReport() {
    const report = projects.length
      ? projects.map((p, i) => `${i + 1}. ${p.domain}`).join('\n')
      : 'No projects saved.';
    await Clipboard.setStringAsync(report);
    Alert.alert('Report copied', 'Domain links copied to clipboard.');
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
              <Text style={styles.reportBtnText}>Report</Text>
            </Pressable>
          }
        />

        {loading ? (
          <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={projects}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📁</Text>
                <Text style={styles.emptyTitle}>No projects yet</Text>
                <Text style={styles.emptySub}>Tap + to start tracking a new project</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onLongPress={() => {
                  setProjects((prev) => prev.filter((p) => p.id !== item.id));
                  showUndo({
                    label: `Deleted: ${item.name}`,
                    onRestore: async () => setProjects((prev) => [item, ...prev]),
                    onConfirmDelete: async () => {
                      await supabase.from('projects').delete().eq('id', item.id);
                    },
                  });
                }}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }
                ]}
              >
                <Text style={styles.projName}>{item.name}</Text>
                <View style={styles.domainTag}>
                  <Text style={styles.domainText}>{item.domain}</Text>
                </View>
                <Text style={styles.projDesc}>{item.description}</Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <FloatingButton onPress={() => setModalVisible(true)} />

      <FormModal visible={modalVisible} title="Add Project" onClose={() => setModalVisible(false)}>
        <Field label="Project Name" value={name} onChangeText={setName} />
        <Field label="Domain or Website URL" value={domain} onChangeText={setDomain} keyboardType="url" />
        <Field label="Description" value={description} onChangeText={setDescription}
          multiline numberOfLines={5} textAlignVertical="top"
          style={{ marginBottom: 24, minHeight: 120, paddingTop: 16 }} />
        <Pressable onPress={saveProject}
          style={({ pressed }) => [sharedStyles.primaryButton, pressed && { opacity: 0.8 }]}>
          <Text style={sharedStyles.primaryButtonText}>Create Project</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  reportBtn: { height: 36, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  reportBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 12 },
  projName: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  domainTag: { alignSelf: 'flex-start', backgroundColor: colors.surfaceLight, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  domainText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  projDesc: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: colors.muted, fontSize: 14 }
});
