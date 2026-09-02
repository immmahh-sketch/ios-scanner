import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';

import { theme } from '../theme';

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  kind?: ButtonKind;
  icon?: string;
}

export function Button({ title, kind = 'primary', icon, disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kindStyles[kind],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Text style={[styles.btnText, kind === 'ghost' && styles.ghostText]}>
        {icon ? `${icon}  ` : ''}
        {title}
      </Text>
    </Pressable>
  );
}

export function BusyOverlay({ visible, label }: { visible: boolean; label?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.overlayCard}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          {label ? <Text style={styles.overlayText}>{label}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnText: {
    color: theme.colors.accentText,
    fontSize: 16,
    fontWeight: '600',
  },
  ghostText: { color: theme.colors.accent },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: theme.colors.surface,
    padding: 28,
    borderRadius: theme.radius,
    alignItems: 'center',
    gap: 14,
    minWidth: 180,
  },
  overlayText: { color: theme.colors.text, fontSize: 15 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 16,
  },
});

const kindStyles: Record<ButtonKind, object> = {
  primary: { backgroundColor: theme.colors.accent },
  secondary: { backgroundColor: theme.colors.surfaceAlt },
  danger: { backgroundColor: theme.colors.danger },
  ghost: { backgroundColor: 'transparent' },
};
