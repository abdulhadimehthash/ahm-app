import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { useUndo } from '../lib/undoManager';
import { supabase } from '../lib/supabase';
import { CopyVaultCategory, CopyVaultItem, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const CATEGORIES: CopyVaultCategory[] = ['Personal', 'Work', 'KSF', 'Client'];
const DEFAULTS_KEY = 'copy_vault_defaults_v1';

const CAT_INFO: Record<CopyVaultCategory, { color: string; icon: string }> = {
  Personal: { color: '#60A5FA', icon: 'user' },
  Work: { color: '#A78BFA', icon: 'briefcase' },
  KSF: { color: '#FB923C', icon: 'zap' },
  Client: { color: '#F59E0B', icon: 'dollar-sign' },
};

const DEFAULT_ITEMS = [
  { label: 'My Email',    content: '', category: 'Personal' as CopyVaultCategory },
  { label: 'My Phone',    content: '', category: 'Personal' as CopyVaultCategory },
  { label: 'My UPI ID',   content: '', category: 'Personal' as CopyVaultCategory },
  { label: 'My LinkedIn', content: '', category: 'Personal' as CopyVaultCategory },
  { label: 'My GitHub',   content: '', category: 'Personal' as CopyVaultCategory },
  { label: 'My Bio',      content: '', category: 'Personal' as CopyVaultCategory },
];

// ── Swipe row ───────────────────────────────────────────────────────────────
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

export function CopyVaultScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CopyVault'>) {
  const { showUndo } = useUndo();
  const [items, setItems] = useState<CopyVaultItem[]>([]);
  const [filter, setFilter] = useState<CopyVaultCategory | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<CopyVaultCategory>('Personal');

  // Copied toast
  const [copiedMsg, setCopiedMsg] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from('copy_vault')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      Alert.alert('Load failed', error.message);
      return;
    }

    if (data && data.length > 0) {
      setItems(data);
      setLoading(false);
    } else {
      // It's empty. Let's see if we should seed default items
      const done = await AsyncStorage.getItem(DEFAULTS_KEY);
      if (!done) {
        const { error: seedError } = await supabase.from('copy_vault').insert(DEFAULT_ITEMS);
        await AsyncStorage.setItem(DEFAULTS_KEY, '1');
        if (!seedError) {
          const reload = await supabase
            .from('copy_vault')
            .select('*')
            .order('created_at', { ascending: false });
          if (reload.data) setItems(reload.data);
        } else {
          Alert.alert('Seeding failed', seedError.message);
        }
      } else {
        setItems([]);
      }
      setLoading(false);
    }
  }

  async function saveItem() {
    if (!label.trim()) {
      Alert.alert('Missing details', 'Label is required.');
      return;
    }
    const { error } = await supabase.from('copy_vault').insert({
      label: label.trim(),
      content: content.trim(),
      category,
    });
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setLabel(''); setContent(''); setCategory('Personal');
    setModalVisible(false);
    await loadItems();
  }

  function handleDelete(item: CopyVaultItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    showUndo({
      label: `Deleted "${item.label}"`,
      onRestore: async () => setItems((prev) => [item, ...prev]),
      onConfirmDelete: async () => {
        await supabase.from('copy_vault').delete().eq('id', item.id);
      },
    });
  }

  const handleCopy = useCallback(async (item: CopyVaultItem) => {
    if (!item.content) return;
    await Clipboard.setStringAsync(item.content);
    setCopiedMsg(`"${item.label}" copied!`);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setCopiedMsg(''));
  }, [toastOpacity]);

  const filtered = filter === 'All' ? items : items.filter((i) => i.category === filter);

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Copy Vault" navigation={navigation} />

        {/* Filter strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['All', ...CATEGORIES] as const).map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setFilter(cat)}
              style={[styles.filterBtn, filter === cat && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, filter === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptySub}>Tap + to add your first snippet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const cat = item.category as CopyVaultCategory;
              const info = CAT_INFO[cat] || { color: '#60A5FA', icon: 'clipboard' };
              return (
                <SwipeRow onDelete={() => handleDelete(item)}>
                  <Pressable
                    onPress={() => handleCopy(item)}
                    style={({ pressed }) => [
                      styles.vaultButton,
                      pressed && styles.vaultButtonPressed
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: info.color + '18', borderColor: info.color + '33' }]}>
                      <Feather name={info.icon as any} size={16} color={info.color} />
                    </View>
                    <View style={styles.buttonTextContainer}>
                      <Text style={styles.buttonLabel}>{item.label}</Text>
                      <Text style={styles.buttonContent} numberOfLines={1}>
                        {item.content || 'Empty · Tap to edit'}
                      </Text>
                    </View>
                    <View style={styles.copyIndicator}>
                      <Feather name="copy" size={14} color={colors.muted} />
                    </View>
                  </Pressable>
                </SwipeRow>
              );
            }}
          />
        )}
      </View>

      <FloatingButton onPress={() => setModalVisible(true)} />

      {/* Copied toast */}
      <Animated.View
        style={[styles.copiedToast, { opacity: toastOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.copiedToastText}>✓ {copiedMsg}</Text>
      </Animated.View>

      <FormModal visible={modalVisible} title="Add Snippet" onClose={() => setModalVisible(false)}>
        <Text style={sharedStyles.label}>Label</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. My Email, UPI ID, Bio"
          placeholderTextColor={colors.placeholder}
          style={sharedStyles.input}
        />

        <Text style={[sharedStyles.label, { marginTop: 12 }]}>Content</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="The actual text to copy"
          placeholderTextColor={colors.placeholder}
          style={[sharedStyles.input, { minHeight: 80, paddingTop: 12 }]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={[sharedStyles.label, { marginTop: 12 }]}>Category</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={category}
            onValueChange={(v) => setCategory(v as CopyVaultCategory)}
            dropdownIconColor={colors.white}
            style={styles.picker}
          >
            {CATEGORIES.map((c) => (
              <Picker.Item
                key={c}
                label={c}
                value={c}
                color={Platform.OS === 'ios' ? colors.white : undefined}
              />
            ))}
          </Picker>
        </View>

        <Pressable
          onPress={saveItem}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Save Snippet</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { paddingBottom: 16, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  filterBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.black },
  vaultButton: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
  },
  vaultButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextContainer: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 8,
  },
  buttonLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  buttonContent: {
    color: colors.muted,
    fontSize: 12,
  },
  copyIndicator: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: colors.muted, fontSize: 14 },
  pickerWrap: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    marginBottom: 20, overflow: 'hidden', backgroundColor: colors.bg,
  },
  picker: { color: colors.white, backgroundColor: colors.bg, height: 56 },
  saveBtn: {
    minHeight: 56, borderRadius: 16, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  copiedToast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.green,
  },
  copiedToastText: { color: colors.green, fontWeight: '700', fontSize: 14 },
});
