import { PDFDocument } from 'pdf-lib';
import { decode as b64ToBytes, encode as bytesToB64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import type { ScanDoc } from '../types';
import { sanitizeFilename } from './names';

/**
 * Builds a multi-page PDF from a document's pages. Each PDF page is sized to its
 * image so portrait and landscape pages keep their true orientation. Returns a
 * `file://` URI in the cache directory.
 */
export async function buildPdf(doc: ScanDoc): Promise<string> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.name);
  pdf.setCreator('Scanner');

  for (const page of doc.pages) {
    const b64 = await FileSystem.readAsStringAsync(page.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = new Uint8Array(b64ToBytes(b64));

    // Processed pages are always JPEG (see imageProcessing / persistPageImage).
    const img = await pdf.embedJpg(bytes);
    const pdfPage = pdf.addPage([img.width, img.height]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }

  const outBytes = await pdf.save();
  const buffer = outBytes.buffer.slice(
    outBytes.byteOffset,
    outBytes.byteOffset + outBytes.byteLength,
  ) as ArrayBuffer;
  const outUri = `${FileSystem.cacheDirectory}${sanitizeFilename(doc.name)}.pdf`;
  await FileSystem.writeAsStringAsync(outUri, bytesToB64(buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outUri;
}
