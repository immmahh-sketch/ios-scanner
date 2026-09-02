import DocumentScannerModule from './src/DocumentScannerModule';

export type { ScannedPageUri } from './src/DocumentScanner.types';

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

export default { isScannerAvailable, scanDocument };
