import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';

const PDF_UTI = 'com.adobe.pdf';
const PDF_MIME = 'application/pdf';

const TYPE_BY_EXT: Record<string, { uti: string; mime: string }> = {
  pdf: { uti: 'com.adobe.pdf', mime: 'application/pdf' },
  csv: { uti: 'public.comma-separated-values-text', mime: 'text/csv' },
  zip: { uti: 'public.zip-archive', mime: 'application/zip' },
};

/** Opens the iOS share sheet for any file; picks the right UTI from its extension. */
export async function shareFile(uri: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const t = TYPE_BY_EXT[ext] ?? { uti: 'public.data', mime: 'application/octet-stream' };
  await Sharing.shareAsync(uri, { UTI: t.uti, mimeType: t.mime, dialogTitle });
}


/**
 * Opens the iOS share sheet. "Save to Files" is always one of the targets, so
 * this doubles as the Files export.
 */
export async function sharePdf(pdfUri: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(pdfUri, {
    UTI: PDF_UTI,
    mimeType: PDF_MIME,
    dialogTitle,
  });
}

export async function isWhatsAppInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('whatsapp://send');
  } catch {
    return false;
  }
}

/**
 * iOS has no public URL scheme to hand a file straight to WhatsApp, so we open
 * the share sheet (WhatsApp appears as a target when it is installed). We check
 * installation first so the button can be disabled with a clear message.
 */
export async function shareToWhatsApp(pdfUri: string): Promise<void> {
  if (!(await isWhatsAppInstalled())) {
    throw new Error('WhatsApp does not appear to be installed on this device.');
  }
  await sharePdf(pdfUri, 'Share to WhatsApp');
}
