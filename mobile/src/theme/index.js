import { lightColors as colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

/** Varsayılan (light) theme — useTheme() ile ekranda güncel renk alınır */
export const theme = {
  colors,
  typography,
  spacing,

  styles: {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.screenPadding,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: spacing.borderRadius.card,
      padding: spacing.cardPadding,
      ...spacing.shadow.base,
    },
    button: {
      primary: {
        backgroundColor: colors.primary,
        borderRadius: spacing.borderRadius.button,
        minHeight: spacing.buttonHeight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
      },
      secondary: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: spacing.borderRadius.button,
        minHeight: spacing.buttonHeight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
      },
      destructive: {
        backgroundColor: colors.error,
        borderRadius: spacing.borderRadius.button,
        minHeight: spacing.buttonHeight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
      },
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.borderRadius.input,
      paddingHorizontal: spacing.md,
      minHeight: spacing.inputHeight,
      fontSize: typography.text.bodyLarge.fontSize,
      color: colors.textPrimary,
    },
  },
};

export { colors, typography, spacing };
export { lightColors, darkColors } from './colors';
