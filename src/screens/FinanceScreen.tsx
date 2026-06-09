import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { ExpenseEntry, FinanceEntry, RootStackParamList } from '../lib/types';
import { useUndo } from '../lib/undoManager';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ── Swipeable expense row ──────────────────────────────────────────────────
function SwipeableRow({
  children,
  onDelete
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -80));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) {
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      }
    })
  ).current;

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
  };

  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 12 }}>
      {/* Delete button behind */}
      <Pressable
        onPress={() => { close(); onDelete(); }}
        style={styles.deleteAction}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </Pressable>
      {/* Card on top */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────
export function FinanceScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Finance'>) {
  const { showUndo } = useUndo();
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [income, setIncome] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [expRes, incRes] = await Promise.all([
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('finance_entries').select('*').order('created_at', { ascending: false })
    ]);
    setLoading(false);
    if (expRes.data) setExpenses(expRes.data.map((e) => ({ ...e, amount: Number(e.amount) })));
    if (incRes.data) setIncome(incRes.data.map((e) => ({ ...e, amount: Number(e.amount) })));
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  // Totals
  const totalEarned = useMemo(() => income.reduce((s, e) => s + e.amount, 0), [income]);
  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const net = totalEarned - totalSpent;

  // Monthly
  const monthIncome = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth();
    return income
      .filter((e) => {
        const d = new Date(e.created_at);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((s, e) => s + e.amount, 0);
  }, [income, selectedMonth]);

  const monthExpenses = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth();
    return expenses
      .filter((e) => {
        const [ey, em] = e.date.split('-').map(Number);
        return ey === y && em - 1 === m;
      })
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses, selectedMonth]);

  // Month filter for list
  const monthlyExpensesList = useMemo(() => {
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth();
    return expenses.filter((e) => {
      const [ey, em] = e.date.split('-').map(Number);
      return ey === y && em - 1 === m;
    });
  }, [expenses, selectedMonth]);

  function prevMonth() {
    setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function saveExpense() {
    const numericAmount = Number(amount);
    if (!name.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Missing details', 'Enter a name and valid amount.');
      return;
    }
    const { error } = await supabase.from('expenses').insert({
      name: name.trim(),
      amount: numericAmount,
      date: toIsoDate(date)
    });
    if (error) { Alert.alert('Error', error.message); return; }
    setName(''); setAmount(''); setDate(new Date());
    setModalVisible(false);
    await loadAll();
  }

  function deleteExpense(expense: ExpenseEntry) {
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    showUndo({
      label: `Deleted: ${expense.name}`,
      onRestore: async () => setExpenses((prev) => [expense, ...prev]),
      onConfirmDelete: async () => {
        await supabase.from('expenses').delete().eq('id', expense.id);
      },
    });
  }

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (selected) setDate(selected);
  }

  function formatDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  }

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Finance" navigation={navigation} />

        <FlatList
          data={monthlyExpensesList}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyTitle}>No expenses this month</Text>
              <Text style={styles.emptySub}>Tap + to record your first expense</Text>
            </View>
          }
          ListHeaderComponent={
            <>
              {/* Net Summary Card */}
              {loading ? (
                <View style={styles.loader}><ActivityIndicator color={colors.white} /></View>
              ) : (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Net Balance</Text>
                  <Text style={[styles.netAmount, { color: net >= 0 ? colors.green : colors.red }]}>
                    {net >= 0 ? '+' : '-'}{fmt(net)}
                  </Text>
                  <View style={styles.summaryRow}>
                    <Pressable onPress={() => navigation.navigate('Money')} style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Earned ↗</Text>
                      <Text style={[styles.summaryValue, { color: colors.green }]}>{fmt(totalEarned)}</Text>
                    </Pressable>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Spent</Text>
                      <Text style={[styles.summaryValue, { color: colors.red }]}>-{fmt(totalSpent)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Monthly nav */}
              <View style={styles.monthCard}>
                <View style={styles.monthNav}>
                  <Pressable onPress={prevMonth} style={styles.monthArrow}>
                    <Text style={styles.monthArrowText}>‹</Text>
                  </Pressable>
                  <Text style={styles.monthLabel}>
                    {MONTHS[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                  </Text>
                  <Pressable onPress={nextMonth} style={styles.monthArrow}>
                    <Text style={styles.monthArrowText}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.monthStats}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Income</Text>
                    <Text style={[styles.monthStatValue, { color: colors.green }]}>{fmt(monthIncome)}</Text>
                  </View>
                  <View style={styles.monthStatDivider} />
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Expenses</Text>
                    <Text style={[styles.monthStatValue, { color: colors.red }]}>-{fmt(monthExpenses)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Expenses</Text>
            </>
          }
          renderItem={({ item }) => (
            <SwipeableRow onDelete={() => deleteExpense(item)}>
              <View style={styles.expenseCard}>
                <View style={styles.expenseLeft}>
                  <Text style={styles.expenseName}>{item.name}</Text>
                  <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
                </View>
                <Text style={styles.expenseAmount}>-{fmt(item.amount)}</Text>
              </View>
            </SwipeableRow>
          )}
        />
      </View>

      <FloatingButton onPress={() => setModalVisible(true)} />

      <FormModal visible={modalVisible} title="Add Expense" onClose={() => setModalVisible(false)}>
        <Field label="Expense Name" value={name} onChangeText={setName} />
        <Field
          label="Amount (₹)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Text style={sharedStyles.label}>Date</Text>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateButton, { marginBottom: 20 }]}>
            {/* @ts-ignore */}
            <input
              type="date"
              value={toIsoDate(date)}
              max={toIsoDate(new Date())}
              onChange={(e: any) => { if (e.target.value) setDate(new Date(e.target.value + 'T00:00:00')); }}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: 16, fontWeight: 600, width: '100%', outline: 'none', cursor: 'pointer' }}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
              <Text style={styles.dateButtonText}>{formatDate(toIsoDate(date))}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onDateChange}
                textColor={colors.white}
              />
            )}
          </>
        )}
        <Pressable
          onPress={saveExpense}
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveButtonText}>Save Expense</Text>
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6
  },
  summaryTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8
  },
  netAmount: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 20
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  summaryItem: { flex: 1 },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: 16
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700'
  },
  monthCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  monthArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  monthArrowText: { color: colors.white, fontSize: 22, fontWeight: '600' },
  monthLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700'
  },
  monthStats: { flexDirection: 'row', alignItems: 'center' },
  monthStat: { flex: 1 },
  monthStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: 12
  },
  monthStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  monthStatValue: { fontSize: 16, fontWeight: '700' },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  expenseCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  expenseLeft: { flex: 1, marginRight: 12 },
  expenseName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  expenseDate: { color: colors.muted, fontSize: 13 },
  expenseAmount: {
    color: colors.red,
    fontSize: 18,
    fontWeight: '800'
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16
  },
  deleteActionText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13
  },
  listContent: { paddingBottom: 120 },
  loader: { alignItems: 'center', padding: 24 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: colors.muted, fontSize: 14 },
  dateButton: {
    minHeight: 52,
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 20
  },
  dateButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  saveButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' }
});
