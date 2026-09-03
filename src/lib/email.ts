import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';

import { getPrefs, getResendKey } from './settings';
import { shareFile } from './export';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface EmailAttachment {
  filename: string;
  uri: string;
}

export interface OutgoingEmail {
  to: string; // single address, or '' for none
  subject: string;
  body: string;
  attachments: EmailAttachment[];
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  zip: 'application/zip',
};

function mimeFor(name: string): string {
  return MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/** Sends immediately through the user's Resend account (attachments included). */
export async function sendViaResend(email: OutgoingEmail): Promise<void> {
  const key = await getResendKey();
  if (!key) throw new Error('No Resend API key saved (Settings → Email).');
  const prefs = await getPrefs();
  if (!email.to.trim()) throw new Error('Pick a recipient first.');

  const from = prefs.fromName.trim()
    ? `${prefs.fromName.trim()} <${prefs.fromEmail.trim()}>`
    : prefs.fromEmail.trim();

  const attachments = [];
  for (const att of email.attachments) {
    const content = await FileSystem.readAsStringAsync(att.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    attachments.push({ filename: att.filename, content, content_type: mimeFor(att.filename) });
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from,
      to: [email.to.trim()],
      subject: email.subject,
      text: email.body,
      attachments: attachments.length ? attachments : undefined,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let msg = `Resend ${res.status}`;
    try {
      const j = JSON.parse(detail) as { message?: string; name?: string };
      if (j.message) msg = j.message;
    } catch {
      if (detail) msg = detail.slice(0, 200);
    }
    throw new Error(msg);
  }
}

function queryString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

/** Opens the Outlook app pre-filled (no attachment support in the URL scheme). */
export async function openOutlookCompose(email: OutgoingEmail): Promise<void> {
  const prefs = await getPrefs();
  const query = queryString({
    to: email.to.trim(),
    from: prefs.fromEmail.trim(),
    subject: email.subject,
    body: email.body,
  });

  try {
    await Linking.openURL(`ms-outlook://compose?${query}`);
  } catch {
    // Outlook not installed → hand off to the default mail app.
    await Linking.openURL(`mailto:${encodeURIComponent(email.to.trim())}?${query}`);
  }
}

/** iOS share sheet — the only way to get a file into Outlook on iOS. */
export async function shareAttachmentsForEmail(email: OutgoingEmail): Promise<void> {
  if (email.attachments.length === 0) {
    await openOutlookCompose(email);
    return;
  }
  await shareFile(email.attachments[0].uri, email.subject || 'Share');
}

export async function sendEmail(method: 'resend' | 'outlook' | 'share', email: OutgoingEmail) {
  if (method === 'resend') return sendViaResend(email);
  if (method === 'outlook') return openOutlookCompose(email);
  return shareAttachmentsForEmail(email);
}
