import type { DocCategory, Page, ScanDoc, ScanMode } from '../types';
import { uid } from './ids';
import { defaultScanName } from './names';
import { processScan, rotateImage } from './imageProcessing';
import { persistPageImage, pruneOrphanPageFiles, upsertDoc } from './storage';

async function buildPage(docId: string, rawUri: string, mode: ScanMode): Promise<Page> {
  const processed = await processScan(rawUri, mode);
  const pageId = uid('pg-');
  const uri = await persistPageImage(docId, pageId, processed.uri);
  return {
    id: pageId,
    uri,
    width: processed.width,
    height: processed.height,
    orientation: processed.orientation,
    mode,
    rotation: 0,
  };
}

// The scanner (a native full-screen view controller) must be launched with NO
// React Native <Modal> on screen, or iOS refuses the presentation and the
// scanner's completion callback never fires. So callers do:
//   1. await scanDocument()            <- no busy overlay, no mode sheet
//   2. show a busy overlay
//   3. await createDocFromScans(...)   <- CPU work, overlay is fine here
export { scanDocument } from '../../modules/document-scanner';

/** Processes freshly-scanned pages into a brand-new saved document. */
export async function createDocFromScans(
  rawUris: string[],
  mode: ScanMode,
  name?: string,
  category?: DocCategory,
): Promise<ScanDoc> {
  const docId = uid('doc-');
  const pages: Page[] = [];
  for (const raw of rawUris) {
    pages.push(await buildPage(docId, raw, mode));
  }

  const now = Date.now();
  const doc: ScanDoc = {
    id: docId,
    name: name ?? defaultScanName(new Date(now)),
    mode,
    category,
    createdAt: now,
    updatedAt: now,
    pages,
  };
  await upsertDoc(doc);
  return doc;
}

/** Processes freshly-scanned pages and appends them to an existing document. */
export async function appendScans(doc: ScanDoc, rawUris: string[]): Promise<ScanDoc> {
  const pages = [...doc.pages];
  for (const raw of rawUris) {
    pages.push(await buildPage(doc.id, raw, doc.mode));
  }
  const next = { ...doc, pages };
  await upsertDoc(next);
  return next;
}

/** Processes one freshly-scanned page and replaces an existing page in place. */
export async function replacePageWithScan(
  doc: ScanDoc,
  pageId: string,
  rawUri: string,
): Promise<ScanDoc> {
  const replacement = await buildPage(doc.id, rawUri, doc.mode);
  const pages = doc.pages.map((p) => (p.id === pageId ? { ...replacement, id: pageId } : p));
  const next = { ...doc, pages };
  await upsertDoc(next);
  await pruneOrphanPageFiles(next);
  return next;
}

export async function rotatePage(doc: ScanDoc, pageId: string): Promise<ScanDoc> {
  const target = doc.pages.find((p) => p.id === pageId);
  if (!target) return doc;

  const rotated = await rotateImage(target.uri, 90);
  const savedUri = await persistPageImage(doc.id, pageId, rotated.uri);
  const nextRotation = (((target.rotation + 90) % 360) as Page['rotation']);
  const pages = doc.pages.map((p) =>
    p.id === pageId
      ? {
          ...p,
          uri: savedUri,
          width: rotated.width,
          height: rotated.height,
          orientation: rotated.orientation,
          rotation: nextRotation,
        }
      : p,
  );
  const next = { ...doc, pages };
  await upsertDoc(next);
  await pruneOrphanPageFiles(next);
  return next;
}

export async function deletePage(doc: ScanDoc, pageId: string): Promise<ScanDoc> {
  const next = { ...doc, pages: doc.pages.filter((p) => p.id !== pageId) };
  await upsertDoc(next);
  await pruneOrphanPageFiles(next);
  return next;
}

export async function movePage(doc: ScanDoc, pageId: string, dir: -1 | 1): Promise<ScanDoc> {
  const index = doc.pages.findIndex((p) => p.id === pageId);
  const target = index + dir;
  if (index < 0 || target < 0 || target >= doc.pages.length) return doc;

  const pages = [...doc.pages];
  [pages[index], pages[target]] = [pages[target], pages[index]];
  const next = { ...doc, pages };
  await upsertDoc(next);
  return next;
}

export async function renameDoc(doc: ScanDoc, name: string): Promise<ScanDoc> {
  const next = { ...doc, name };
  await upsertDoc(next);
  return next;
}
