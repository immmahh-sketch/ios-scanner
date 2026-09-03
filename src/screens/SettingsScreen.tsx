import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import {
  getApiKey,
  getEmailKey,
  getPrefs,
  hasApiKey,
  hasEmailKey,
  MODELS,
  setApiKey,
  setEmailKey,
  updatePrefs,
  type EmailMethod,
  type ModelId,
  type Prefs,
} from '../lib/settings';
import { testConnection } from '../lib/ai';
import { sendTestEmail } from '../lib/email';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

const EMAIL_METHODS: { id: EmailMethod; label: string; note: string }[] = [
  {
    id: 'app',
    label: 'Send through the app',
    note: 'Sends directly with the attachment. Needs an email API key (below).',
  },
  { id: 'outlook', label: 'Open in Outlook', note: 'Opens Outlook pre-filled. No attachment.' },
  { id: 'share', label: 'Share sheet', note: 'iOS share sheet — attach the file, pick any app.' },
];

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [anthropicInput, setAnthropicInput] = useState('');
  const [anthropicSaved, setAnthropicSaved] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPrefs().then(setPrefs);
    hasApiKey().then(setAnthropicSaved);
    hasEmailKey().then(setEmailSaved);
    getApiKey().then((k) => k && setAnthropicInput(mask(k)));
    getEmailKey().then((k) => k && setEmailInput(mask(k)));
  }, []);

  const patch = async (p: Partial<Prefs>) => setPrefs(await updatePrefs(p));

  const saveAnthropic = async () => {
    if (anthropicInput.includes('•')) return;
    await setApiKey(anthropicInput);
    setAnthropicSaved(anthropicInput.trim().length > 0);
    if (anthropicInput.trim()) setAnthropicInput(mask(anthropicInput.trim()));
    Alert.alert('Saved', 'Anthropic key stored in the Keychain.');
  };

  const saveEmail = async () => {
    if (emailInput.includes('•')) return;
    await setEmailKey(emailInput);
    setEmailSaved(emailInput.trim().length > 0);
    if (emailInput.trim()) setEmailInput(mask(emailInput.trim()));
    Alert.alert('Saved', 'Email key stored in the Keychain.');
  };

  const testAi = async () => {
    setBusy('Testing…');
    try {
      const r = await testConnection();
      Alert.alert(r.ok ? 'Success' : 'Failed', r.message);
    } finally {
      setBusy(null);
    }
  };

  const testEmailSend = async () => {
    setBusy('Sending test…');
    try {
      const r = await sendTestEmail();
      Alert.alert(r.ok ? 'Test accepted' : 'Test failed', r.message);
    } finally {
      setBusy(null);
    }
  };

  const addRecipient = async () => {
    const e = newRecipient.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      Alert.alert('Invalid', 'Enter a valid email address.');
      return;
    }
    if (prefs && !prefs.recipients.includes(e)) {
      await patch({ recipients: [...prefs.recipients, e] });
    }
    setNewRecipient('');
  };

  const removeRecipient = async (e: string) => {
    if (prefs) await patch({ recipients: prefs.recipients.filter((r) => r !== e) });
  };

  if (!prefs) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* --- AI --- */}
        <Text style={styles.h}>AI (scan reading)</Text>
        <Text style={styles.hint}>
          Anthropic API key from console.anthropic.com → API keys. Stored only in this phone&apos;s
          Keychain; sent only to api.anthropic.com.
        </Text>
        <TextInput
          style={styles.input}
          value={anthropicInput}
          onChangeText={setAnthropicInput}
          placeholder="sk-ant-…"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!anthropicInput.includes('•')}
          onFocus={() => anthropicInput.includes('•') && setAnthropicInput('')}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title={anthropicSaved ? 'Update key' : 'Save key'} onPress={saveAnthropic} />
          </View>
          <View style={styles.flex}>
            <Button title="Test" kind="secondary" onPress={testAi} disabled={!anthropicSaved} />
          </View>
        </View>

        <Text style={styles.h}>Model</Text>
        {MODELS.map((m) => (
          <SelectRow
            key={m.id}
            title={m.label}
            note={m.note}
            active={prefs.model === m.id}
            onPress={() => patch({ model: m.id as ModelId })}
          />
        ))}

        <View style={styles.divider} />

        {/* --- Email --- */}
        <Text style={styles.h}>Email — send method</Text>
        {EMAIL_METHODS.map((m) => (
          <SelectRow
            key={m.id}
            title={m.label}
            note={m.note}
            active={prefs.emailMethod === m.id}
            onPress={() => patch({ emailMethod: m.id })}
          />
        ))}

        {prefs.emailMethod === 'app' ? (
          <>
            <Text style={styles.h}>Email API key</Text>
            <Text style={styles.hint}>
              An email-sending service key. The “From” address below must be a verified sender /
              authenticated domain on that service.
            </Text>
            <TextInput
              style={styles.input}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="paste key"
              placeholderTextColor={theme.colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!emailInput.includes('•')}
              onFocus={() => emailInput.includes('•') && setEmailInput('')}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button title={emailSaved ? 'Update key' : 'Save key'} onPress={saveEmail} />
              </View>
              <View style={styles.flex}>
                <Button
                  title="Send test"
                  kind="secondary"
                  disabled={!emailSaved}
                  onPress={testEmailSend}
                />
              </View>
            </View>
            <Text style={styles.status}>{emailSaved ? '● Key saved' : '○ No key'}</Text>
          </>
        ) : null}

        <Text style={styles.h}>From</Text>
        <Text style={styles.hint}>
          For Outlook this only applies if the address is an account already added in Outlook.
        </Text>
        <TextInput
          style={styles.input}
          value={prefs.fromName}
          onChangeText={(v) => patch({ fromName: v })}
          placeholder="Display name (optional)"
          placeholderTextColor={theme.colors.textDim}
        />
        <TextInput
          style={styles.input}
          value={prefs.fromEmail}
          onChangeText={(v) => patch({ fromEmail: v.trim() })}
          placeholder="gm@blackhorsebeamish.co.uk"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={styles.h}>Recipient buttons</Text>
        {prefs.recipients.map((r) => (
          <View key={r} style={styles.recipientRow}>
            <Text style={styles.recipientText} numberOfLines={1}>
              {r}
            </Text>
            <Pressable onPress={() => removeRecipient(r)} hitSlop={10}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            value={newRecipient}
            onChangeText={setNewRecipient}
            placeholder="add@example.com"
            placeholderTextColor={theme.colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onSubmitEditing={addRecipient}
          />
          <Button title="Add" kind="secondary" onPress={addRecipient} />
        </View>
      </ScrollView>

      <View style={styles.section}>
        <Button title="Done" kind="secondary" onPress={() => navigation.goBack()} />
      </View>
      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

function SelectRow({
  title,
  note,
  active,
  onPress,
}: {
  title: string;
  note: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.selectRow,
        active && styles.selectRowActive,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      <View style={styles.flex}>
        <Text style={styles.selectLabel}>{title}</Text>
        <Text style={styles.hint}>{note}</Text>
      </View>
      <Text style={styles.radio}>{active ? '●' : '○'}</Text>
    </Pressable>
  );
}

function mask(k: string): string {
  return k.length <= 12 ? '••••••••' : `${k.slice(0, 6)}${'•'.repeat(10)}${k.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { padding: 20, gap: 10 },
  flex: { flex: 1 },
  h: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 16 },
  hint: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17 },
  status: { color: theme.colors.textDim, fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: 15,
    padding: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: 18 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 14,
  },
  selectRowActive: { borderColor: theme.colors.accent },
  selectLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  radio: { color: theme.colors.accent, fontSize: 18 },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  recipientText: { color: theme.colors.text, fontSize: 14, flex: 1 },
  remove: { color: theme.colors.danger, fontSize: 16, fontWeight: '700', paddingLeft: 12 },
  section: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
