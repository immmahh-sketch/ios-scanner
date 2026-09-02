import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { processImage as nativeProcessImage } from '../../modules/document-scanner';
import type { Orientation, ScanMode } from '../types';

// Longest edge we keep. VisionKit hands back ~3000-4000px images; 2600 keeps
// text crisp while keeping PDFs a sane size. The native side does the downscale.
const MAX_EDGE = 2600;

export interface ProcessedImage {
  uri: string;
  width: number;
  height: number;
  orientation: Orientation;
}

function orientationOf(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Applies the selected colour mode to a raw scanned page (Core Image, native)
 * and returns the processed file plus its dimensions and detected orientation.
 */
export async function processScan(rawUri: string, mode: ScanMode): Promise<ProcessedImage> {
  const result = await nativeProcessImage(rawUri, mode, MAX_EDGE);
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    orientation: orientationOf(result.width, result.height),
  };
}

/** Rotates an already-processed page by a clockwise multiple of 90 degrees. */
export async function rotateImage(uri: string, degrees: number): Promise<ProcessedImage> {
  const result = await manipulateAsync(uri, [{ rotate: degrees }], {
    compress: 0.92,
    format: SaveFormat.JPEG,
  });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    orientation: orientationOf(result.width, result.height),
  };
}
