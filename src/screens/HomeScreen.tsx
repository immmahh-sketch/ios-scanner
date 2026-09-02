import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Button, BusyOverlay } from '../components/ui';
import { ModeSheet } from '../components/ModeSheet';
import { useDocs } from '../state/DocsContext';
import { runNewScan } from '../lib/scanFlow';
import { applyOta, checkForOta, runtimeVersion } from '../lib/updates';
import { isScannerAvailable } from '../../modules/document-scanner';
import { theme } from '../theme';
import { MODE_LABELS, type ScanMode } from '../types';
import type { ScreenProps } from '../navigation';

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const { docs, loading, refresh, putDoc, removeDoc } = useDocs();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [otaReady, setOtaReady] = useState(false);

  useEffect(() => {
    checkForOta().then(setOtaReady).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const startScan = useCallback(
    async (mode: ScanMode) => {
      setSheetOpen(false);
      if (!isScannerAvailable()) {
        Alert.alert('Not supported', 'Document scanning needs a real device with a camera.');
        return;
      }
      try {
        setBusy('Processing pages…');
        const doc = await runNewScan(mode);
        if (doc) {
          putDoc(doc);
          navigation.navigate('Review', { docId: doc.id });
        }
      } catch (err) {
        Alert.alert('Scan failed', err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [navigation, putDoc],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.version}>v{runtimeVersion}</Text>
      </View>

      {otaReady ? (
        <Pressable style={styles.otaBanner} onPress={applyOta}>
          <Text style={styles.otaText}>Update downloaded — tap to restart and apply</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.empty}>No scans yet. Tap “New Scan” to start.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate('Review', { docId: item.id })}
            onLongPress={() =>
              Alert.alert('Delete scan?', `“${item.name}” will be removed.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    void removeDoc(item.id);
                  },
                },
              ])
            }
          >
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>{item.pages.length}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowSub}>
                {MODE_LABELS[item.mode]} · {item.pages.length} page
                {item.pages.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <Button title="New Scan" icon="＋" onPress={() => setSheetOpen(true)} />
      </View>

      <ModeSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onPick={startScan} />
      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800' },
  version: { color: theme.colors.textDim, fontSize: 13 },
  otaBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: 12,
  },
  otaText: { color: theme.colors.accent, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  empty: { color: theme.colors.textDim, textAlign: 'center', marginTop: 60, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    padding: 14,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { color: theme.colors.text, fontWeight: '700', fontSize: 16 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: theme.colors.textDim, fontSize: 13 },
  chevron: { color: theme.colors.textDim, fontSize: 24 },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
