import React, { useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView,
  Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  buildColdEmailPrompt, buildInvoicePrompt,
  buildLinkedInSystemPrompt, buildPricingPrompt,
  generateText, generateChat, generateWithImage,
  ChatMessage, DEFAULT_LINKEDIN_PROFILE,
} from '../lib/gemini';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

// ─── Shared result modal ──────────────────────────────────────────────────────

function ResultModal({
  visible, title, text, charCount, onClose, onRegenerate, onMakeBetter, regenerating,
}: {
  visible: boolean; title: string; text: string; charCount?: boolean;
  onClose: () => void; onRegenerate?: () => void;
  onMakeBetter?: () => void; regenerating: boolean;
}) {
  async function copy() {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'Text copied to clipboard.');
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.handleWrap}><View style={styles.handle} /></View>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{title}</Text>
              {charCount && <Text style={styles.charCount}>{text.length} characters</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={copy} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
                <Feather name="copy" size={16} color={colors.white} />
              </Pressable>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
                <Feather name="x" size={16} color={colors.white} />
              </Pressable>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>{text}</Text>
            </View>
          </ScrollView>
          <View style={styles.resultFooter}>
            {onMakeBetter && (
              <Pressable
                onPress={onMakeBetter} disabled={regenerating}
                style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }, regenerating && { opacity: 0.4 }]}
              >
                <Feather name="trending-up" size={14} color={colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.outlineBtnText}>Make it better</Text>
              </Pressable>
            )}
            {onRegenerate && (
              <Pressable
                onPress={onRegenerate} disabled={regenerating}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, regenerating && { opacity: 0.4 }]}
              >
                {regenerating
                  ? <ActivityIndicator color={colors.black} size="small" />
                  : <><Feather name="refresh-cw" size={14} color={colors.black} style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>Try again</Text></>}
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────

function ToolCard({ icon, title, subtitle, onPress }: {
  icon: keyof typeof Feather.glyphMap; title: string; subtitle: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[styles.toolCard, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.timing(scale, { toValue: 0.97, duration: 120, useNativeDriver: true }).start()}
        onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
        style={styles.toolCardInner}
      >
        <View style={styles.toolIconWrap}><Feather name={icon} size={22} color={colors.white} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toolTitle}>{title}</Text>
          <Text style={styles.toolSubtitle}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Generic form sheet ───────────────────────────────────────────────────────

function FormSheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.handleWrap}><View style={styles.handle} /></View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
              <Feather name="x" size={16} color={colors.white} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Reusable field components ────────────────────────────────────────────────

