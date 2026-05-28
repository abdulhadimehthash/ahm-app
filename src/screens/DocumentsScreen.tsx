import React, { useRef, useState, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator, Alert, Animated, Dimensions, FlatList,
  Image, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Field } from '../components/Field';
import { FloatingButton } from '../components/FloatingButton';
import { FormModal } from '../components/FormModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../lib/types';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

const { width: SW, height: SH } = Dimensions.get('window');
const MAX_PHOTOS = 5;

type Doc = {
  id: string;
  name: string;
  image_url: string;
  created_at: string;
};

type PickedAsset = {
  uri: string;
  mimeType: string;
};

// ── Swipe-to-delete row ────────────────────────────────────────────────────
function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const tx = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => { if (g.dx < 0) tx.setValue(Math.max(g.dx, -90)); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -45) Animated.spring(tx, { toValue: -90, useNativeDriver: true }).start();
      else Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
    }
  })).current;
  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 12 }}>
      <Pressable
        onPress={() => { Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start(); onDelete(); }}
        style={styles.delAction}>
        <Text style={styles.delActionText}>🗑{'\n'}Delete</Text>
      </Pressable>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ── Full-screen viewer ─────────────────────────────────────────────────────
function DocViewer({ doc, onClose, onDelete }: { doc: Doc | null; onClose: () => void; onDelete: (d: Doc) => void }) {
  if (!doc) return null;
  async function shareDoc() {
    try {
      if (Platform.OS === 'web') { window.open(doc!.image_url, '_blank'); return; }
      const ok = await Sharing.isAvailableAsync();
      if (!ok) { Alert.alert('Sharing not available'); return; }
      await Sharing.shareAsync(doc!.image_url, { mimeType: 'image/jpeg' });
    } catch (e: any) { Alert.alert('Error', e.message); }
  }
  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.viewerBg}>
        <View style={styles.viewerHeader}>
          <Pressable onPress={onClose} style={styles.viewerBtn}>
            <Text style={styles.viewerBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.viewerTitle} numberOfLines={1}>{doc.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={shareDoc} style={styles.viewerBtn}>
              <Text style={styles.viewerBtnText}>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Delete?', `Delete "${doc.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { onClose(); onDelete(doc!); } }
              ])}
              style={[styles.viewerBtn, { borderColor: colors.red }]}>
              <Text style={[styles.viewerBtnText, { color: colors.red }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView maximumZoomScale={4} minimumZoomScale={1}
          contentContainerStyle={styles.viewerImgWrap} centerContent showsVerticalScrollIndicator={false}>
          <Image source={{ uri: doc.image_url }} style={styles.viewerImg} resizeMode="contain" />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export function DocumentsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Documents'>) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDoc, setViewDoc] = useState<Doc | null>(null);
  const [docName, setDocName] = useState('');

  // Use a ref for picked photos so state is always current (no stale closure)
  const [picked, setPicked] = useState<PickedAsset[]>([]);
  const pickedRef = useRef<PickedAsset[]>([]);

  function addPicked(asset: PickedAsset) {
    const next = [...pickedRef.current, asset].slice(0, MAX_PHOTOS);
    pickedRef.current = next;
    setPicked(next);
  }

  function removePicked(idx: number) {
    const next = pickedRef.current.filter((_, i) => i !== idx);
    pickedRef.current = next;
    setPicked(next);
  }

  function clearPicked() {
    pickedRef.current = [];
    setPicked([]);
  }

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setDocs(data ?? []);
  }

  // ── Pick ONE photo from gallery (call multiple times for more) ──
  async function pickFromGallery() {
    if (pickedRef.current.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const a = result.assets[0];
        addPicked({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not open gallery');
    }
  }

  // ── Take ONE photo with camera ──
  async function takePhoto() {
    if (pickedRef.current.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera access in Settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const a = result.assets[0];
        addPicked({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not open camera');
    }
  }

  // ── Web file picker ──
  function pickFromWeb() {
    if (pickedRef.current.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file: File = e.target.files?.[0];
      if (file) {
        addPicked({ uri: URL.createObjectURL(file), mimeType: file.type || 'image/jpeg' });
      }
    };
    input.click();
  }

  // ── Upload single image to Supabase ──
  async function uploadImage(asset: PickedAsset): Promise<string> {
    const ext = asset.mimeType.split('/')[1] ?? 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    let bytes: Uint8Array;

    if (Platform.OS === 'web') {
      // Web: fetch blob URL directly
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    } else {
      // Native Android/iOS: use FileSystem to read content:// or file:// URIs
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryStr = atob(base64);
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, bytes, { contentType: asset.mimeType, upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from('documents').getPublicUrl(data.path).data.publicUrl;
  }

  // ── Save all picked photos ──
  async function saveDocuments() {
    const currentPicked = pickedRef.current;
    if (!docName.trim()) {
      Alert.alert('Missing name', 'Please enter a document name.');
      return;
    }
    if (currentPicked.length === 0) {
      Alert.alert('No photos', 'Please add at least one photo first.');
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < currentPicked.length; i++) {
        const label = currentPicked.length > 1
          ? `${docName.trim()} (${i + 1})`
          : docName.trim();
        const imageUrl = await uploadImage(currentPicked[i]);
        const { error } = await supabase.from('documents').insert({ name: label, image_url: imageUrl });
        if (error) throw new Error(error.message);
      }
      setDocName('');
      clearPicked();
      setModalVisible(false);
      await loadDocs();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(doc: Doc) {
    try {
      const parts = doc.image_url.split('/documents/');
      if (parts.length > 1) await supabase.storage.from('documents').remove([parts[1]]);
    } catch { /* ignore */ }
    await supabase.from('documents').delete().eq('id', doc.id);
    await loadDocs();
  }

  function closeModal() {
    setModalVisible(false);
    setDocName('');
    clearPicked();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  return (
    <View style={sharedStyles.screen}>
      <View style={sharedStyles.contentContainer}>
        <ScreenHeader title="Documents" navigation={navigation} />

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <FlatList
            data={docs}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📄</Text>
                <Text style={styles.emptyText}>No documents yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add documents</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SwipeRow onDelete={() =>
                Alert.alert('Delete?', `Delete "${item.name}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(item) }
                ])}>
                <Pressable
                  onPress={() => setViewDoc(item)}
                  style={({ pressed }) => [styles.docCard, pressed && { opacity: 0.85 }]}>
                  <View style={styles.docLeft}>
                    <Text style={styles.docName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.docDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Image source={{ uri: item.image_url }} style={styles.docThumb} resizeMode="cover" />
                </Pressable>
              </SwipeRow>
            )}
          />
        )}
      </View>

      <FloatingButton onPress={() => setModalVisible(true)} />
      <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} onDelete={doc => deleteDoc(doc)} />

      {/* ── Add Document Modal ── */}
      <FormModal visible={modalVisible} title="Add Document" onClose={closeModal}>
        <Field label="Document Name" value={docName} onChangeText={setDocName}
          placeholder="e.g. Bank Statement" />

        {/* Photo count indicator */}
        <Text style={styles.photoCount}>
          Photos added: {picked.length} / {MAX_PHOTOS}
        </Text>

        {/* Add photo buttons */}
        <View style={styles.pickerRow}>
          {Platform.OS === 'web' ? (
            <Pressable
              onPress={pickFromWeb}
              style={({ pressed }) => [styles.pickerBtn, { flex: 1 }, pressed && { opacity: 0.7 }]}>
              <Text style={styles.pickerBtnIcon}>🖼️</Text>
              <Text style={styles.pickerBtnText}>Choose Photo</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={takePhoto}
                style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.pickerBtnIcon}>📷</Text>
                <Text style={styles.pickerBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={pickFromGallery}
                style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.pickerBtnIcon}>🖼️</Text>
                <Text style={styles.pickerBtnText}>Gallery</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Preview row */}
        {picked.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 10 }}>
            {picked.map((asset, idx) => (
              <View key={idx} style={styles.previewItem}>
                <Image source={{ uri: asset.uri }} style={styles.previewImg} resizeMode="cover" />
                <Pressable onPress={() => removePicked(idx)} style={styles.previewRemove}>
                  <Text style={styles.previewRemoveText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Save button */}
        <Pressable
          onPress={saveDocuments}
          disabled={uploading}
          style={({ pressed }) => [styles.saveBtn, (pressed || uploading) && { opacity: 0.7 }]}>
          {uploading
            ? <ActivityIndicator color={colors.black} />
            : <Text style={styles.saveBtnText}>
                Save {picked.length > 1 ? `${picked.length} Documents` : 'Document'}
              </Text>
          }
        </Pressable>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  docCard: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  docLeft: { flex: 1, marginRight: 14 },
  docName: { color: colors.white, fontSize: 16, fontWeight: '700', marginBottom: 6, lineHeight: 22 },
  docDate: { color: colors.muted, fontSize: 13 },
  docThumb: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.surfaceLight },
  delAction: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 90,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', borderRadius: 16,
  },
  delActionText: { color: colors.white, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyText: { color: colors.white, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: colors.muted, fontSize: 14 },
  photoCount: {
    color: colors.muted, fontSize: 12, fontWeight: '400',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 12,
  },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pickerBtn: {
    flex: 1, backgroundColor: colors.surfaceLight, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  pickerBtnIcon: { fontSize: 24, marginBottom: 6 },
  pickerBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  previewItem: { position: 'relative', width: 80, height: 80 },
  previewImg: { width: 80, height: 80, borderRadius: 16, backgroundColor: colors.surfaceLight },
  previewRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 24, height: 24, borderRadius: 16,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  previewRemoveText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  saveBtn: {
    height: 52, borderRadius: 16, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnText: { color: colors.black, fontSize: 15, fontWeight: '700' },
  viewerBg: { flex: 1, backgroundColor: '#000' },
  viewerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.85)',
  },
  viewerTitle: { color: colors.white, fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  viewerBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  viewerBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  viewerImgWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: SH - 120 },
  viewerImg: { width: SW, height: SH - 120 },
});
