import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { getApiKey, getModel, hasApiKey, MODELS, setApiKey, setModel, type ModelId } from '../lib/settings';
import { testConnection } from '../lib/ai';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [model, setModelState] = useState<ModelId>('claude-opus-5');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    hasApiKey().then(setKeySaved);
    getModel().then(setModelState);
    getApiKey().then((k) => {
      if (k) setKeyInput(maskKey(k));
    });
  }, []);

  const saveKey = async () => {
    if (keyInput.includes('•')) {
      Alert.alert('No change', 'The key field still shows the saved key. Paste a new key to replace it.');
      return;
    }
    await setApiKey(keyInput);
    setKeySaved(keyInput.trim().length > 0);
    if (keyInput.trim()) setKeyInput(maskKey(keyInput.trim()));
    Alert.alert('Saved', keyInput.trim() ? 'API key stored in the iOS Keychain.' : 'API key cleared.');
  };

  const pickModel = async (id: ModelId) => {
    setModelState(id);
    await setModel(id);
  };

  const test = async () => {
    setBusy('Testing…');
    try {
      const r = await testConnection();
      Alert.alert(r.ok ? 'Success' : 'Failed', r.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Anthropic API key</Text>
        <Text style={styles.hint}>
          From console.anthropic.com → API keys. Stored only in this phone&apos;s Keychain and sent
          only to api.anthropic.com. Used to read scans and auto-name files.
        </Text>
        <TextInput
          style={styles.input}
          value={keyInput}
          onChangeText={setKeyInput}
          placeholder="sk-ant-…"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!keyInput.includes('•')}
          onFocus={() => {
            if (keyInput.includes('•')) setKeyInput('');
          }}
        />
        <View style={styles.rowButtons}>
          <View style={styles.flex}>
            <Button title={keySaved ? 'Update key' : 'Save key'} onPress={saveKey} />
          </View>
          <View style={styles.flex}>
            <Button title="Test" kind="secondary" onPress={test} disabled={!keySaved} />
          </View>
        </View>
        <Text style={styles.status}>{keySaved ? '● Key saved' : '○ No key — auto-naming is off'}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Model</Text>
        {MODELS.map((m) => (
          <Pressable
            key={m.id}
            style={({ pressed }) => [
              styles.modelRow,
              model === m.id && styles.modelRowActive,
              pressed && styles.pressed,
            ]}
            onPress={() => pickModel(m.id)}
          >
            <View style={styles.flex}>
              <Text style={styles.modelLabel}>{m.label}</Text>
              <Text style={styles.hint}>{m.note}</Text>
            </View>
            <Text style={styles.radio}>{model === m.id ? '●' : '○'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.section}>
        <Button title="Done" kind="secondary" onPress={() => navigation.goBack()} />
      </View>
      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

function maskKey(k: string): string {
  if (k.length <= 12) return '••••••••';
  return `${k.slice(0, 8)}${'•'.repeat(12)}${k.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { padding: 20, gap: 10 },
  flex: { flex: 1 },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  hint: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17 },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: 15,
    padding: 14,
  },
  rowButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  status: { color: theme.colors.textDim, fontSize: 13, marginTop: 6 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 18,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 14,
  },
  modelRowActive: { borderColor: theme.colors.accent },
  modelLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  radio: { color: theme.colors.accent, fontSize: 18 },
  pressed: { opacity: 0.7 },
  section: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
