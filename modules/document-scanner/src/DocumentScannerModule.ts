import { NativeModule, requireNativeModule } from 'expo';

declare class DocumentScannerModule extends NativeModule {
  /** True when the device supports VisionKit document scanning. */
  isAvailable(): boolean;
  /**
   * Presents the VisionKit scanner. Resolves with an array of `file://` JPEG
   * URLs (one per captured page), or an empty array if the user cancelled.
   */
  scan(): Promise<string[]>;
}

export default requireNativeModule<DocumentScannerModule>('DocumentScanner');