function Label({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

function InputField({ ...props }: React.ComponentProps<typeof TextInput>) {
  return <TextInput style={styles.input} placeholderTextColor={colors.placeholder} {...props} />;
}

function TextAreaField({ ...props }: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      style={[styles.input, styles.textArea]}
      placeholderTextColor={colors.placeholder}
      multiline numberOfLines={5}
      textAlignVertical="top"
      {...props}
    />
  );
}

function GenerateButton({ onPress, loading, label = 'Generate' }: {
  onPress: () => void; loading: boolean; label?: string;
}) {
  return (
    <Pressable
      onPress={onPress} disabled={loading}
      style={({ pressed }) => [styles.primaryBtn, { marginTop: 8 }, pressed && { opacity: 0.85 }, loading && { opacity: 0.5 }]}
    >
      {loading
        ? <ActivityIndicator color={colors.black} />
        : <><Feather name="zap" size={15} color={colors.black} style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>{label}</Text></>}
    </Pressable>
  );
}

// ─── Tool 1: Invoice Writer ───────────────────────────────────────────────────

function InvoiceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [client, setClient] = useState('');
  const [work, setWork] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [resultVisible, setResultVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function generate(regen = false) {
    if (!client.trim() || !work.trim()) { Alert.alert('Required', 'Fill in all fields.'); return; }
    regen ? setRegenerating(true) : setLoading(true);
    try {
      const text = await generateText(buildInvoicePrompt(client, work));
      setResult(text); setResultVisible(true);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong.'); }
    finally { regen ? setRegenerating(false) : setLoading(false); }
  }

  function close() { setClient(''); setWork(''); setResult(''); setResultVisible(false); onClose(); }

  return (
    <>
      <FormSheet visible={visible && !resultVisible} title="Invoice Writer" onClose={close}>
        <Label text="Client Name" />
        <InputField placeholder="e.g. Arjun Menon" value={client} onChangeText={setClient} autoCapitalize="words" />
        <Label text="Work Done" />
        <TextAreaField placeholder="Describe the work you delivered..." value={work} onChangeText={setWork} />
        <GenerateButton onPress={() => generate()} loading={loading} label="Generate Invoice" />
      </FormSheet>
      <ResultModal
        visible={resultVisible} title="Invoice" text={result}
        onClose={close} onRegenerate={() => generate(true)} regenerating={regenerating}
      />
    </>
  );
}

// ─── Tool 2: Pricing Suggester ────────────────────────────────────────────────

function PricingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [resultVisible, setResultVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function generate(regen = false) {
    if (!desc.trim()) { Alert.alert('Required', 'Describe the project first.'); return; }
    regen ? setRegenerating(true) : setLoading(true);
    try {
      const text = await generateText(buildPricingPrompt(desc));
      setResult(text); setResultVisible(true);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong.'); }
    finally { regen ? setRegenerating(false) : setLoading(false); }
  }

  function close() { setDesc(''); setResult(''); setResultVisible(false); onClose(); }

  return (
    <>
      <FormSheet visible={visible && !resultVisible} title="Pricing Suggester" onClose={close}>
        <Label text="Project Description" />
        <TextAreaField placeholder="Describe the project scope, features, timeline..." value={desc} onChangeText={setDesc} />
        <GenerateButton onPress={() => generate()} loading={loading} label="Suggest Pricing" />
      </FormSheet>
      <ResultModal
        visible={resultVisible} title="Pricing Suggestion" text={result}
        onClose={close} onRegenerate={() => generate(true)} regenerating={regenerating}
      />
    </>
  );
}

// ─── Tool 3: LinkedIn Content Writer (chat-based) ────────────────────────────

interface LIMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUri?: string;
  timestamp: Date;
}

interface LIProfile {
  name: string;
  role: string;
  location: string;
  experience: string;
  stack: string;
}

function LinkedInSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<LIProfile>({ ...DEFAULT_LINKEDIN_PROFILE });
  const [editingProfile, setEditingProfile] = useState(false);
  const [messages, setMessages] = useState<LIMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Welcome message on open
  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'model',
        text: "Hey Hadi! 👋 I'm your LinkedIn content coach. Tell me what you want to post about, paste existing content to improve, or upload a screenshot of an old post.",
        timestamp: new Date(),
      }]);
    }
  }, [visible]);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) setPendingImage(res.assets[0].uri);
  }

  async function send() {
    const text = input.trim();
    if (!text && !pendingImage) return;

    const userMsg: LIMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text || '📷 [Image]',
      imageUri: pendingImage ?? undefined,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setLoading(true);

    try {
      const systemPrompt = buildLinkedInSystemPrompt(profile);
      let responseText: string;

      if (pendingImage) {
        const base64 = await FileSystem.readAsStringAsync(pendingImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
        responseText = await generateWithImage(base64, 'image/jpeg', text || 'Write a LinkedIn post about this image', systemPrompt);
      } else {
        const history: ChatMessage[] = messages
          .filter(m => m.id !== 'welcome')
          .map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        history.push({ role: 'user', parts: [{ text }] });
        responseText = await generateChat(history, systemPrompt);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: '⚠️ ' + (e?.message ?? 'Something went wrong. Try again.'),
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setMessages([]);
    setInput('');
    setPendingImage(null);
    setEditingProfile(false);
    onClose();
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  function LIBubble({ msg }: { msg: LIMessage }) {
    const isUser = msg.role === 'user';
    async function copyMsg() {
      await Clipboard.setStringAsync(msg.text);
      Alert.alert('Copied!', 'Text copied to clipboard.');
    }
    async function useThis() {
      await Clipboard.setStringAsync(msg.text);
      Alert.alert('✅ Copied to clipboard!', 'Paste it in LinkedIn.');
    }
    return (
      <View style={[liStyles.bubbleRow, isUser ? liStyles.bubbleRowUser : liStyles.bubbleRowAI]}>
        {!isUser && (
          <View style={liStyles.aiAvatar}>
            <Text style={{ fontSize: 10 }}>in</Text>
          </View>
        )}
        <View style={{ maxWidth: '80%' }}>
          {msg.imageUri && (
            <Image source={{ uri: msg.imageUri }} style={liStyles.bubbleImage} resizeMode="cover" />
          )}
          <View style={[liStyles.bubble, isUser ? liStyles.bubbleUser : liStyles.bubbleAI]}>
            <Text style={[liStyles.bubbleText, isUser ? liStyles.bubbleTextUser : liStyles.bubbleTextAI]}>
              {msg.text}
            </Text>
            <Text style={[liStyles.timestamp, isUser ? liStyles.tsUser : liStyles.tsAI]}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!isUser && msg.id !== 'welcome' && (
            <View style={liStyles.msgActions}>
              <Pressable onPress={copyMsg} style={liStyles.msgActionBtn}>
                <Feather name="copy" size={12} color={colors.muted} />
                <Text style={liStyles.msgActionText}>Copy</Text>
              </Pressable>
              <Pressable onPress={useThis} style={[liStyles.msgActionBtn, liStyles.msgActionBtnUse]}>
                <Feather name="check" size={12} color={colors.black} />
                <Text style={[liStyles.msgActionText, { color: colors.black }]}>Use this</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={liStyles.root}>
        {/* Header */}
        <View style={liStyles.header}>
          <Pressable onPress={close} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
            <Feather name="x" size={16} color={colors.white} />
          </Pressable>
          <Text style={liStyles.headerTitle}>LinkedIn Writer</Text>
          <Pressable
            onPress={() => setMessages([])}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={15} color={colors.muted} />
          </Pressable>
        </View>

        {/* Profile context card */}
        {!editingProfile ? (
          <Pressable onPress={() => setEditingProfile(true)} style={liStyles.profileCard}>
            <View style={liStyles.profileCardHeader}>
              <Text style={liStyles.profileCardTitle}>Your Profile Context</Text>
              <View style={liStyles.editBadge}>
                <Feather name="edit-2" size={11} color={colors.muted} />
                <Text style={liStyles.editBadgeText}>Edit</Text>
              </View>
            </View>
            <Text style={liStyles.profileLine}><Text style={liStyles.profileKey}>Name  </Text>{profile.name}</Text>
            <Text style={liStyles.profileLine}><Text style={liStyles.profileKey}>Role  </Text>{profile.role}</Text>
            <Text style={liStyles.profileLine}><Text style={liStyles.profileKey}>Stack </Text>{profile.stack}</Text>
          </Pressable>
        ) : (
          <ScrollView style={liStyles.profileEdit} keyboardShouldPersistTaps="handled">
            <Text style={liStyles.profileEditTitle}>Edit Your Profile</Text>
            {(['name', 'role', 'location', 'stack'] as (keyof LIProfile)[]).map(field => (
              <View key={field}>
                <Text style={styles.fieldLabel}>{field.toUpperCase()}</Text>
                <TextInput
                  style={styles.input}
                  value={profile[field]}
                  onChangeText={v => setProfile(p => ({ ...p, [field]: v }))}
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="words"
                />
              </View>
            ))}
            <Text style={styles.fieldLabel}>EXPERIENCE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.experience}
              onChangeText={v => setProfile(p => ({ ...p, experience: v }))}
              placeholderTextColor={colors.placeholder}
              multiline numberOfLines={4}
              textAlignVertical="top"
            />
            <Pressable
              onPress={() => setEditingProfile(false)}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, { marginBottom: 24 }]}
            >
              <Text style={styles.primaryBtnText}>Save Profile</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Chat messages */}
        {!editingProfile && (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => <LIBubble msg={item} />}
            contentContainerStyle={liStyles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={loading ? (
              <View style={[liStyles.bubbleRow, liStyles.bubbleRowAI]}>
                <View style={liStyles.aiAvatar}><Text style={{ fontSize: 10 }}>in</Text></View>
                <View style={[liStyles.bubble, liStyles.bubbleAI, { flexDirection: 'row', gap: 6 }]}>
                  {[0, 1, 2].map(i => <View key={i} style={liStyles.dot} />)}
                </View>
              </View>
            ) : null}
          />
        )}

        {/* Pending image preview */}
        {pendingImage && !editingProfile && (
          <View style={liStyles.pendingRow}>
            <Image source={{ uri: pendingImage }} style={liStyles.pendingThumb} />
            <Pressable onPress={() => setPendingImage(null)} style={liStyles.removePending}>
              <Feather name="x" size={11} color={colors.white} />
            </Pressable>
            <Text style={liStyles.pendingLabel}>Image attached</Text>
          </View>
        )}

        {/* Input bar */}
        {!editingProfile && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={liStyles.inputBar}>
              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [liStyles.inputAction, pressed && { opacity: 0.6 }]}
              >
                <Feather name="image" size={20} color={pendingImage ? '#818CF8' : colors.muted} />
              </Pressable>
              <TextInput
                style={liStyles.textInput}
                placeholder="Write me a post about..."
                placeholderTextColor={colors.placeholder}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={2000}
              />
              <Pressable
                onPress={send}
                disabled={loading || (!input.trim() && !pendingImage)}
                style={({ pressed }) => [
                  liStyles.sendBtn,
                  pressed && { opacity: 0.8 },
                  (loading || (!input.trim() && !pendingImage)) && { opacity: 0.3 },
                ]}
              >
                {loading
                  ? <ActivityIndicator color={colors.black} size="small" />
                  : <Feather name="send" size={15} color={colors.black} />}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

// ─── Tool 4: Cold Email Writer ────────────────────────────────────────────────

function ColdEmailSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [resultVisible, setResultVisible] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function generate(regen = false) {
    if (!recipient.trim() || !reason.trim()) { Alert.alert('Required', 'Fill in all fields.'); return; }
    regen ? setRegenerating(true) : setLoading(true);
    try {
      const text = await generateText(buildColdEmailPrompt(recipient, reason));
      setResult(text); setResultVisible(true);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong.'); }
    finally { regen ? setRegenerating(false) : setLoading(false); }
  }

  function close() { setRecipient(''); setReason(''); setResult(''); setResultVisible(false); onClose(); }

  return (
    <>
      <FormSheet visible={visible && !resultVisible} title="Cold Email Writer" onClose={close}>
        <Label text="Who are you emailing?" />
        <InputField placeholder="e.g. Founder at TechStartup, HR at Company..." value={recipient} onChangeText={setRecipient} />
        <Label text="Why are you emailing?" />
        <TextAreaField placeholder="Describe your purpose, what you want from them..." value={reason} onChangeText={setReason} />
        <GenerateButton onPress={() => generate()} loading={loading} label="Write Cold Email" />
      </FormSheet>
      <ResultModal
        visible={resultVisible} title="Cold Email" text={result}
        onClose={close} onRegenerate={() => generate(true)} regenerating={regenerating}
      />
    </>
  );
}

// ─── Main AIScreen ────────────────────────────────────────────────────────────

type Tool = 'invoice' | 'pricing' | 'linkedin' | 'email' | null;

export function AIScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AI'>) {
  const [activeTool, setActiveTool] = useState<Tool>(null);

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader
          title="AI"
          navigation={navigation}
          action={
            <Pressable
              onPress={() => navigation.navigate('AIChat')}
              style={({ pressed }) => [styles.chatFab, pressed && { opacity: 0.7 }]}
            >
              <Feather name="message-circle" size={18} color={colors.white} />
            </Pressable>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={styles.sectionLabel}>AI Tools</Text>

          <ToolCard
            icon="file-text" title="Invoice Writer"
            subtitle="Generate professional invoice text"
            onPress={() => setActiveTool('invoice')}
          />
          <ToolCard
            icon="dollar-sign" title="Pricing Suggester"
            subtitle="Get smart price estimates for projects"
            onPress={() => setActiveTool('pricing')}
          />
          <ToolCard
            icon="linkedin" title="LinkedIn Content Writer"
            subtitle="Write posts in your authentic voice"
            onPress={() => setActiveTool('linkedin')}
          />
          <ToolCard
            icon="mail" title="Cold Email Writer"
            subtitle="Craft high-conversion cold emails"
            onPress={() => setActiveTool('email')}
          />

          <View style={styles.chatCard}>
            <Pressable
              onPress={() => navigation.navigate('AIChat')}
              style={({ pressed }) => [styles.chatCardInner, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.chatCardLeft}>
                <View style={[styles.toolIconWrap, { backgroundColor: '#1A1A2E' }]}>
                  <Feather name="message-circle" size={22} color="#818CF8" />
                </View>
                <View>
                  <Text style={styles.toolTitle}>AI Chat</Text>
                  <Text style={styles.toolSubtitle}>Your personal AI assistant</Text>
                </View>
              </View>
              <Feather name="arrow-right" size={16} color={colors.muted} />
            </Pressable>
          </View>

        </ScrollView>
      </View>

      <InvoiceSheet visible={activeTool === 'invoice'} onClose={() => setActiveTool(null)} />
      <PricingSheet visible={activeTool === 'pricing'} onClose={() => setActiveTool(null)} />
      <LinkedInSheet visible={activeTool === 'linkedin'} onClose={() => setActiveTool(null)} />
      <ColdEmailSheet visible={activeTool === 'email'} onClose={() => setActiveTool(null)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.muted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  toolCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  toolCardInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  toolIconWrap: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: colors.surfaceLight, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  toolTitle: { color: colors.white, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  toolSubtitle: { color: colors.muted, fontSize: 12 },
  chatFab: {
    width: 40, height: 40, borderRadius: 16, backgroundColor: colors.surfaceLight,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  chatCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: '#1A1A2E', marginTop: 8, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  chatCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  chatCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  orTestBtn: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: '#2A1A0E', marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  orTestLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Sheet
  sheetRoot: { flex: 1, backgroundColor: colors.card, paddingHorizontal: 20 },
  handleWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#333333' },
  sheetHeader: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  sheetTitle: { color: colors.white, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  charCount: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sheetScroll: { paddingBottom: 48 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  // Fields
  sectionTag: {
    color: '#818CF8', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 8, marginBottom: 12,
  },
  fieldLabel: {
    color: colors.muted, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
  },
  input: {
    minHeight: 52, backgroundColor: colors.surfaceLight, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, color: colors.white,
    paddingHorizontal: 14, fontSize: 15, marginBottom: 20,
  },
  textArea: { minHeight: 110, paddingTop: 14, paddingBottom: 14, lineHeight: 22 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel: { color: colors.white, fontSize: 14, fontWeight: '600' },
  imagePicker: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed', height: 52, paddingHorizontal: 14, marginBottom: 12,
  },
  imagePickerText: { color: colors.muted, fontSize: 14 },
  previewThumb: { width: 72, height: 72, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  removeThumb: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20,
    borderRadius: 16, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  // Buttons
  primaryBtn: {
    height: 54, borderRadius: 16, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  primaryBtnText: { color: colors.black, fontSize: 15, fontWeight: '700' },
  outlineBtn: {
    height: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 10,
  },
  outlineBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  // Result
  resultCard: {
    backgroundColor: colors.surfaceLight, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16,
  },
  resultText: { color: colors.white, fontSize: 15, lineHeight: 26 },
  resultFooter: {
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    gap: 10,
  },
});

// ─── LinkedIn chat styles ─────────────────────────────────────────────────────

const liStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  profileCard: {
    margin: 12, padding: 14, backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: '#1A2A1A',
  },
  profileCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  profileCardTitle: { color: colors.white, fontSize: 13, fontWeight: '700' },
  editBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  editBadgeText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  profileLine: { color: colors.muted, fontSize: 12, marginBottom: 3, lineHeight: 18 },
  profileKey: { color: '#555', fontWeight: '700', fontSize: 11 },
  profileEdit: {
    backgroundColor: colors.card, marginHorizontal: 12, marginBottom: 8,
    borderRadius: 16, padding: 14, maxHeight: 340,
  },
  profileEditTitle: { color: colors.white, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  listContent: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 4 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 26, height: 26, borderRadius: 6, backgroundColor: '#0A66C2',
    alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 20,
  },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleUser: { backgroundColor: colors.white, borderBottomRightRadius: 3 },
  bubbleAI: { backgroundColor: '#1E1E1E', borderBottomLeftRadius: 3 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: colors.black },
  bubbleTextAI: { color: colors.white },
  bubbleImage: { width: 200, height: 150, borderRadius: 16, marginBottom: 6 },
  timestamp: { fontSize: 10, marginTop: 4 },
  tsUser: { color: 'rgba(0,0,0,0.4)', textAlign: 'right' },
  tsAI: { color: colors.muted },
  msgActions: { flexDirection: 'row', gap: 6, marginTop: 5, marginLeft: 4 },
  msgActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  msgActionBtnUse: { backgroundColor: colors.white, borderColor: colors.white },
  msgActionText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 8, backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  pendingThumb: { width: 36, height: 36, borderRadius: 6 },
  removePending: {
    position: 'absolute', left: 40, top: 4, width: 16, height: 16,
    borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  pendingLabel: { color: colors.muted, fontSize: 12, marginLeft: 10 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12,
    paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8,
  },
  inputAction: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1, color: colors.white, fontSize: 14,
    backgroundColor: colors.surfaceLight, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 9, maxHeight: 110, lineHeight: 20,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
});
