import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';
import { MODE_HINTS, MODE_LABELS, type ScanMode } from '../types';

const MODES: ScanMode[] = ['bw', 'color-doc', 'color-photo'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (mode: ScanMode) => void;
}

export function ModeSheet({ visible, onClose, onPick }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Choose scan type</Text>
          {MODES.map((mode) => (
            <Pressable
              key={mode}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              onPress={() => onPick(mode)}
            >
              <Text style={styles.optionLabel}>{MODE_LABELS[mode]}</Text>
              <Text style={styles.optionHint}>{MODE_HINTS[mode]}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 6,
  },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  option: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: 16,
    gap: 4,
  },
  pressed: { opacity: 0.7 },
  optionLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  optionHint: { color: theme.colors.textDim, fontSize: 13 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: theme.colors.accent, fontSize: 16, fontWeight: '600' },
});
