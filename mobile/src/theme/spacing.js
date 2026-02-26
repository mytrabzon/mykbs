/**
 * KBS Pro — 8pt grid: 8/12/16/24/32
 * Köşe: kart 16, buton 14, input 12, pill/chip 20. Gölge: min (elevation 2–4).
 */

import { Platform } from 'react-native';

export const spacing = {
  unit: 8,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,

  screenPadding: 20,
  cardPadding: 16,
  buttonHeight: 52,
  inputHeight: 52,
  headerHeight: 68,
  tabBarHeight: 80,

  borderRadius: {
    input: 12,
    button: 14,
    card: 16,
    pill: 20,
    full: 9999,
  },

  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 2,
    },
    base: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 6,
    },
  },

  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
};

export default spacing;
