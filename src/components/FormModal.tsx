import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { sharedStyles } from '../theme/styles';

export function FormModal({
  visible,
  title,
  onClose,
  children
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="pageSheet" 
      onRequestClose={onClose}
    >
      <View style={sharedStyles.screen}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={[sharedStyles.contentContainer, styles.modalInner]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable 
              onPress={onClose} 
              style={({ pressed }) => [
                styles.close,
                pressed && { backgroundColor: colors.surfaceLight }
              ]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalInner: {
    paddingTop: 10
  },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between'
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  closeText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '300'
  },
  scrollContent: {
    paddingBottom: 40
  }
});
