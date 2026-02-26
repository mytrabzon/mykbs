/**
 * KBS Pro — Tipografi: net, okunaklı
 * H1: 28–32 / SemiBold, H2: 18–20 / SemiBold, Body: 15–16 / Regular,
 * Caption: 12–13, Button: 16 / SemiBold. Line height: body 22–24, başlık 34–38.
 */

import { Platform } from 'react-native';

export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),

  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  fontSize: {
    caption: 12,
    captionLarge: 13,
    body: 15,
    bodyLarge: 16,
    button: 16,
    h2: 18,
    h2Large: 20,
    h1: 28,
    h1Large: 32,
  },

  lineHeight: {
    caption: 16,
    body: 22,
    bodyLarge: 24,
    button: 24,
    h2: 26,
    h1: 34,
    h1Large: 38,
  },

  /** Hazır metin stilleri */
  text: {
    h1: {
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 34,
      letterSpacing: -0.25,
    },
    h1Large: {
      fontSize: 32,
      fontWeight: '600',
      lineHeight: 38,
      letterSpacing: -0.25,
    },
    h2: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 26,
    },
    h2Large: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
    body: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 22,
    },
    bodyLarge: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    },
    captionLarge: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },
  },
};

export default typography;
