import React, { useEffect, useMemo, useState, useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Animated, FlatList, PanResponder, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Picker } from '@react-native-picker/picker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { PasswordCategory, PasswordEntry, RootStackParamList } from '../lib/types';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const categories: PasswordCategory[] = ['Personal', 'Client', 'Others'];

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

export function PasswordsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Passwords'>) {
  const { showUndo } = useUndo();
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [filter, setFilter] = useState<PasswordCategory>('Personal');
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<PasswordCategory>('Personal');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }, []);

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

  function handleDelete(item: PasswordEntry) {
    setEntries((prev) => prev.filter((e) => e.id !== item.id));
    showUndo({
      label: `Deleted: ${item.username}`,
      onRestore: async () => setEntries((prev) => [item, ...prev]),
      onConfirmDelete: async () => {
        await supabase.from('password_entries').delete().eq('id', item.id);
      },
    });
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
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔒</Text>
                <Text style={styles.emptyTitle}>No saved passwords</Text>
                <Text style={styles.emptySub}>Tap + to store your credentials securely</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDelete(item)}>
                <View style={sharedStyles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={sharedStyles.label}>{item.category}</Text>
                  </View>
                  <Text style={styles.name}>{item.username}</Text>
                  <View style={styles.passwordRow}>
                    <Text style={styles.passwordText}>{revealed[item.id] ? item.password_value : '••••••••'}</Text>
                    <View style={styles.rowActions}>
                      <Pressable 
                        onPress={() => setRevealed((value) => ({ ...value, [item.id]: !value[item.id] }))}
                        style={({ pressed }) => [
                          styles.revealButton,
                          pressed && { opacity: 0.7 }
                        ]}
                      >
                        <Text style={styles.reveal}>{revealed[item.id] ? 'Hide' : 'Reveal'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          await Clipboard.setStringAsync(item.password_value);
                          Alert.alert('Copied!', 'Password copied to clipboard.');
                        }}
                        style={({ pressed }) => [
                          styles.copyButton,
                          pressed && { opacity: 0.7 }
                        ]}
                      >
                        <Text style={styles.copyText}>Copy</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </SwipeRow>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  passwordText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  revealButton: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  copyButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)'
  },
  copyText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12
  },
  reveal: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  emptySub: {
    color: colors.muted,
    fontSize: 14
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: colors.bg
  },
  picker: {
    color: colors.white,
    backgroundColor: colors.bg,
    height: 56
  },
  toggle: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    paddingVertical: 4
  },
  delBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 }
});
