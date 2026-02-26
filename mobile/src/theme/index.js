import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
  
  // Common styles
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
      backgroundColor: colors.card,
      borderRadius: spacing.borderRadius.base,
      padding: spacing.cardPadding,
      ...spacing.shadow.base,
    },
    button: {
      primary: {
        backgroundColor: colors.primary,
        borderRadius: spacing.borderRadius.base,
        paddingVertical: spacing.buttonPadding,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
      },
      secondary: {
        backgroundColor: colors.secondary,
        borderRadius: spacing.borderRadius.base,
        paddingVertical: spacing.buttonPadding,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: spacing.borderRadius.base,
        paddingVertical: spacing.buttonPadding,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
      },
      text: {
        backgroundColor: 'transparent',
        paddingVertical: spacing.buttonPadding,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: spacing.borderRadius.base,
      padding: spacing.inputPadding,
      fontSize: typography.fontSize.base,
      color: colors.textPrimary,
    },
    badge: {
      success: {
        backgroundColor: colors.successLight,
        color: colors.successDark,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: spacing.borderRadius.full,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
      },
      warning: {
        backgroundColor: colors.warningLight,
        color: colors.warningDark,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: spacing.borderRadius.full,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
      },
      error: {
        backgroundColor: colors.errorLight,
        color: colors.errorDark,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: spacing.borderRadius.full,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
      },
      info: {
        backgroundColor: colors.infoLight,
        color: colors.infoDark,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: spacing.borderRadius.full,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
      },
    },
  },
};

export default theme;
