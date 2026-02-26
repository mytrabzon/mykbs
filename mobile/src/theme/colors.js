/**
 * KBS Pro / Hotel Ops — Light + Dark palette
 * Tek palette, premium his; dark modda tam siyah yok.
 */

export const lightColors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  textInverse: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primarySoft: '#E8F0FF',
  primaryDisabled: '#93C5FD',

  success: '#16A34A',
  successSoft: '#E9F9EF',
  successDark: '#15803D',

  warning: '#F59E0B',
  warningSoft: '#FFF7E6',

  error: '#EF4444',
  errorSoft: '#FFE9E9',
  errorDark: '#DC2626',

  white: '#FFFFFF',
  black: '#111827',
};

export const darkColors = {
  background: '#0B1220',
  surface: '#0F1A2E',
  surfaceCard: '#0F1A2E',
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textDisabled: '#6B7280',
  textInverse: '#111827',
  border: '#1F2A44',
  borderLight: '#1E293B',

  primary: '#60A5FA',
  primaryHover: '#3B82F6',
  primarySoft: '#1E3A5F',
  primaryDisabled: '#1F3B6B',

  success: '#34D399',
  successSoft: '#064E3B',
  successDark: '#10B981',

  warning: '#FBBF24',
  warningSoft: '#422006',

  error: '#F87171',
  errorSoft: '#7F1D1D',
  errorDark: '#EF4444',

  white: '#FFFFFF',
  black: '#0B1220',
};

// Legacy export: default light (theme context ile override edilir)
export const colors = lightColors;
