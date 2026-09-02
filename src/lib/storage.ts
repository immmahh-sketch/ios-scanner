import * as FileSystem from 'expo-file-system/legacy';

import type { Page, ScanDoc } from '../types';

const ROOT = `${FileSystem.documentDirectory}scans/`;
const INDEX = `${ROOT}index.json`;

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

function pagesDir(docId: string) {
  return `${ROOT}${docId}/pages/`;
}

export async function listDocs(): Promise<ScanDoc[]> {
  await ensureDir(ROOT);
  const info = await FileSystem.getInfoAsync(INDEX);
  if (!info.exists) return [];
  try {
    const raw = await FileSystem.readAsStringAsync(INDEX);
    const docs = JSON.parse(raw) as ScanDoc[];
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function writeIndex(docs: ScanDoc[]) {
  await ensureDir(ROOT);
  await FileSystem.writeAsStringAsync(INDEX, JSON.stringify(docs));
}

export async function upsertDoc(doc: ScanDoc): Promise<void> {
  const docs = await listDocs();
  const next = docs.filter((d) => d.id !== doc.id);
  next.push({ ...doc, updatedAt: Date.now() });
  await writeIndex(next);
}

export async function deleteDoc(id: string): Promise<void> {
  const docs = await listDocs();
  await writeIndex(docs.filter((d) => d.id !== id));
  const dir = `${ROOT}${id}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
}

export async function getDoc(id: string): Promise<ScanDoc | undefined> {
  const docs = await listDocs();
  return docs.find((d) => d.id === id);
}

/**
 * Copies a processed page image into the document's permanent folder and
 * returns the new file URI. Used when a page is first added or retaken.
 */
export async function persistPageImage(
  docId: string,
  pageId: string,
  sourceUri: string,
): Promise<string> {
  const dir = pagesDir(docId);
  await ensureDir(dir);
  const dest = `${dir}${pageId}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

/** Removes the image files for pages that are no longer part of the document. */
export async function pruneOrphanPageFiles(doc: ScanDoc): Promise<void> {
  const dir = pagesDir(doc.id);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return;
  const keep = new Set(doc.pages.map((p: Page) => p.uri));
  const files = await FileSystem.readDirectoryAsync(dir);
  await Promise.all(
    files
      .map((name) => `${dir}${name}`)
      .filter((uri) => !keep.has(uri))
      .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })),
  );
}
