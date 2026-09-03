import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';

import { getBrevoKey, getPrefs, getResendKey, type EmailMethod } from './settings';
import { shareFile } from './export';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

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

async function base64Attachments(atts: EmailAttachment[]): Promise<{ name: string; content: string }[]> {
  const out: { name: string; content: string }[] = [];
  for (const att of atts) {
    const content = await FileSystem.readAsStringAsync(att.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    out.push({ name: att.filename, content });
  }
  return out;
}

function extractApiError(detail: string, fallback: string): string {
  try {
    const j = JSON.parse(detail) as { message?: string };
    if (j.message) return j.message;
  } catch {
    if (detail) return detail.slice(0, 200);
  }
  return fallback;
}

/** Sends immediately through the user's Brevo account (attachments included). */
export async function sendViaBrevo(email: OutgoingEmail): Promise<void> {
  const key = await getBrevoKey();
  if (!key) throw new Error('No Brevo API key saved (Settings → Email).');
  const prefs = await getPrefs();
  if (!email.to.trim()) throw new Error('Pick a recipient first.');

  const attachment = await base64Attachments(email.attachments);

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'api-key': key,
    },
    body: JSON.stringify({
      sender: { email: prefs.fromEmail.trim(), name: prefs.fromName.trim() || undefined },
      to: [{ email: email.to.trim() }],
      subject: email.subject,
      textContent: email.body,
      attachment: attachment.length ? attachment : undefined,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(extractApiError(detail, `Brevo ${res.status}`));
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

export async function sendEmail(method: EmailMethod, email: OutgoingEmail) {
  if (method === 'resend') return sendViaResend(email);
  if (method === 'brevo') return sendViaBrevo(email);
  if (method === 'outlook') return openOutlookCompose(email);
  return shareAttachmentsForEmail(email);
}
