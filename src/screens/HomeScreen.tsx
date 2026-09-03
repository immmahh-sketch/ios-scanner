import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { BusyOverlay } from '../components/ui';
import { useDocs } from '../state/DocsContext';
import { createDocFromScans, scanDocument } from '../lib/scanFlow';
import { nextCount } from '../lib/counters';
import { pad4 } from '../lib/names';
import { expenseDocName, type ExpenseKind } from '../lib/receipts';
import { analyzeMeetingNotes, analyzeReceipt, analyzeRightToWork } from '../lib/ai';
import { applyOta, checkForOta, lastUpdateLabel, runtimeVersion } from '../lib/updates';
import { isScannerAvailable } from '../../modules/document-scanner';
import { theme } from '../theme';
import { MODE_LABELS } from '../types';
import type { ScanDoc } from '../types';
import type { ScreenProps } from '../navigation';

type Step = 'root' | 'document' | 'receipt';

type ScanConfig =
  | { kind: 'rtw' }
  | { kind: 'meeting' }
  | { kind: 'other' }
  | { kind: 'receipt'; receiptKind: ExpenseKind };

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const { docs, loading, refresh, putDoc, removeDoc } = useDocs();
  const [step, setStep] = useState<Step>('root');
  const [busy, setBusy] = useState<string | null>(null);
  const [otaReady, setOtaReady] = useState(false);

  useEffect(() => {
    checkForOta().then(setOtaReady).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setStep('root');
    }, [refresh]),
  );

  const runScan = useCallback(
    async (cfg: ScanConfig) => {
      if (!isScannerAvailable()) {
        Alert.alert('Not supported', 'Document scanning needs a real device with a camera.');
        return;
      }
      // Scanner opens on a clean screen (no overlay / no modal).
      let rawUris: string[];
      try {
        rawUris = await scanDocument();
      } catch (err) {
        Alert.alert('Scan failed', err instanceof Error ? err.message : String(err));
        return;
      }
      if (rawUris.length === 0) return;

      const first = rawUris[0];
      try {
        if (cfg.kind === 'rtw') {
          setBusy('Reading ID…');
          const ai = await analyzeRightToWork(first);
          const name = ai?.personName ? `RTW ${ai.personName}` : `RTW ${pad4(await nextCount('RTW'))}`;
          setBusy('Processing pages…');
          const doc = await createDocFromScans(rawUris, 'color-doc', name, 'rtw');
          putDoc(doc);
          navigation.navigate('Review', { docId: doc.id });
        } else if (cfg.kind === 'meeting') {
          setBusy('Reading meeting notes…');
          const ai = await analyzeMeetingNotes(first);
          const name = ai
            ? ai.personName
              ? `${ai.meetingType} ${ai.personName}`
              : ai.meetingType
            : `Meeting notes ${pad4(await nextCount('Meeting notes'))}`;
          setBusy('Processing pages…');
          const doc = await createDocFromScans(rawUris, 'bw', name, 'meeting');
          putDoc(doc);
          navigation.navigate('Review', { docId: doc.id });
        } else if (cfg.kind === 'other') {
          setBusy('Processing pages…');
          const name = `Scan ${pad4(await nextCount('Scan'))}`;
          const doc = await createDocFromScans(rawUris, 'bw', name, 'document');
          putDoc(doc);
          navigation.navigate('Review', { docId: doc.id });
        } else {
          setBusy('Reading receipt…');
          const ai = await analyzeReceipt(first);
          const name = expenseDocName(cfg.receiptKind, ai?.supplier ?? '', ai?.date ?? '');
          setBusy('Processing pages…');
          const doc = await createDocFromScans(rawUris, 'bw', name, 'receipt');
          putDoc(doc);
          navigation.navigate('ReceiptDetails', { docId: doc.id, kind: cfg.receiptKind, ai });
        }
      } catch (err) {
        Alert.alert('Scan failed', err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
        setStep('root');
      }
    },
    [navigation, putDoc],
  );

  const renderRecent = ({ item }: { item: ScanDoc }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => navigation.navigate('Review', { docId: item.id })}
      onLongPress={() =>
        Alert.alert('Delete scan?', `“${item.name}” will be removed.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void removeDoc(item.id) },
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
          {MODE_LABELS[item.mode]} · {item.pages.length} page{item.pages.length === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  const header = (
    <View style={styles.choiceBlock}>
      {step === 'root' ? (
        <>
          <Text style={styles.sectionTitle}>New scan</Text>
          <Choice title="Scan a document" subtitle="ID checks, meeting notes, anything on paper" onPress={() => setStep('document')} />
          <Choice title="Scan a receipt" subtitle="Petty cash or credit card — auto-logged to a CSV" onPress={() => setStep('receipt')} />
          <View style={styles.utilRow}>
            <SmallButton label="⤓  Downloads" onPress={() => navigation.navigate('Downloads')} />
            <SmallButton label="⚙  Settings" onPress={() => navigation.navigate('Settings')} />
          </View>
          {docs.length > 0 ? <Text style={styles.sectionTitle}>Recent</Text> : null}
        </>
      ) : step === 'document' ? (
        <>
          <BackRow label="Document" onBack={() => setStep('root')} />
          <Choice title="Right to work" subtitle="Colour · names the file “RTW <name>”" onPress={() => runScan({ kind: 'rtw' })} />
          <Choice title="Meeting notes" subtitle="B&W · reads the meeting type + employee name" onPress={() => runScan({ kind: 'meeting' })} />
          <Choice title="Other document" subtitle="B&W · “Scan 0001”" onPress={() => runScan({ kind: 'other' })} />
        </>
      ) : (
        <>
          <BackRow label="Receipt" onBack={() => setStep('root')} />
          <Choice title="Petty cash" subtitle="B&W · logs to the petty-cash CSV" onPress={() => runScan({ kind: 'receipt', receiptKind: 'petty' })} />
          <Choice title="Credit card" subtitle="B&W · logs to the credit-card CSV" onPress={() => runScan({ kind: 'receipt', receiptKind: 'credit' })} />
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Scanner</Text>
        <Text style={styles.version}>
          v{runtimeVersion}
          {'\n'}
          <Text style={styles.versionDim}>updated {lastUpdateLabel()}</Text>
        </Text>
      </View>

      {otaReady ? (
        <Pressable style={styles.otaBanner} onPress={applyOta}>
          <Text style={styles.otaText}>Update downloaded — tap to restart and apply</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={step === 'root' ? docs : []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          step === 'root' && !loading ? (
            <Text style={styles.empty}>Your scans will appear here.</Text>
          ) : null
        }
        renderItem={renderRecent}
      />

      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

function Choice({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.choice, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.rowBody}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <Pressable style={styles.backRow} onPress={onBack}>
      <Text style={styles.backChevron}>‹</Text>
      <Text style={styles.sectionTitle}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '800' },
  version: { color: theme.colors.textDim, fontSize: 12, textAlign: 'right', lineHeight: 16 },
  versionDim: { color: theme.colors.border, fontSize: 11 },
  otaBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    padding: 12,
  },
  otaText: { color: theme.colors.accent, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  choiceBlock: { gap: 10, marginBottom: 4 },
  sectionTitle: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  choiceTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  utilRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  smallBtn: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  smallBtnText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  backChevron: { color: theme.colors.accent, fontSize: 26, marginTop: -2 },
  empty: { color: theme.colors.textDim, textAlign: 'center', marginTop: 24, fontSize: 14 },
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
  pressed: { opacity: 0.7 },
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
});
