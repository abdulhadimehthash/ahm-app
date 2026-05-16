import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
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
    seedDefaultsIfNeeded().then(loadItems);
  }, []);

  async function seedDefaultsIfNeeded() {
    const done = await AsyncStorage.getItem(DEFAULTS_KEY);
    if (done) return;
    await supabase.from('copy_vault').insert(DEFAULT_ITEMS);
    await AsyncStorage.setItem(DEFAULTS_KEY, '1');
  }

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from('copy_vault')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (!error) setItems(data ?? []);
  }

  async function saveItem() {
    if (!label.trim()) return;
    await supabase.from('copy_vault').insert({
      label: label.trim(),
      content: content.trim(),
      category,
    });
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
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDelete(item)}>
                <Pressable
                  onPress={() => handleCopy(item)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.catTag}>
                      <Text style={styles.catTagText}>{item.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  <Text style={styles.cardContent} numberOfLines={2}>
                    {item.content || 'Tap to copy · (empty — edit to add content)'}
                  </Text>
                </Pressable>
              </SwipeRow>
            )}
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  filterBtnActive: { backgroundColor: colors.white, borderColor: colors.white },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.black },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardTop: { flexDirection: 'row', marginBottom: 8 },
  catTag: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  catTagText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  cardLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardContent: { color: colors.muted, fontSize: 13, lineHeight: 20 },
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
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    marginBottom: 20, overflow: 'hidden', backgroundColor: colors.bg,
  },
  picker: { color: colors.white, backgroundColor: colors.bg, height: 56 },
  saveBtn: {
    minHeight: 56, borderRadius: 12, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  copiedToast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.green,
  },
  copiedToastText: { color: colors.green, fontWeight: '700', fontSize: 14 },
});
