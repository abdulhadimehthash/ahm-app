import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Picker } from '@react-native-picker/picker';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { FinanceCategory, FinanceEntry, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const categories: FinanceCategory[] = ['Client', 'Others'];

export function MoneyScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Money'>) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FinanceCategory>('Client');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);

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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>No income entries yet</Text>
                <Text style={styles.emptySub}>Tap + to record your first income</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onLongPress={() => {
                  Alert.alert('Delete Entry', `Delete "${item.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        const { error } = await supabase
                          .from('finance_entries')
                          .delete()
                          .eq('id', item.id);
                        if (error) Alert.alert('Error', error.message);
                        else await loadEntries();
                      }
                    }
                  ]);
                }}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }
                ]}
              >
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
              </Pressable>
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
    marginBottom: 12
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
  }
});
