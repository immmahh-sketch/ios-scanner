import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { listByCategory } from '../lib/storage';
import { buildPdf } from '../lib/pdf';
import { bundleDocsZip } from '../lib/bundle';
import { sanitizeFilename } from '../lib/names';
import { theme } from '../theme';
import type { ScanDoc } from '../types';
import type { ScreenProps } from '../navigation';

function employeeName(doc: ScanDoc): string {
  return doc.name.replace(/^RTW\s+/i, '').trim() || doc.name;
}

export function RtwDownloadScreen({ navigation }: ScreenProps<'RtwDownload'>) {
  const [docs, setDocs] = useState<ScanDoc[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listByCategory('rtw', 'RTW ').then((list) => {
      setDocs(list);
      setSelected(new Set(list.map((d) => d.id))); // start with all selected
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectedDocs = useMemo(
    () => (docs ?? []).filter((d) => selected.has(d.id)),
    [docs, selected],
  );

  const send = async () => {
    if (selectedDocs.length === 0) return;
    setBusy('Preparing…');
    try {
      if (selectedDocs.length === 1) {
        const doc = selectedDocs[0];
        const uri = await buildPdf(doc);
        navigation.navigate('SendEmail', {
          subject: doc.name,
          body: `Right to Work document: ${employeeName(doc)}.`,
          attachments: [{ filename: `${sanitizeFilename(doc.name)}.pdf`, uri }],
        });
      } else {
        const zipUri = await bundleDocsZip(selectedDocs, 'RTW-documents.zip');
        navigation.navigate('SendEmail', {
          subject: `RTW documents (${selectedDocs.length})`,
          body: `${selectedDocs.length} Right to Work documents:\n${selectedDocs
            .map((d) => `• ${employeeName(d)}`)
            .join('\n')}`,
          attachments: [{ filename: 'RTW-documents.zip', uri: zipUri }],
        });
      }
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const allSelected = docs !== null && selected.size === docs.length && docs.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {docs !== null && docs.length > 0 ? (
        <View style={styles.toolbar}>
          <Text style={styles.count}>{selected.size} of {docs.length} selected</Text>
          <Pressable
            onPress={() => setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.id)))}
          >
            <Text style={styles.selectAll}>{allSelected ? 'Clear' : 'Select all'}</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={docs ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          docs === null ? null : (
            <Text style={styles.empty}>
              No Right to Work scans yet. Home → Scan a document → Right to work.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const on = selected.has(item.id);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
              onPress={() => toggle(item.id)}
            >
              <Text style={[styles.check, on && styles.checkOn]}>{on ? '☑' : '☐'}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {employeeName(item)}
                </Text>
                <Text style={styles.sub}>
                  {new Date(item.createdAt).toLocaleDateString()} · {item.pages.length} page
                  {item.pages.length === 1 ? '' : 's'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Button
          title={
            selectedDocs.length === 1
              ? 'Send 1 document'
              : `Send ${selectedDocs.length} documents (zip)`
          }
          onPress={send}
          disabled={selectedDocs.length === 0}
        />
      </View>
      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  count: { color: theme.colors.textDim, fontSize: 13 },
  selectAll: { color: theme.colors.accent, fontSize: 14, fontWeight: '600' },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { color: theme.colors.textDim, textAlign: 'center', marginTop: 60, fontSize: 15, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 14,
  },
  rowOn: { borderColor: theme.colors.accent },
  pressed: { opacity: 0.7 },
  check: { color: theme.colors.textDim, fontSize: 20 },
  checkOn: { color: theme.colors.accent },
  rowBody: { flex: 1, gap: 2 },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: theme.colors.textDim, fontSize: 13 },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
