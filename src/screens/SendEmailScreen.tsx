import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { sendEmail } from '../lib/email';
import { getPrefs, methodReady, type EmailMethod, type Prefs } from '../lib/settings';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

const METHOD_LABEL: Record<EmailMethod, string> = {
  app: 'Send through the app',
  outlook: 'Open in Outlook',
  share: 'Share sheet',
};

export function SendEmailScreen({ route, navigation }: ScreenProps<'SendEmail'>) {
  const { subject: subject0, body: body0, attachments, suggestedRecipient } = route.params;

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [keyReady, setKeyReady] = useState(true);
  const [to, setTo] = useState(suggestedRecipient ?? '');
  const [custom, setCustom] = useState(false);
  const [subject, setSubject] = useState(subject0);
  const [body, setBody] = useState(body0);
  const [override, setOverride] = useState<EmailMethod | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPrefs().then((p) => {
      setPrefs(p);
      if (!suggestedRecipient && p.recipients[0]) setTo(p.recipients[0]);
      methodReady(p.emailMethod).then(setKeyReady);
    });
  }, [suggestedRecipient]);

  const method: EmailMethod = useMemo(() => {
    if (!prefs) return 'share';
    const chosen = override ?? prefs.emailMethod;
    // "Send through the app" chosen but no key saved → fall back to the share sheet.
    if (chosen === 'app' && !keyReady) return 'share';
    return chosen;
  }, [prefs, keyReady, override]);

  const canAttach = method === 'app';
  const hasAttach = attachments.length > 0;

  const send = async () => {
    if (method !== 'share' && !to.trim()) {
      Alert.alert('No recipient', 'Choose a recipient or enter one.');
      return;
    }
    setBusy(true);
    try {
      const result = await sendEmail(method, { to: to.trim(), subject, body, attachments });
      if (method === 'app') {
        const id = result && 'id' in result ? result.id : '';
        Alert.alert('Sent', `Emailed to ${to.trim()}${id ? `\n(id ${id})` : ''}.`);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>To</Text>
          <View style={styles.chips}>
            {(prefs?.recipients ?? []).map((r) => (
              <Chip
                key={r}
                label={r}
                active={!custom && to === r}
                onPress={() => {
                  setCustom(false);
                  setTo(r);
                }}
              />
            ))}
            <Chip
              label="Other"
              active={custom}
              onPress={() => {
                setCustom(true);
                setTo('');
              }}
            />
          </View>
          {custom ? (
            <TextInput
              style={styles.input}
              value={to}
              onChangeText={setTo}
              placeholder="name@example.com"
              placeholderTextColor={theme.colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          ) : null}

          <Text style={styles.label}>From</Text>
          <Text style={styles.readonly}>
            {prefs?.fromName ? `${prefs.fromName} <${prefs?.fromEmail}>` : prefs?.fromEmail ?? '—'}
          </Text>

          <Text style={styles.label}>Subject</Text>
          <TextInput style={styles.input} value={subject} onChangeText={setSubject} />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={body}
            onChangeText={setBody}
            multiline
          />

          {hasAttach ? (
            <>
              <Text style={styles.label}>Attachment{attachments.length > 1 ? 's' : ''}</Text>
              {attachments.map((a) => (
                <Text key={a.filename} style={styles.attach}>
                  📎 {a.filename}
                </Text>
              ))}
              {method === 'outlook' ? (
                <Text style={styles.warn}>
                  Outlook can&apos;t take an attachment from a link — it opens the share sheet with
                  the file instead.
                </Text>
              ) : method === 'share' ? (
                <Text style={styles.warn}>
                  Opens the iOS share sheet with the file attached — good for large files (Google
                  Drive, Files, AirDrop) or picking another mail app.
                </Text>
              ) : null}
            </>
          ) : null}

          <Text style={styles.label}>Send with</Text>
          <View style={styles.chips}>
            {(['app', 'outlook', 'share'] as EmailMethod[]).map((m) => (
              <Chip
                key={m}
                label={METHOD_LABEL[m]}
                active={(override ?? prefs?.emailMethod) === m}
                onPress={() => setOverride(m)}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.method}>{METHOD_LABEL[method]}</Text>
          <Button title={canAttach || !hasAttach ? 'Send' : 'Continue'} onPress={send} />
        </View>
      </KeyboardAvoidingView>
      <BusyOverlay visible={busy} label="Sending…" />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  body: { padding: 20, gap: 10 },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginTop: 10 },
  readonly: { color: theme.colors.textDim, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    maxWidth: '100%',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: theme.colors.accentText },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: 16,
    padding: 12,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  attach: { color: theme.colors.text, fontSize: 14 },
  warn: { color: theme.colors.accent, fontSize: 12, lineHeight: 17 },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  method: { color: theme.colors.textDim, fontSize: 12, textAlign: 'center' },
});
