import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatDate, toIsoDate } from '../lib/date';
import { cancelTaskNotifications, prepareNotifications, scheduleTaskNotifications } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { RootStackParamList, TaskEntry } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

export function TasksScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Tasks'>) {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [finishDate, setFinishDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    prepareNotifications();
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase.from('tasks').select('*').order('finish_date', { ascending: true });
    setLoading(false);
    if (error) {
      Alert.alert('Unable to load tasks', error.message);
      return;
    }
    setTasks(data ?? []);
  }

  async function saveTask() {
    if (!name.trim()) {
      Alert.alert('Missing details', 'Enter a task name.');
      return;
    }
    await prepareNotifications();
    const isoDate = toIsoDate(finishDate);
    const notificationIds = await scheduleTaskNotifications(name.trim(), isoDate);
    const { error } = await supabase.from('tasks').insert({
      name: name.trim(),
      finish_date: isoDate,
      ...notificationIds
    });
    if (error) {
      Alert.alert('Unable to save task', error.message);
      return;
    }
    setName('');
    setFinishDate(new Date());
    setModalVisible(false);
    await loadTasks();
  }

  async function completeTask(task: TaskEntry) {
    await removeTask(task);
  }

  async function deleteTask(task: TaskEntry) {
    Alert.alert('Delete task?', task.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeTask(task) }
    ]);
  }

  async function removeTask(task: TaskEntry) {
    await cancelTaskNotifications(task);
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      Alert.alert('Unable to remove task', error.message);
      return;
    }
    setTasks((current) => current.filter((item) => item.id !== task.id));
  }

  function onDateChange(_: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (selectedDate) setFinishDate(selectedDate);
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Tasks" navigation={navigation} />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.empty}>No tasks saved.</Text>}
            renderItem={({ item }) => (
              <View style={sharedStyles.card}>
                <View style={styles.taskTop}>
                  <View style={styles.taskTextWrap}>
                    <Text style={styles.taskName}>{item.name}</Text>
                    <Text style={styles.date}>Due {formatDate(item.finish_date)}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable 
                      onPress={() => completeTask(item)} 
                      style={({ pressed }) => [
                        styles.actionButton, 
                        styles.completeButton,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.9 }] }
                      ]}
                    >
                      <Text style={styles.actionText}>✓</Text>
                    </Pressable>
                    <Pressable 
                      onPress={() => deleteTask(item)} 
                      style={({ pressed }) => [
                        styles.actionButton, 
                        styles.deleteButton,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.9 }] }
                      ]}
                    >
                      <Text style={styles.actionText}>×</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />
      
      <FormModal visible={modalVisible} title="Add Task" onClose={() => setModalVisible(false)}>
        <Field label="Task Name" value={name} onChangeText={setName} />
        <Text style={sharedStyles.label}>Finish Date</Text>
        <Pressable onPress={() => setShowPicker(true)} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>{formatDate(toIsoDate(finishDate))}</Text>
        </Pressable>
        {showPicker && (
          <DateTimePicker
            value={finishDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onDateChange}
            textColor={colors.white}
          />
        )}
        <Pressable 
          onPress={saveTask} 
          style={({ pressed }) => [
            sharedStyles.primaryButton,
            pressed && { opacity: 0.8 }
          ]}
        >
          <Text style={sharedStyles.primaryButtonText}>Create Task</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  taskTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  taskTextWrap: {
    flex: 1
  },
  taskName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6
  },
  date: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600'
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  completeButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.white
  },
  deleteButton: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionText: {
    color: colors.black,
    fontSize: 20,
    fontWeight: '700'
  },
  deleteActionText: {
    color: colors.white
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
  },
  dateButton: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: 24
  },
  dateButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600'
  }
});
