import React, { useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, FlatList, Image,
  KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { AI_CHAT_SYSTEM, ChatMessage, generateChat, generateWithImage } from '../lib/gemini';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UIMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUri?: string;
  timestamp: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function uriToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Feather name="cpu" size={12} color="#818CF8" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {msg.imageUri && (
          <Image source={{ uri: msg.imageUri }} style={styles.bubbleImage} resizeMode="cover" />
        )}
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
          {msg.text}
        </Text>
        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAI]}>
          {formatTime(msg.timestamp)}
        </Text>
      </View>
    </View>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
      <View style={styles.aiAvatar}>
        <Feather name="cpu" size={12} color="#818CF8" />
      </View>
      <View style={[styles.bubble, styles.bubbleAI, { flexDirection: 'row', gap: 6, paddingVertical: 14 }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.typingDot} />
        ))}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function AIChatScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AIChat'>) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    // Welcome message
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: "Hey Hadi 👋 I'm your personal AI assistant. Ask me anything — code, writing, decisions, ideas. What's on your mind?",
      timestamp: new Date(),
    }]);
  }, []);

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

    const userMsg: UIMessage = {
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
      let responseText: string;

      if (pendingImage) {
        // Vision call
        const base64 = await uriToBase64(pendingImage);
        responseText = await generateWithImage(base64, 'image/jpeg', text || 'What do you see in this image?', AI_CHAT_SYSTEM);
      } else {
        // Build chat history (skip welcome)
        const history: ChatMessage[] = messages
          .filter(m => m.id !== 'welcome')
          .map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        history.push({ role: 'user', parts: [{ text }] });
        responseText = await generateChat(history, AI_CHAT_SYSTEM);
      }

      const aiMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      console.error('Full error:', JSON.stringify(e));
      console.error('Error message:', e?.message);
      const errMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: '⚠️ ' + (e?.message ?? 'Something went wrong. Try again.'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    Alert.alert('Clear Chat', 'Start a fresh conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: () => {
          setMessages([{
            id: 'welcome',
            role: 'model',
            text: "Fresh start! What's on your mind?",
            timestamp: new Date(),
          }]);
        },
      },
    ]);
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="arrow-left" size={20} color={colors.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>AI Assistant</Text>
        </View>
        <Pressable
          onPress={clearChat}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="trash-2" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Bubble msg={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? <TypingIndicator /> : null}
      />

      {/* Pending image preview */}
      {pendingImage && (
        <View style={styles.pendingImageRow}>
          <Image source={{ uri: pendingImage }} style={styles.pendingThumb} />
          <Pressable onPress={() => setPendingImage(null)} style={styles.removePending}>
            <Feather name="x" size={12} color={colors.white} />
          </Pressable>
          <Text style={styles.pendingLabel}>Image attached</Text>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputBar}>
          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [styles.inputAction, pressed && { opacity: 0.6 }]}
          >
            <Feather name="image" size={20} color={pendingImage ? '#818CF8' : colors.muted} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder="Message AI..."
            placeholderTextColor={colors.placeholder}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={send}
            disabled={loading || (!input.trim() && !pendingImage)}
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.8 },
              (loading || (!input.trim() && !pendingImage)) && { opacity: 0.3 },
            ]}
          >
            {loading
              ? <ActivityIndicator color={colors.black} size="small" />
              : <Feather name="send" size={16} color={colors.black} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },

  // Messages
  listContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#1A1A2E',
    borderWidth: 1, borderColor: '#2A2A4E', alignItems: 'center',
    justifyContent: 'center', marginRight: 8, marginBottom: 18,
  },
  bubble: {
    maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: colors.white, borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: '#1E1E1E', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: colors.black },
  bubbleTextAI: { color: colors.white },
  bubbleImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  timestamp: { fontSize: 10, marginTop: 4 },
  timestampUser: { color: 'rgba(0,0,0,0.4)', textAlign: 'right' },
  timestampAI: { color: colors.muted },

  // Typing dots
  typingDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted,
  },

  // Pending image
  pendingImageRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 8, backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  pendingThumb: { width: 40, height: 40, borderRadius: 8 },
  removePending: {
    position: 'absolute', left: 44, top: 4, width: 18, height: 18,
    borderRadius: 9, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center',
  },
  pendingLabel: { color: colors.muted, fontSize: 13, marginLeft: 12 },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12,
    paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    gap: 8,
  },
  inputAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1, color: colors.white, fontSize: 15,
    backgroundColor: colors.surfaceLight, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 120, lineHeight: 22,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
});
