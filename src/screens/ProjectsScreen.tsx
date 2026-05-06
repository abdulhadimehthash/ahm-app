import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { ProjectEntry, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

export function ProjectsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Projects'>) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert('Unable to load projects', error.message);
      return;
    }
    setProjects(data ?? []);
  }

  async function saveProject() {
    if (!name.trim() || !domain.trim() || !description.trim()) {
      Alert.alert('Missing details', 'Enter the project name, domain, and description.');
      return;
    }
    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      domain: domain.trim(),
      description: description.trim()
    });
    if (error) {
      Alert.alert('Unable to save project', error.message);
      return;
    }
    setName('');
    setDomain('');
    setDescription('');
    setModalVisible(false);
    await loadProjects();
  }

  async function copyReport() {
    const report = projects.length
      ? projects.map((project, index) => [
          `Project ${index + 1}`,
          `Name: ${project.name}`,
          `Domain: ${project.domain}`,
          `Description: ${project.description}`
        ].join('\n')).join('\n\n')
      : 'No projects saved.';

    await Clipboard.setStringAsync(report);
    Alert.alert('Report copied', 'The project report is ready to share.');
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader
          title="Projects"
          navigation={navigation}
          action={
            <Pressable 
              onPress={copyReport} 
              style={({ pressed }) => [
                styles.reportButton,
                pressed && { backgroundColor: colors.surfaceLight }
              ]}
            >
              <Text style={styles.reportText}>Report</Text>
            </Pressable>
          }
        />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.empty}>No projects saved.</Text>}
            renderItem={({ item }) => (
              <Pressable 
                onLongPress={() => {
                  Alert.alert('Delete Project', `Are you sure you want to delete ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      const { error } = await supabase.from('projects').delete().eq('id', item.id);
                      if (error) Alert.alert('Error', error.message);
                      else await loadProjects();
                    }}
                  ]);
                }}
                style={({ pressed }) => [
                  sharedStyles.card,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                ]}
              >
                <Text style={styles.projectName}>{item.name}</Text>
                <View style={styles.domainTag}>
                  <Text style={styles.domainText}>{item.domain}</Text>
                </View>
                <Text style={styles.description}>{item.description}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />
      
      <FormModal visible={modalVisible} title="Add Project" onClose={() => setModalVisible(false)}>
        <Field label="Project Name" value={name} onChangeText={setName} />
        <Field label="Domain or Website URL" value={domain} onChangeText={setDomain} keyboardType="url" />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={{ marginBottom: 24, minHeight: 120, paddingTop: 16 }}
        />
        <Pressable 
          onPress={saveProject} 
          style={({ pressed }) => [
            sharedStyles.primaryButton,
            pressed && { opacity: 0.8 }
          ]}
        >
          <Text style={sharedStyles.primaryButtonText}>Create Project</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  reportButton: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  reportText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12
  },
  projectName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10
  },
  domainTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  domainText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600'
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22
  },
  listContent: {
    paddingBottom: 120
  },
  loader: {
    flex: 1,
    justifyContent: 'center'
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 80,
    fontSize: 15
  }
});
