import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { buildPdf } from '../lib/pdf';
import { getDoc } from '../lib/storage';
import { buildZip, type ZipEntry } from '../lib/zip';
import { sanitizeFilename } from '../lib/names';
import {
  buildExpenseCsv,
  expenseMonths,
  expensesFor,
  type ExpenseKind,
} from '../lib/receipts';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const name = new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return name;
}

export function DownloadsScreen({ navigation }: ScreenProps<'Downloads'>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null); // null = all

  useEffect(() => {
    expenseMonths().then(setMonths);
  }, []);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const period = month ? monthLabel(month) : 'all time';

  const emailCsv = (kind: ExpenseKind) =>
    run('Building CSV…', async () => {
      const uri = await buildExpenseCsv(kind, month ?? undefined);
      const label = kind === 'petty' ? 'Petty cash' : 'Credit card';
      navigation.navigate('SendEmail', {
        subject: `${label} — ${period}`,
        body: `${label} spreadsheet for ${period}.`,
        attachments: [{ filename: uri.split('/').pop() ?? `${label}.csv`, uri }],
      });
    });

  const downloadAll = () =>
    run('Packaging receipts…', async () => {
      const scope = month ?? undefined;
      const [petty, credit] = await Promise.all([
        expensesFor('petty', scope),
        expensesFor('credit', scope),
      ]);
      const records = [...petty, ...credit];
      if (records.length === 0) {
        Alert.alert('Nothing to export', 'No receipts for the selected period.');
        return;
      }

      const entries: ZipEntry[] = [];
      if (petty.length) {
        entries.push({ name: 'petty-cash.csv', text: await readText(await buildExpenseCsv('petty', scope)) });
      }
      if (credit.length) {
        entries.push({ name: 'credit-card.csv', text: await readText(await buildExpenseCsv('credit', scope)) });
      }

      const usedNames = new Set<string>();
      for (const rec of records) {
        const scanDoc = await getDoc(rec.docId);
        if (!scanDoc || scanDoc.pages.length === 0) continue;
        const pdfUri = await buildPdf(scanDoc);
        let base = sanitizeFilename(scanDoc.name);
        let name = `${base}.pdf`;
        let n = 2;
        while (usedNames.has(name)) name = `${base} (${n++}).pdf`;
        usedNames.add(name);
        entries.push({ name: `receipts/${name}`, uri: pdfUri });
      }

      const zipName = `receipts-${month ?? 'all'}.zip`;
      const zipUri = await buildZip(zipName, entries);

      const label =
        petty.length && credit.length
          ? 'Receipts'
          : petty.length
            ? 'Petty cash'
            : 'Credit card';
      navigation.navigate('SendEmail', {
        subject: `${label} — ${period}`,
        body: `Attached: ${records.length} receipt${records.length === 1 ? '' : 's'} for ${period}, with the CSV${petty.length && credit.length ? 's' : ''}.`,
        attachments: [{ filename: zipName, uri: zipUri }],
      });
    });

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionTitle}>Period</Text>
        <View style={styles.chips}>
          <Chip label="All time" active={month === null} onPress={() => setMonth(null)} />
          {months.map((m) => (
            <Chip key={m} label={monthLabel(m)} active={month === m} onPress={() => setMonth(m)} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Spreadsheets — {period}</Text>
        <Button title="Petty cash CSV" icon="📄" kind="secondary" onPress={() => emailCsv('petty')} />
        <Button title="Credit card CSV" icon="📄" kind="secondary" onPress={() => emailCsv('credit')} />
        <Text style={styles.hint}>
          Columns: Date, Supplier, Purchases, Total cost, VAT paid, Nett cost. Opens the Send
          screen — email it, or choose “Share sheet” in Settings to just save it.
        </Text>

        <Text style={styles.sectionTitle}>Everything — {period}</Text>
        <Button title="All receipts (zip)" icon="🗂️" onPress={downloadAll} />
        <Text style={styles.hint}>
          A .zip of the period&apos;s receipt PDFs plus the CSVs, ready to send.
        </Text>

        <Text style={styles.sectionTitle}>Right to Work</Text>
        <Button
          title="Choose RTW documents"
          icon="🪪"
          kind="secondary"
          onPress={() => navigation.navigate('RtwDownload')}
        />
        <Text style={styles.hint}>
          Pick RTW scans by employee name, then email / zip / share (period filter doesn&apos;t
          apply here).
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Done" kind="secondary" onPress={() => navigation.goBack()} />
      </View>
      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

async function readText(uri: string): Promise<string> {
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(uri);
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { padding: 20, gap: 10 },
  sectionTitle: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
  },
  hint: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: theme.colors.accentText },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
