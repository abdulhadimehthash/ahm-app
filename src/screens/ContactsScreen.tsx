import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ExpoContacts from 'expo-contacts';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { useUndo } from '../lib/undoManager';
import { supabase } from '../lib/supabase';
import { ContactCategory, ContactEntry, BirthdayEntry, RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';
import { scheduleAllBirthdayNotifications, cancelAllBirthdayNotifications } from '../lib/notifications';

const CATEGORIES: ContactCategory[] = ['Family', 'Friend', 'Client', 'Collaborator', 'School', 'KSF'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

// Phone contacts picker modal
function PhoneContactsPicker({
  visible,
  onClose,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (contacts: ExpoContacts.Contact[]) => void;
}) {
  const [phoneContacts, setPhoneContacts] = useState<ExpoContacts.Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    setSearch('');
    loadPhoneContacts();
  }, [visible]);

  async function loadPhoneContacts() {
    setLoading(true);
    try {
      const { status } = await ExpoContacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts access in Settings to import contacts.');
        onClose();
        return;
      }
      const { data } = await ExpoContacts.getContactsAsync({
        fields: [ExpoContacts.Fields.Name, ExpoContacts.Fields.PhoneNumbers, ExpoContacts.Fields.Emails],
      });
      const withPhone = data
        .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setPhoneContacts(withPhone);
    } catch {
      Alert.alert('Error', 'Could not load contacts from your phone.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = phoneContacts.filter(
    (c) => !search || (c.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <FormModal visible={visible} title="Import Contacts" onClose={onClose}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search contacts..."
        placeholderTextColor={colors.placeholder}
        style={[sharedStyles.input, { marginBottom: 12 }]}
      />
      {loading ? (
        <ActivityIndicator color={colors.white} style={{ marginVertical: 40 }} />
      ) : (
        <View style={{ maxHeight: 340 }}>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id ?? c.name ?? ''}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No contacts found.</Text>}
            renderItem={({ item }) => {
              const phone = item.phoneNumbers?.[0]?.number ?? '';
              const isSelected = selected.has(item.id ?? '');
              return (
                <Pressable
                  onPress={() => toggleSelect(item.id ?? '')}
                  style={[styles.phoneContactRow, isSelected && styles.phoneContactRowSelected]}
                >
                  <View style={styles.phoneContactInfo}>
                    <Text style={styles.phoneContactName}>{item.name}</Text>
                    <Text style={styles.phoneContactPhone}>{phone}</Text>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={18} color={colors.green} />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      )}
      <Pressable
        onPress={() => {
          const toImport = phoneContacts.filter((c) => selected.has(c.id ?? ''));
          if (toImport.length === 0) {
            Alert.alert('Nothing selected', 'Select at least one contact to import.');
            return;
          }
          onImport(toImport);
        }}
        style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }, { marginTop: 16 }]}
      >
        <Text style={styles.saveBtnText}>
          Import {selected.size > 0 ? `${selected.size} contact${selected.size !== 1 ? 's' : ''}` : ''}
        </Text>
      </Pressable>
    </FormModal>
  );
}

