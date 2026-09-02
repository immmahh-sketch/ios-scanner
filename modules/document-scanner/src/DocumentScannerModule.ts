import { NativeModule, requireNativeModule } from 'expo';

import type { ProcessedImage } from './DocumentScanner.types';

declare class DocumentScannerModule extends NativeModule {
  /** True when the device supports VisionKit document scanning. */
  isAvailable(): boolean;
  /**
   * Presents the VisionKit scanner. Resolves with an array of `file://` JPEG
   * URLs (one per captured page), or an empty array if the user cancelled.
   */
  scan(): Promise<string[]>;
  /**
   * Applies a colour look ("bw" | "color-doc" | "color-photo") with Core Image,
   * downscaling so the longest side is at most `maxEdge` px (0 = no cap).
   * Resolves with the new JPEG's `file://` URI and pixel dimensions.
   */
  processImage(uri: string, mode: string, maxEdge: number): Promise<ProcessedImage>;
}

// requireNativeModule throws if the native side is missing; never let that
// take down app startup — a stub that rejects on use is recoverable.
let nativeModule: DocumentScannerModule;
try {
  nativeModule = requireNativeModule<DocumentScannerModule>('DocumentScanner');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  nativeModule = {
    isAvailable: () => false,
    scan: () => Promise.reject(new Error(`DocumentScanner native module unavailable: ${message}`)),
    processImage: () =>
      Promise.reject(new Error(`DocumentScanner native module unavailable: ${message}`)),
  } as unknown as DocumentScannerModule;
}

export default nativeModule;
