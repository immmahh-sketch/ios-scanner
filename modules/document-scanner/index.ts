import DocumentScannerModule from './src/DocumentScannerModule';

export type { ScannedPageUri, ProcessedImage } from './src/DocumentScanner.types';

/**
 * Returns true when the current device supports VisionKit document scanning.
 * (All modern iPhones do; the iOS Simulator does not.)
 */
export function isScannerAvailable(): boolean {
  try {
    return DocumentScannerModule.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Launches the native VisionKit document scanner. The user can capture as many
 * pages as they like (auto-shutter fires when each page is framed and steady),
 * then taps "Save". Resolves with one `file://` JPEG URL per page, or an empty
 * array if the user cancelled.
 */
export async function scanDocument(): Promise<string[]> {
  return DocumentScannerModule.scan();
}

/**
 * Applies one of the three colour looks to a scanned page and downscales it.
 * `mode` is "bw" | "color-doc" | "color-photo"; `maxEdge` caps the longest side.
 */
export async function processImage(uri: string, mode: string, maxEdge = 2600) {
  return DocumentScannerModule.processImage(uri, mode, maxEdge);
}

export default { isScannerAvailable, scanDocument, processImage };
