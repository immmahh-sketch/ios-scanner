import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, BusyOverlay } from '../components/ui';
import { useDocs } from '../state/DocsContext';
import { renameDoc } from '../lib/scanFlow';
import {
  expenseDocName,
  newExpenseId,
  upsertExpense,
  type ExpenseRecord,
} from '../lib/receipts';
import { theme } from '../theme';
import type { ScreenProps } from '../navigation';

export function ReceiptDetailsScreen({ route, navigation }: ScreenProps<'ReceiptDetails'>) {
  const { docId, kind, ai } = route.params;
  const { getDoc, putDoc } = useDocs();
  const doc = getDoc(docId);

  const [supplier, setSupplier] = useState(ai?.supplier ?? '');
  const [date, setDate] = useState(ai?.date ?? new Date().toISOString().slice(0, 10));
  const [purchases, setPurchases] = useState((ai?.purchases ?? []).join('\n'));
  const [total, setTotal] = useState(ai?.total ? String(ai.total) : '');
  const [vat, setVat] = useState(ai?.vat ? String(ai.vat) : '');
  const [busy, setBusy] = useState<string | null>(null);

  const kindLabel = kind === 'petty' ? 'Petty cash' : 'Credit card';
  const nett = useMemo(() => {
    const t = parseFloat(total) || 0;
    const v = parseFloat(vat) || 0;
    return Math.max(0, Math.round((t - v) * 100) / 100);
  }, [total, vat]);

  const save = async () => {
    if (!doc) {
      Alert.alert('Gone', 'This scan is no longer available.');
      navigation.popToTop();
      return;
    }
    const items = purchases
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const record: ExpenseRecord = {
      id: newExpenseId(),
      kind,
      docId,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
      supplier: supplier.trim() || 'Unknown supplier',
      purchases: items,
      total: parseFloat(total) || 0,
      vat: parseFloat(vat) || 0,
      nett,
      currency: ai?.currency ?? 'GBP',
      createdAt: Date.now(),
    };

    setBusy('Saving…');
    try {
      await upsertExpense(record);
      const saved = await renameDoc(doc, expenseDocName(kind, record.supplier, record.date));
      putDoc(saved);
      navigation.popToTop();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>{kindLabel} receipt</Text>
          {!ai ? (
            <Text style={styles.warn}>
              Couldn&apos;t read this receipt automatically — fill in the details below.
            </Text>
          ) : ai.confidence !== 'high' ? (
            <Text style={styles.warn}>Low-confidence read — please check the details.</Text>
          ) : null}

          <Field label="Supplier" value={supplier} onChangeText={setSupplier} placeholder="e.g. Tesco" />
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-09-03" />

          <Text style={styles.label}>Purchases (one per line)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={purchases}
            onChangeText={setPurchases}
            placeholder={'Milk\nBread\nBatteries'}
            placeholderTextColor={theme.colors.textDim}
            multiline
          />

          <View style={styles.money}>
            <View style={styles.flex}>
              <Field label="Total" value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
            <View style={styles.flex}>
              <Field label="VAT" value={vat} onChangeText={setVat} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
          </View>
          <Text style={styles.nett}>Nett: {nett.toFixed(2)}</Text>
        </ScrollView>

        <View style={styles.section}>
          <Button title="Save to expenses" onPress={save} />
        </View>
      </KeyboardAvoidingView>
      <BusyOverlay visible={busy !== null} label={busy ?? undefined} />
    </SafeAreaView>
  );
}

function Field({
  label,
  ...input
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.colors.textDim}
        autoCapitalize="words"
        autoCorrect={false}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  body: { padding: 20, gap: 12 },
  kicker: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warn: { color: theme.colors.accent, fontSize: 13 },
  field: { gap: 6 },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: 16,
    padding: 12,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  money: { flexDirection: 'row', gap: 12 },
  nett: { color: theme.colors.textDim, fontSize: 14, marginTop: 2 },
  section: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
