export type ScanMode = 'bw' | 'color-doc' | 'color-photo';

export type Orientation = 'portrait' | 'landscape';

export const MODE_LABELS: Record<ScanMode, string> = {
  bw: 'Black & White Document',
  'color-doc': 'Colour Document',
  'color-photo': 'Colour Photo',
};

export const MODE_HINTS: Record<ScanMode, string> = {
  bw: 'High-contrast greyscale. Best for text, forms, receipts.',
  'color-doc': 'Cleaned-up colour. Keeps coloured ink, stamps, highlighter.',
  'color-photo': 'Natural colour. Best for photos and glossy pages.',
};

export interface Page {
  id: string;
  /** Processed JPEG living under the document's folder. */
  uri: string;
  width: number;
  height: number;
  orientation: Orientation;
  mode: ScanMode;
  /** Extra manual rotation the user applied in review, in degrees. */
  rotation: 0 | 90 | 180 | 270;
}

export type DocCategory = 'rtw' | 'meeting' | 'receipt' | 'document';

export interface ScanDoc {
  id: string;
  name: string;
  mode: ScanMode;
  /** What was being scanned; set from the home-screen choice. Older docs lack it. */
  category?: DocCategory;
  createdAt: number;
  updatedAt: number;
  pages: Page[];
}