export function ContactsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Contacts'>) {
  const { showUndo } = useUndo();
  const [activeTab, setActiveTab] = useState<'contacts' | 'birthdays'>('contacts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Contacts States
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cCategory, setCCategory] = useState<ContactCategory>('Friend');
  const [cNotes, setCNotes] = useState('');

  // Birthdays States
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [birthdayModalVisible, setBirthdayModalVisible] = useState(false);
  const [bName, setBName] = useState('');
  const [bDay, setBDay] = useState('1');
  const [bMonth, setBMonth] = useState('1');
  const [bNote, setBNote] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadContacts(), loadBirthdays()]);
    setLoading(false);
  }

  async function loadContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      Alert.alert('Load failed', error.message);
    } else {
      setContacts(data ?? []);
    }
  }

  async function loadBirthdays() {
    const { data, error } = await supabase
      .from('birthdays')
      .select('*')
      .order('month', { ascending: true })
      .order('day', { ascending: true });
    if (error) {
      Alert.alert('Load failed', error.message);
    } else {
      setBirthdays(data ?? []);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadContacts(), loadBirthdays()]);
    setRefreshing(false);
  }, []);

  // Save Contact
  async function saveContact() {
    if (!cName.trim() || !cPhone.trim()) {
      Alert.alert('Missing details', 'Name and phone are required.');
      return;
    }
    const { error } = await supabase.from('contacts').insert({
      name: cName.trim(),
      phone: cPhone.trim(),
      email: cEmail.trim() || null,
      category: cCategory,
      notes: cNotes.trim() || null,
    });
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    resetContactForm();
    setContactModalVisible(false);
    await loadContacts();
  }

  function resetContactForm() {
    setCName(''); setCPhone(''); setCEmail(''); setCCategory('Friend'); setCNotes('');
  }

  // Save Birthday
  async function saveBirthday() {
    if (!bName.trim()) {
      Alert.alert('Missing details', 'Name is required.');
      return;
    }
    const dayNum = parseInt(bDay, 10);
    const monthNum = parseInt(bMonth, 10);

    const { data, error } = await supabase.from('birthdays').insert({
      name: bName.trim(),
      day: dayNum,
      month: monthNum,
      note: bNote.trim() || null
    }).select().single();

    if (error || !data) {
      Alert.alert('Save failed', error?.message || 'Failed to save birthday');
      return;
    }

    // Schedule birthday notifications
    try {
      await scheduleAllBirthdayNotifications(data);
    } catch (e) {
      console.error('Failed to schedule birthday notifications:', e);
    }

    resetBirthdayForm();
    setBirthdayModalVisible(false);
    await loadBirthdays();
  }

  function resetBirthdayForm() {
    setBName(''); setBDay('1'); setBMonth('1'); setBNote('');
  }

  // Delete Contact
  function handleDeleteContact(contact: ContactEntry) {
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    showUndo({
      label: `Deleted ${contact.name}`,
      onRestore: async () => setContacts((prev) => [contact, ...prev].sort((a, b) => a.name.localeCompare(b.name))),
      onConfirmDelete: async () => {
        await supabase.from('contacts').delete().eq('id', contact.id);
      },
    });
  }

  // Delete Birthday
  function handleDeleteBirthday(bd: BirthdayEntry) {
    // Cancel notifications immediately
    cancelAllBirthdayNotifications(bd.id);
    
    setBirthdays((prev) => prev.filter((b) => b.id !== bd.id));
    showUndo({
      label: `Deleted ${bd.name}'s birthday`,
      onRestore: async () => {
        setBirthdays((prev) => [...prev, bd].sort((a, b) => a.month - b.month || a.day - b.day));
        // Re-schedule notifications
        await scheduleAllBirthdayNotifications(bd);
      },
      onConfirmDelete: async () => {
        await supabase.from('birthdays').delete().eq('id', bd.id);
      },
    });
  }

  async function handleImport(phoneContacts: ExpoContacts.Contact[]) {
    const rows = phoneContacts.map((c) => ({
      name: c.name ?? 'Unknown',
      phone: c.phoneNumbers?.[0]?.number ?? '',
      email: c.emails?.[0]?.email ?? null,
      category: 'Friend' as ContactCategory,
      notes: null,
    }));
    const { error } = await supabase.from('contacts').insert(rows);
    setImportVisible(false);
    if (error) {
      Alert.alert('Import failed', error.message);
    } else {
      await loadContacts();
    }
  }

  function callContact(contact: ContactEntry) {
    const cleaned = contact.phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${cleaned}`);
  }

  const displayedContacts = contacts.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const displayedBirthdays = birthdays.filter(
    (b) =>
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase())
  );

  const catColor: Record<ContactCategory, string> = {
    Family: '#4ADE80',
    Friend: '#60A5FA',
    Client: '#F59E0B',
    Collaborator: '#A78BFA',
    School: '#34D399',
    KSF: '#FB923C',
  };

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader
          title="Contacts"
          navigation={navigation}
          action={
            activeTab === 'contacts' ? (
              <Pressable
                onPress={() => setImportVisible(true)}
                style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="download" size={14} color={colors.white} />
                <Text style={styles.importBtnText}>Import</Text>
              </Pressable>
            ) : null
          }
        />

        {/* Segmented Control */}
        <View style={styles.segmentContainer}>
          <Pressable
            onPress={() => setActiveTab('contacts')}
            style={[styles.segmentButton, activeTab === 'contacts' && styles.activeSegmentButton]}
          >
            <Text style={[styles.segmentText, activeTab === 'contacts' && styles.activeSegmentText]}>Contacts</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('birthdays')}
            style={[styles.segmentButton, activeTab === 'birthdays' && styles.activeSegmentButton]}
          >
            <Text style={[styles.segmentText, activeTab === 'birthdays' && styles.activeSegmentText]}>Birthdays</Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={activeTab === 'contacts' ? "Search contacts..." : "Search birthdays..."}
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
              <Feather name="x" size={14} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : activeTab === 'contacts' ? (
          <FlatList
            data={displayedContacts}
            keyExtractor={(c) => c.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>
                  {search ? 'No results' : 'No contacts yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {search ? 'Try a different search' : 'Tap + to add or Import from phone'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDeleteContact(item)}>
                <View style={styles.card}>
                  <View style={[styles.avatar, { backgroundColor: catColor[item.category] + '22', borderColor: catColor[item.category] + '44' }]}>
                    <Text style={[styles.avatarText, { color: catColor[item.category] }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <View style={styles.catTag}>
                      <Text style={[styles.catTagText, { color: catColor[item.category] }]}>
                        {item.category}
                      </Text>
                    </View>
                    {item.notes ? (
                      <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => callContact(item)}
                    style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Feather name="phone" size={18} color={colors.green} />
                    <Text style={styles.callBtnText} numberOfLines={1}>{item.phone}</Text>
                  </Pressable>
                </View>
              </SwipeRow>
            )}
          />
        ) : (
          <FlatList
            data={displayedBirthdays}
            keyExtractor={(b) => b.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🎂</Text>
                <Text style={styles.emptyTitle}>
                  {search ? 'No results' : 'No birthdays yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {search ? 'Try a different search' : 'Tap + to add a birthday'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() => handleDeleteBirthday(item)}>
                <View style={styles.card}>
                  <View style={[styles.avatar, { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderColor: 'rgba(236, 72, 153, 0.3)' }]}>
                    <Text style={[styles.avatarText, { color: '#EC4899' }]}>🎂</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <View style={styles.catTag}>
                      <Text style={[styles.catTagText, { color: '#EC4899' }]}>
                        {item.day} {MONTHS[item.month - 1]}
                      </Text>
                    </View>
                    {item.note ? (
                      <Text style={styles.cardNotes} numberOfLines={1}>{item.note}</Text>
                    ) : null}
                  </View>
                  <View style={styles.giftIconContainer}>
                    <Feather name="gift" size={20} color="#EC4899" />
                  </View>
                </View>
              </SwipeRow>
            )}
          />
        )}
      </View>

      <FloatingButton onPress={() => activeTab === 'contacts' ? setContactModalVisible(true) : setBirthdayModalVisible(true)} />

      {/* Add contact form */}
      <FormModal visible={contactModalVisible} title="Add Contact" onClose={() => { resetContactForm(); setContactModalVisible(false); }}>
        <TextInput
          value={cName}
          onChangeText={setCName}
          placeholder="Full Name"
          placeholderTextColor={colors.placeholder}
          style={[sharedStyles.input, { marginBottom: 12 }]}
        />
        <TextInput
          value={cPhone}
          onChangeText={setCPhone}
          placeholder="Phone Number"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          style={[sharedStyles.input, { marginBottom: 12 }]}
        />
        <TextInput
          value={cEmail}
          onChangeText={setCEmail}
          placeholder="Email (optional)"
          placeholderTextColor={colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[sharedStyles.input, { marginBottom: 12 }]}
        />
        <Text style={sharedStyles.label}>Category</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={cCategory}
            onValueChange={(v) => setCCategory(v as ContactCategory)}
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
        <TextInput
          value={cNotes}
          onChangeText={setCNotes}
          placeholder="Notes (optional)"
          placeholderTextColor={colors.placeholder}
          style={[sharedStyles.input, { minHeight: 60, paddingTop: 12, marginBottom: 12 }]}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
        <Pressable
          onPress={saveContact}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Save Contact</Text>
        </Pressable>
      </FormModal>

      {/* Add Birthday Form */}
      <FormModal visible={birthdayModalVisible} title="Add Birthday" onClose={() => { resetBirthdayForm(); setBirthdayModalVisible(false); }}>
        <TextInput
          value={bName}
          onChangeText={setBName}
          placeholder="Full Name"
          placeholderTextColor={colors.placeholder}
          style={[sharedStyles.input, { marginBottom: 12 }]}
        />

        <Text style={sharedStyles.label}>Month</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={bMonth}
            onValueChange={(v) => setBMonth(v)}
            dropdownIconColor={colors.white}
            style={styles.picker}
          >
            {MONTHS.map((m, idx) => (
              <Picker.Item key={m} label={m} value={String(idx + 1)} color={Platform.OS === 'ios' ? colors.white : undefined} />
            ))}
          </Picker>
        </View>

        <Text style={sharedStyles.label}>Day</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={bDay}
            onValueChange={(v) => setBDay(v)}
            dropdownIconColor={colors.white}
            style={styles.picker}
          >
            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
              <Picker.Item key={d} label={d} value={d} color={Platform.OS === 'ios' ? colors.white : undefined} />
            ))}
          </Picker>
        </View>

        <TextInput
          value={bNote}
          onChangeText={setBNote}
          placeholder="Notes / Gift Ideas (optional)"
          placeholderTextColor={colors.placeholder}
          style={[sharedStyles.input, { minHeight: 60, paddingTop: 12, marginBottom: 12 }]}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        <Pressable
          onPress={saveBirthday}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveBtnText}>Save Birthday</Text>
        </Pressable>
      </FormModal>

      {/* Phone contacts import picker */}
      <PhoneContactsPicker
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImport={handleImport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeSegmentButton: {
    backgroundColor: colors.white,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  activeSegmentText: {
    color: colors.black,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  importBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    minHeight: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: colors.white, fontSize: 15 },
  clearBtn: { padding: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardName: { color: colors.white, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  catTag: { alignSelf: 'flex-start', marginBottom: 2 },
  catTagText: { fontSize: 11, fontWeight: '700' },
  cardNotes: { color: colors.muted, fontSize: 12, marginTop: 2 },
  callBtn: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 80,
  },
  callBtnText: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  delBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  delBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: colors.muted, fontSize: 14 },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 20, fontSize: 14 },
  pickerWrap: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    marginBottom: 12, overflow: 'hidden', backgroundColor: colors.bg,
  },
  picker: { color: colors.white, backgroundColor: colors.bg, height: 56 },
  saveBtn: {
    minHeight: 56, borderRadius: 16, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  phoneContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  phoneContactRowSelected: { backgroundColor: colors.greenDim, borderRadius: 8 },
  phoneContactInfo: { flex: 1 },
  phoneContactName: { color: colors.white, fontSize: 14, fontWeight: '600' },
  phoneContactPhone: { color: colors.muted, fontSize: 12, marginTop: 2 },
  giftIconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
