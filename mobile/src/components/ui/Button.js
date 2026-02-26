import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

const VARIANTS = {
  primary: (c) => ({
    backgroundColor: c.primary,
  }),
  secondary: (c) => ({
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  }),
  tertiary: (c) => ({
    backgroundColor: 'transparent',
  }),
  destructive: (c) => ({
    backgroundColor: c.error,
  }),
};

const TEXT_VARIANTS = {
  primary: (c) => ({ color: c.textInverse }),
  secondary: (c) => ({ color: c.primary }),
  tertiary: (c) => ({ color: c.primary }),
  destructive: (c) => ({ color: c.textInverse }),
};

export function Button({
  variant = 'primary',
  onPress,
  disabled,
  loading,
  children,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  ...rest
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const variantStyle = VARIANTS[variant]?.(colors) || VARIANTS.primary(colors);
  const textColor = TEXT_VARIANTS[variant]?.(colors) || TEXT_VARIANTS.primary(colors);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle,
        isDisabled && variant === 'primary' && { backgroundColor: colors.primaryDisabled },
        isDisabled && variant === 'secondary' && { opacity: 0.6 },
        isDisabled && variant === 'destructive' && { opacity: 0.8 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor.color} />
      ) : (
        <>
          {leftIcon}
          {typeof children === 'string' ? (
            <Text style={[styles.text, textColor, textStyle]}>{children}</Text>
          ) : (
            children
          )}
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: spacing.buttonHeight,
    borderRadius: spacing.borderRadius.button,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  text: {
    fontSize: typography.text.button.fontSize,
    fontWeight: typography.fontWeight.semibold,
  },
});
