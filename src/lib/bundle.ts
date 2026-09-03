import { buildPdf } from './pdf';
import { buildZip, type ZipEntry } from './zip';
import { sanitizeFilename } from './names';
import type { ScanDoc } from '../types';

/** Builds a PDF per document and zips them together. Returns the zip's file uri. */
export async function bundleDocsZip(docs: ScanDoc[], zipName: string): Promise<string> {
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  for (const doc of docs) {
    if (doc.pages.length === 0) continue;
    const uri = await buildPdf(doc);
    const base = sanitizeFilename(doc.name);
    let name = `${base}.pdf`;
    let n = 2;
    while (used.has(name)) name = `${base} (${n++}).pdf`;
    used.add(name);
    entries.push({ name, uri });
  }

  return buildZip(zipName, entries);
}
