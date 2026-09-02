import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';

const PDF_UTI = 'com.adobe.pdf';
const PDF_MIME = 'application/pdf';

export async function emailPdf(pdfUri: string, name: string): Promise<void> {
  const available = await MailComposer.isAvailableAsync();
  if (!available) {
    throw new Error('No email account is set up on this device. Add one in Settings → Mail.');
  }
  await MailComposer.composeAsync({
    subject: name,
    body: `Scanned document: ${name}`,
    attachments: [pdfUri],
  });
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
