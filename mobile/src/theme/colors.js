/**
 * KBS Pro — Modern palette (Indigo/Teal accent)
 * Light: temiz, aydınlık; Dark: derin, premium.
 */

export const lightColors = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textDisabled: '#94A3B8',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primarySoft: '#EEF2FF',
  primaryDisabled: '#A5B4FC',

  success: '#10B981',
  successSoft: '#D1FAE5',
  successDark: '#059669',

  warning: '#F59E0B',
  warningSoft: '#FEF3C7',

  error: '#EF4444',
  errorSoft: '#FEE2E2',
  errorDark: '#DC2626',

  accent: '#0EA5E9',
  accentSoft: '#E0F2FE',

  white: '#FFFFFF',
  black: '#0F172A',

  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray400: '#94A3B8',
  gray600: '#475569',
};

export const darkColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceCard: '#1E293B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textDisabled: '#64748B',
  textInverse: '#0F172A',
  border: '#334155',
  borderLight: '#1E293B',

  primary: '#818CF8',
  primaryHover: '#6366F1',
  primarySoft: '#312E81',
  primaryDisabled: '#3730A3',

  success: '#34D399',
  successSoft: '#064E3B',
  successDark: '#10B981',

  warning: '#FBBF24',
  warningSoft: '#422006',

  error: '#F87171',
  errorSoft: '#7F1D1D',
  errorDark: '#EF4444',

  accent: '#38BDF8',
  accentSoft: '#0C4A6E',

  white: '#FFFFFF',
  black: '#0F172A',

  gray50: '#1E293B',
  gray100: '#0F172A',
  gray400: '#64748B',
  gray600: '#94A3B8',
};

// Legacy export: default light (theme context ile override edilir)
export const colors = lightColors;
