import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
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

export function FinanceScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Finance'>) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FinanceCategory>('Client');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase.from('finance_entries').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      Alert.alert('Unable to load finance entries', error.message);
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
      Alert.alert('Unable to save finance entry', error.message);
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
        <ScreenHeader title="Finance" navigation={navigation} />
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
            ListEmptyComponent={<Text style={styles.empty}>No finance entries saved.</Text>}
            renderItem={({ item }) => (
              <Pressable 
                onLongPress={() => {
                  Alert.alert('Delete Finance Entry', `Are you sure you want to delete the entry for ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      const { error } = await supabase.from('finance_entries').delete().eq('id', item.id);
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
                  <Text style={styles.entryName}>{item.name}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                </View>
                <Text style={styles.amount}>₹{item.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
      <FloatingButton onPress={() => setModalVisible(true)} />
      
      <FormModal visible={modalVisible} title="Add Finance" onClose={() => setModalVisible(false)}>
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
              <Picker.Item key={item} label={item} value={item} color={Platform.OS === 'ios' ? colors.white : undefined} />
            ))}
          </Picker>
        </View>
        <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ marginBottom: 24 }} />
        <Pressable 
          onPress={saveEntry} 
          style={({ pressed }) => [
            sharedStyles.primaryButton,
            pressed && { opacity: 0.8 }
          ]}
        >
          <Text style={sharedStyles.primaryButtonText}>Add Entry</Text>
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  entryName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  categoryText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  amount: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5
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
  }
});
