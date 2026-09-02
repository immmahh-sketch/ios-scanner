import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { useDocs } from '../state/DocsContext';
import { renameDoc } from '../lib/scanFlow';
import { buildPdf } from '../lib/pdf';
import { emailPdf, isWhatsAppInstalled, sharePdf, shareToWhatsApp } from '../lib/export';
import { sanitizeFilename } from '../lib/names';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

export function ExportScreen({ route, navigation }: ScreenProps<'Export'>) {
  const { docId } = route.params;
  const { getDoc, putDoc } = useDocs();
  const doc = getDoc(docId);

  const [name, setName] = useState(doc?.name ?? 'Scan');
  const [busy, setBusy] = useState<string | null>(null);
  const [whatsApp, setWhatsApp] = useState(false);

  // Cache the built PDF; invalidate when the name or page set changes.
  const pdfRef = useRef<{ uri: string; signature: string } | null>(null);

  useEffect(() => {
    isWhatsAppInstalled().then(setWhatsApp).catch(() => setWhatsApp(false));
  }, []);

  const ensurePdf = useCallback(async (): Promise<string> => {
    if (!doc) throw new Error('This scan is no longer available.');
    const clean = sanitizeFilename(name);
    const signature = `${clean}|${doc.pages.map((p) => `${p.uri}:${p.rotation}`).join(',')}`;
    if (pdfRef.current?.signature === signature) return pdfRef.current.uri;

    const saved = await renameDoc(doc, clean);
    putDoc(saved);
    const uri = await buildPdf(saved);
    pdfRef.current = { uri, signature };
    return uri;
  }, [doc, name, putDoc]);

  const withPdf = useCallback(
    async (label: string, action: (uri: string) => Promise<void>) => {
      // Build the PDF under the busy overlay...
      let uri: string;
      try {
        setBusy(label);
        uri = await ensurePdf();
      } catch (err) {
        Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
        return;
      } finally {
        setBusy(null);
      }
      // ...then run the action (mail / share sheet) with NO overlay up, so the
      // native sheet presents on a clean screen.
      try {
        await action(uri);
      } catch (err) {
        Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
      }
    },
    [ensurePdf],
  );

  if (!doc) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>This scan is no longer available.</Text>
        <View style={styles.section}>
          <Button title="Back to start" kind="secondary" onPress={() => navigation.popToTop()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>File name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Scan"
              placeholderTextColor={theme.colors.textDim}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.ext}>.pdf</Text>
          </View>
          <Text style={styles.hint}>
            {doc.pages.length} page{doc.pages.length === 1 ? '' : 's'} · saved to the app’s document
            library
          </Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Send / save</Text>
          <View style={styles.actions}>
            <Button
              title="Email"
              icon="✉"
              onPress={() =>
                withPdf('Preparing PDF…', (uri) => emailPdf(uri, sanitizeFilename(name)))
              }
            />
            <Button
              title="Save to Files"
              icon="📁"
              kind="secondary"
              onPress={() => withPdf('Preparing PDF…', (uri) => sharePdf(uri, 'Save to Files'))}
            />
            <Button
              title={whatsApp ? 'Share via WhatsApp' : 'WhatsApp not installed'}
              icon="🟢"
              kind="secondary"
              disabled={!whatsApp}
              onPress={() => withPdf('Preparing PDF…', (uri) => shareToWhatsApp(uri))}
            />
            <Button
              title="Other / Share sheet"
              icon="↗"
              kind="ghost"
              onPress={() => withPdf('Preparing PDF…', (uri) => sharePdf(uri, 'Share'))}
            />
          </View>

          <Text style={styles.note}>
            WhatsApp opens the iOS share sheet with the PDF attached — pick WhatsApp, then the chat.
            iOS has no way to jump straight into a chat with a file.
          </Text>
        </ScrollView>

        <View style={styles.section}>
          <Button title="Done" kind="secondary" onPress={() => navigation.popToTop()} />
        </View>
      </KeyboardAvoidingView>

      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  body: { padding: 20, gap: 10 },
  missing: { color: theme.colors.textDim, textAlign: 'center', marginTop: 80, fontSize: 15 },
  label: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginTop: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: theme.colors.text, fontSize: 17, paddingVertical: 14 },
  ext: { color: theme.colors.textDim, fontSize: 15 },
  hint: { color: theme.colors.textDim, fontSize: 12 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },
  actions: { gap: 10 },
  note: { color: theme.colors.textDim, fontSize: 12, marginTop: 16, lineHeight: 17 },
  section: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
