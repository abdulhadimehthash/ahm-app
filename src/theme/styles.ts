import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
    padding: 24,
    // Center content on web for mobile-app feel
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch'
  },
  contentContainer: {
    width: Platform.OS === 'web' ? 400 : '100%',
    flex: 1
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.white,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.surface,
    marginBottom: 16
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    backgroundColor: colors.surface
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    // Subtle shadow for premium feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  primaryButtonText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  outlineButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.borderLight,
    borderWidth: 1,
    paddingHorizontal: 20
  },
  outlineText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600'
  }
});
