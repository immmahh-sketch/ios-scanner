import type { ScanMode } from '../types';

export interface ScanPreset {
  id: string;
  title: string;
  subtitle: string;
  mode: ScanMode;
  /** File-name prefix; a zero-padded auto-incrementing number is appended. */
  namePrefix: string;
}

export const PRESETS: ScanPreset[] = [
  {
    id: 'passport',
    title: 'Scan a passport',
    subtitle: 'Colour document',
    mode: 'color-doc',
    namePrefix: 'Passport scan',
  },
  {
    id: 'invoice',
    title: 'Scan an invoice / receipt',
    subtitle: 'Black & white document',
    mode: 'bw',
    namePrefix: 'Invoice scan',
  },
  {
    id: 'document',
    title: 'Scan a document',
    subtitle: 'Black & white document',
    mode: 'bw',
    namePrefix: 'Document scan',
  },
  {
    id: 'photo',
    title: 'Scan a photo',
    subtitle: 'Colour photo',
    mode: 'color-photo',
    namePrefix: 'Photo scan',
  },
  {
    id: 'other',
    title: 'Scan something else',
    subtitle: 'Black & white document',
    mode: 'bw',
    namePrefix: 'Scan',
  },
];

/** e.g. ("Passport scan", 1) -> "Passport scan 0001" */
export function presetName(namePrefix: string, count: number): string {
  return `${namePrefix} ${String(count).padStart(4, '0')}`;
}
