// A captured page is returned as a file:// URL string pointing at a JPEG.
export type ScannedPageUri = string;

export interface ProcessedImage {
  /** file:// URI of the processed JPEG in the temp directory. */
  uri: string;
  width: number;
  height: number;
}
