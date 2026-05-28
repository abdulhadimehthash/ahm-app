import React, { useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  buildClientProposalPrompt,
  buildConnectionProposalPrompt,
  generateText,
} from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProposalType = 'client' | 'connection';

interface ProposalEntry {
  id: string;
  created_at: string;
  type: ProposalType;
  name: string;
  description: string;
  generated_text: string;
  image_url: string | null;
}

// ─── Animated press tile ───────────────────────────────────────────────────────

function TypeCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  function pressIn() {
    Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  }
  return (
    <Animated.View style={[styles.typeCard, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.typeCardInner}
      >
        <View style={styles.typeIconWrap}>
          <Feather name={icon} size={26} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.typeTitle}>{title}</Text>
          <Text style={styles.typeSubtitle}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Result overlay modal ─────────────────────────────────────────────────────

function ResultModal({
  visible,
  text,
  onClose,
  onRegenerate,
  regenerating,
}: {
  visible: boolean;
  text: string;
  onClose: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  async function copyText() {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'Proposal copied to clipboard.');
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.resultRoot}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header row */}
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Generated Proposal</Text>
            <View style={styles.resultHeaderRight}>
              <Pressable
                onPress={copyText}
                style={({ pressed }) => [styles.iconAction, pressed && { opacity: 0.6 }]}
              >
                <Feather name="copy" size={16} color={colors.white} />
              </Pressable>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.iconAction, pressed && { opacity: 0.6 }]}
              >
                <Feather name="x" size={16} color={colors.white} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View style={styles.proposalCard}>
              <Text style={styles.proposalText}>{text}</Text>
            </View>
          </ScrollView>

          {/* Regenerate */}
          <View style={styles.resultFooter}>
            <Pressable
              onPress={onRegenerate}
              disabled={regenerating}
              style={({ pressed }) => [
                styles.regenBtn,
                pressed && { opacity: 0.8 },
                regenerating && { opacity: 0.5 },
              ]}
            >
              {regenerating ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={14} color={colors.black} style={{ marginRight: 8 }} />
                  <Text style={styles.regenBtnText}>Regenerate</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Form bottom sheet ────────────────────────────────────────────────────────

function FormSheet({
  visible,
  type,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  type: ProposalType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isClient = type === 'client';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Result state
  const [result, setResult] = useState('');
  const [resultVisible, setResultVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Keep latest prompt refs for regenerate
  const latestName = useRef('');
  const latestDesc = useRef('');
  const latestType = useRef<ProposalType>('client');

  function reset() {
    setName('');
    setDescription('');
    setImageUri(null);
    setGenerating(false);
    setResult('');
    setResultVisible(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to add an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function generate() {
    if (!name.trim()) {
      Alert.alert('Required', isClient ? 'Enter the client name.' : 'Enter their name.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', isClient ? 'Describe the project or service.' : 'Describe what they do.');
      return;
    }

    latestName.current = name.trim();
    latestDesc.current = description.trim();
    latestType.current = type;

    setGenerating(true);
    try {
      const prompt = isClient
        ? buildClientProposalPrompt(name.trim(), description.trim())
        : buildConnectionProposalPrompt(name.trim(), description.trim());

      const text = await generateText(prompt);

      // Save to Supabase
      await supabase.from('proposals').insert({
        type,
        name: name.trim(),
        description: description.trim(),
        generated_text: text,
        image_url: imageUri ?? null,
      });

      setResult(text);
      setResultVisible(true);
      onSuccess();
    } catch (e: any) {
      Alert.alert('Generation Failed', e?.message ?? 'Something went wrong.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const prompt =
        latestType.current === 'client'
          ? buildClientProposalPrompt(latestName.current, latestDesc.current)
          : buildConnectionProposalPrompt(latestName.current, latestDesc.current);
      const text = await generateText(prompt);
      setResult(text);
    } catch (e: any) {
      Alert.alert('Regeneration Failed', e?.message ?? 'Something went wrong.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <>
      <Modal
        visible={visible && !resultVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={styles.sheetRoot}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Handle */}
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {isClient ? 'Client Proposal' : 'Connection Proposal'}
              </Text>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [styles.iconAction, pressed && { opacity: 0.6 }]}
              >
                <Feather name="x" size={16} color={colors.white} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name field */}
              <Text style={styles.fieldLabel}>
                {isClient ? 'Client Name' : 'Their Name'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={isClient ? 'e.g. Arjun Menon' : 'e.g. Priya Nair'}
                placeholderTextColor={colors.placeholder}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              {/* Description field */}
              <Text style={styles.fieldLabel}>
                {isClient ? 'What is this about' : 'What they do'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={
                  isClient
                    ? 'Describe the project or service...'
                    : 'Describe what this person does...'
                }
                placeholderTextColor={colors.placeholder}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              {/* Image picker */}
              <Text style={styles.fieldLabel}>
                {isClient ? 'Upload Screenshot' : 'Upload Image'}{' '}
                <Text style={styles.optionalBadge}>(Optional)</Text>
              </Text>
              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [styles.imagePicker, pressed && { opacity: 0.7 }]}
              >
                <Feather name="image" size={18} color={colors.muted} style={{ marginRight: 10 }} />
                <Text style={styles.imagePickerText}>Add Image (Optional)</Text>
              </Pressable>
              {imageUri && (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.previewThumb} />
                  <Pressable
                    onPress={() => setImageUri(null)}
                    style={styles.removeImageBtn}
                  >
                    <Feather name="x" size={14} color={colors.white} />
                  </Pressable>
                </View>
              )}

              {/* Generate button */}
              <Pressable
                onPress={generate}
                disabled={generating}
                style={({ pressed }) => [
                  styles.generateBtn,
                  pressed && { opacity: 0.85 },
                  generating && { opacity: 0.5 },
                ]}
              >
                {generating ? (
                  <ActivityIndicator color={colors.black} />
                ) : (
                  <>
                    <Feather name="zap" size={16} color={colors.black} style={{ marginRight: 8 }} />
                    <Text style={styles.generateBtnText}>
                      {isClient ? 'Generate Proposal' : 'Generate Message'}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Result modal stacks on top */}
      <ResultModal
        visible={resultVisible}
        text={result}
        onClose={() => {
          setResultVisible(false);
          handleClose();
        }}
        onRegenerate={handleRegenerate}
        regenerating={regenerating}
      />
    </>
  );
}

// ─── History card ─────────────────────────────────────────────────────────────

function HistoryCard({
  item,
  onPress,
}: {
  item: ProposalEntry;
  onPress: () => void;
}) {
  const date = new Date(item.created_at);
  const label = `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.historyCard, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.historyLeft}>
        <View style={[styles.typeTag, item.type === 'client' ? styles.typeTagClient : styles.typeTagConnection]}>
          <Text style={styles.typeTagText}>
            {item.type === 'client' ? 'Client' : 'Connection'}
          </Text>
        </View>
        <Text style={styles.historyName}>{item.name}</Text>
        <Text style={styles.historyPreview} numberOfLines={2}>
          {item.generated_text}
        </Text>
        <Text style={styles.historyDate}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ProposalsScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Proposals'>) {
  const [activeType, setActiveType] = useState<ProposalType | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [history, setHistory] = useState<ProposalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // View existing proposal
  const [viewItem, setViewItem] = useState<ProposalEntry | null>(null);
  const [viewVisible, setViewVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    setHistory((data as ProposalEntry[]) ?? []);
  }

  function openType(type: ProposalType) {
    setActiveType(type);
    setFormVisible(true);
  }

  function openView(item: ProposalEntry) {
    setViewItem(item);
    setViewVisible(true);
  }

  async function handleRegenView() {
    if (!viewItem) return;
    setRegenerating(true);
    try {
      const prompt =
        viewItem.type === 'client'
          ? buildClientProposalPrompt(viewItem.name, viewItem.description)
          : buildConnectionProposalPrompt(viewItem.name, viewItem.description);
      const text = await generateText(prompt);
      setViewItem({ ...viewItem, generated_text: text });
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Something went wrong.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Proposals" navigation={navigation} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Type cards */}
          <Text style={styles.sectionLabel}>Create New</Text>
          <TypeCard
            icon="briefcase"
            title="Client Proposal"
            subtitle="Outreach to potential clients"
            onPress={() => openType('client')}
          />
          <TypeCard
            icon="users"
            title="Connection Proposal"
            subtitle="Reach out for collaborations"
            onPress={() => openType('connection')}
          />

          {/* History */}
          <View style={styles.historyHeaderRow}>
            <Text style={styles.sectionLabel}>History</Text>
            {loading && <ActivityIndicator color={colors.muted} size="small" />}
          </View>

          {!loading && history.length === 0 && (
            <View style={styles.emptyWrap}>
              <Feather name="send" size={36} color={colors.border} />
              <Text style={styles.emptyText}>No proposals yet</Text>
              <Text style={styles.emptySubtext}>Tap a card above to generate one</Text>
            </View>
          )}

          {history.map((item) => (
            <HistoryCard key={item.id} item={item} onPress={() => openView(item)} />
          ))}
        </ScrollView>
      </View>

      {/* Form sheet */}
      {activeType && (
        <FormSheet
          visible={formVisible}
          type={activeType}
          onClose={() => setFormVisible(false)}
          onSuccess={loadHistory}
        />
      )}

      {/* View existing proposal */}
      {viewItem && (
        <ResultModal
          visible={viewVisible}
          text={viewItem.generated_text}
          onClose={() => setViewVisible(false)}
          onRegenerate={handleRegenView}
          regenerating={regenerating}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Type selection cards
  typeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  typeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  typeSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },

  // Section labels
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },

  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtext: {
    color: colors.muted,
    fontSize: 13,
  },

  // History cards
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyLeft: {
    flex: 1,
  },
  typeTag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  typeTagClient: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  typeTagConnection: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  typeTagText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  historyName: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyPreview: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  historyDate: {
    color: colors.placeholder,
    fontSize: 11,
  },

  // Form sheet
  sheetRoot: {
    flex: 1,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333333',
  },
  sheetHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetScroll: {
    paddingBottom: 48,
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Fields
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  optionalBadge: {
    color: colors.placeholder,
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
  },
  input: {
    minHeight: 52,
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 14,
    lineHeight: 22,
  },

  // Image picker
  imagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  imagePickerText: {
    color: colors.muted,
    fontSize: 14,
  },
  previewWrap: {
    marginBottom: 20,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  previewThumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Generate button
  generateBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  generateBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Result modal
  resultRoot: {
    flex: 1,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
  },
  resultHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultHeaderRight: {
    flexDirection: 'row',
  },
  resultTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  proposalCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  proposalText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 26,
  },

  resultFooter: {
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  regenBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  regenBtnText: {
    color: colors.black,
    fontSize: 15,
    fontWeight: '700',
  },
});
