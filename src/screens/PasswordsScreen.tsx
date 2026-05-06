import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { PasswordCategory, PasswordEntry, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const categories: PasswordCategory[] = ['Personal', 'Client', 'Others'];

export function PasswordsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Passwords'>) {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [filter, setFilter] = useState<PasswordCategory>('Personal');
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<PasswordCategory>('Personal');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => entries.filter((entry) => entry.category === filter), [entries, filter]);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase.from('password_entries').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert('Unable to load passwords', error.message);
      return;
    }
    setEntries(data ?? []);
  }

  async function saveEntry() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Enter a username and password.');
      return;
    }
    const { error } = await supabase.from('password_entries').insert({
      category,
      username: username.trim(),
      password_value: password
    });
    if (error) {
      Alert.alert('Unable to save password', error.message);
      return;
    }
    setUsername('');
    setPassword('');
    setCategory('Personal');
    setModalVisible(false);
    await loadEntries();
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Passwords" navigation={navigation} />
        <View style={styles.filters}>
          {categories.map((item) => (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[styles.filterButton, filter === item && styles.activeFilter]}
            >
              <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.empty}>No saved passwords.</Text>}
            renderItem={({ item }) => (
              <Pressable 
                onLongPress={() => {
                  Alert.alert('Delete Password', `Are you sure you want to delete the entry for ${item.username}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      const { error } = await supabase.from('password_entries').delete().eq('id', item.id);
                      if (error) Alert.alert('Error', error.message);
                      else await loadEntries();
                    }}
                  ]);
                }}
                style={({ pressed }) => [
                  sharedStyles.card,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={sharedStyles.label}>{item.category}</Text>
                </View>
                <Text style={styles.name}>{item.username}</Text>
                <View style={styles.passwordRow}>
                  <Text style={styles.passwordText}>{revealed[item.id] ? item.password_value : '••••••••'}</Text>
                  <Pressable 
                    onPress={() => setRevealed((value) => ({ ...value, [item.id]: !value[item.id] }))}
                    style={({ pressed }) => [
                      styles.revealButton,
                      pressed && { opacity: 0.7 }
                    ]}
                  >
                    <Text style={styles.reveal}>{revealed[item.id] ? 'Hide' : 'Reveal'}</Text>
                  </Pressable>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />
      
      <FormModal visible={modalVisible} title="Add Password" onClose={() => setModalVisible(false)}>
        <Text style={sharedStyles.label}>Category</Text>
        <View style={styles.pickerWrap}>
          <Picker 
            selectedValue={category} 
            onValueChange={(v) => setCategory(v as PasswordCategory)} 
            dropdownIconColor={colors.white} 
            style={styles.picker}
          >
            {categories.map((item) => (
              <Picker.Item key={item} label={item} value={item} color={Platform.OS === 'ios' ? colors.white : undefined} />
            ))}
          </Picker>
        </View>
        <Field label="Email or Username" value={username} onChangeText={setUsername} />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{ marginBottom: 8 }}
        />
        <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.toggle}>
          <Text style={styles.reveal}>{showPassword ? 'Hide password' : 'Show password'}</Text>
        </Pressable>
        <Pressable 
          onPress={saveEntry} 
          style={({ pressed }) => [
            sharedStyles.primaryButton,
            pressed && { opacity: 0.8 }
          ]}
        >
          <Text style={sharedStyles.primaryButtonText}>Save Password</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24
  },
  filterButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  activeFilter: {
    backgroundColor: colors.white,
    borderColor: colors.white
  },
  filterText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  activeFilterText: {
    color: colors.black
  },
  listContent: {
    paddingBottom: 120
  },
  loader: {
    flex: 1,
    justifyContent: 'center'
  },
  cardHeader: {
    marginBottom: 4
  },
  name: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  passwordText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1
  },
  revealButton: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  reveal: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 80,
    fontSize: 15
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface
  },
  picker: {
    color: colors.white,
    backgroundColor: colors.surface,
    height: 56
  },
  toggle: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    paddingVertical: 4
  }
});
