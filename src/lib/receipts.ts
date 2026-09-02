import * as FileSystem from 'expo-file-system/legacy';

import { csvDocument } from './csv';
import { sanitizeFilename } from './names';
import { uid } from './ids';

export type ExpenseKind = 'petty' | 'credit';

export interface ExpenseRecord {
  id: string;
  kind: ExpenseKind;
  /** Linked ScanDoc id (for regenerating the PDF). */
  docId: string;
  date: string; // ISO YYYY-MM-DD
  supplier: string;
  purchases: string[];
  total: number;
  vat: number;
  nett: number;
  currency: string;
  createdAt: number;
}

const DIR = `${FileSystem.documentDirectory}scans/`;
const FILE = `${DIR}expenses.json`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export async function listExpenses(): Promise<ExpenseRecord[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const rows = JSON.parse(await FileSystem.readAsStringAsync(FILE)) as ExpenseRecord[];
    return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  } catch {
    return [];
  }
}

async function writeAll(rows: ExpenseRecord[]) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(rows));
}

export async function upsertExpense(record: ExpenseRecord): Promise<void> {
  const rows = (await listExpenses()).filter((r) => r.id !== record.id);
  rows.push(record);
  await writeAll(rows);
}

export async function deleteExpenseForDoc(docId: string): Promise<void> {
  const rows = (await listExpenses()).filter((r) => r.docId !== docId);
  await writeAll(rows);
}

export function newExpenseId() {
  return uid('exp-');
}

/** e.g. "Petty cash - Tesco - 2026-09-02" */
export function expenseDocName(kind: ExpenseKind, supplier: string, date: string): string {
  const label = kind === 'petty' ? 'Petty cash' : 'Credit card';
  const d = date || new Date().toISOString().slice(0, 10);
  return sanitizeFilename(`${label} - ${supplier || 'Unknown'} - ${d}`);
}

/** Distinct YYYY-MM values present in the ledger, newest first. */
export async function expenseMonths(kind?: ExpenseKind): Promise<string[]> {
  const rows = await listExpenses();
  const set = new Set<string>();
  for (const r of rows) {
    if (kind && r.kind !== kind) continue;
    if (/^\d{4}-\d{2}/.test(r.date)) set.add(r.date.slice(0, 7));
  }
  return [...set].sort().reverse();
}

function filterRows(rows: ExpenseRecord[], kind: ExpenseKind, month?: string) {
  return rows.filter((r) => r.kind === kind && (!month || r.date.startsWith(month)));
}

const CSV_HEADER = ['Date', 'Supplier', 'Purchases', 'Total cost', 'VAT paid', 'Nett cost'];

export async function buildExpenseCsv(kind: ExpenseKind, month?: string): Promise<string> {
  const rows = filterRows(await listExpenses(), kind, month).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt,
  );
  const body = csvDocument(
    CSV_HEADER,
    rows.map((r) => [
      r.date,
      r.supplier,
      r.purchases.join(', '),
      r.total.toFixed(2),
      r.vat.toFixed(2),
      r.nett.toFixed(2),
    ]),
  );
  const label = kind === 'petty' ? 'petty-cash' : 'credit-card';
  const name = month ? `${label}-${month}.csv` : `${label}.csv`;
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, body);
  return uri;
}

export async function expensesFor(kind: ExpenseKind, month?: string): Promise<ExpenseRecord[]> {
  return filterRows(await listExpenses(), kind, month);
}
