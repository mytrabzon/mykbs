import { Platform } from 'react-native';

export const typography = {
  // Font Families
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),
  
  // Font Weights
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
  
  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
  },
  
  // Text Styles
  text: {
    h1: {
      fontSize: 36,
      fontWeight: '700',
      lineHeight: 1.2,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 30,
      fontWeight: '700',
      lineHeight: 1.3,
      letterSpacing: -0.25,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    h5: {
      fontSize: 18,
      fontWeight: '500',
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    h6: {
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    body1: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    body2: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 1.5,
      letterSpacing: 0,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 1.5,
      letterSpacing: 0.4,
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 1.5,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    overline: {
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 1.5,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
  },
};
