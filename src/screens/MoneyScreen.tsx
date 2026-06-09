import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Animated, FlatList, PanResponder, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { FinanceCategory, FinanceEntry, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';
import { useUndo } from '../lib/undoManager';

const categories: FinanceCategory[] = ['Client', 'Others'];

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

export function MoneyScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Money'>) {
  const { showUndo } = useUndo();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FinanceCategory>('Client');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries]);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('finance_entries')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert('Unable to load', error.message);
      return;
    }
    setEntries((data ?? []).map((item) => ({ ...item, amount: Number(item.amount) })));
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }, []);

  async function saveEntry() {
    const numericAmount = Number(amount);
    if (!name.trim() || Number.isNaN(numericAmount) || numericAmount < 0) {
      Alert.alert('Missing details', 'Enter a name and a valid amount.');
      return;
    }
    const { error } = await supabase.from('finance_entries').insert({
      name: name.trim(),
      category,
      amount: numericAmount
    });
    if (error) {
      Alert.alert('Unable to save', error.message);
      return;
    }
    setName('');
    setAmount('');
    setCategory('Client');
    setModalVisible(false);
    await loadEntries();
  }

  function handleDelete(item: FinanceEntry) {
    setEntries((prev) => prev.filter((e) => e.id !== item.id));
    showUndo({
      label: `Deleted: ${item.name}`,
      onRestore: async () => setEntries((prev) => [item, ...prev]),
      onConfirmDelete: async () => {
        await supabase.from('finance_entries').delete().eq('id', item.id);
      },
    });
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Money" navigation={navigation} />

        {/* Total earned card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Earned</Text>
          <Text style={styles.summaryAmount}>
            ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>No income entries yet</Text>
                <Text style={styles.emptySub}>Tap + to record your first income</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDelete(item)}>
                <View style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardAmount}>
                      ₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </SwipeRow>
            )}
          />
        )}
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />

      <FormModal visible={modalVisible} title="Add Income" onClose={() => setModalVisible(false)}>
        <Field label="Name / Description" value={name} onChangeText={setName} />
        <Text style={sharedStyles.label}>Category</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={category}
            onValueChange={(v) => setCategory(v as FinanceCategory)}
            dropdownIconColor={colors.white}
            style={styles.picker}
          >
            {categories.map((item) => (
              <Picker.Item
                key={item}
                label={item}
                value={item}
                color={Platform.OS === 'ios' ? colors.white : undefined}
              />
            ))}
          </Picker>
        </View>
        <Field
          label="Amount (₹)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={{ marginBottom: 24 }}
        />
        <Pressable
          onPress={saveEntry}
          style={({ pressed }) => [sharedStyles.primaryButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={sharedStyles.primaryButtonText}>Add Income</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6
  },
  summaryAmount: {
    color: colors.green,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardLeft: { flex: 1, marginRight: 12 },
  cardName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border
  },
  badgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  cardAmount: {
    color: colors.green,
    fontSize: 20,
    fontWeight: '800'
  },
  listContent: { paddingBottom: 120 },
  loader: { flex: 1, justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: colors.muted, fontSize: 14 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight
  },
  picker: {
    color: colors.white,
    backgroundColor: colors.surfaceLight,
    height: 56
  },
  delBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 }
});
