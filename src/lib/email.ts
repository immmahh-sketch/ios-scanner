import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';

import { getEmailKey, getPrefs, type EmailMethod } from './settings';
import { shareFile } from './export';

// The email API key is entered by the user; the provider is detected from its
// prefix so the UI never has to name a service.
const ENDPOINTS = {
  brevo: 'https://api.brevo.com/v3/smtp/email',
  resend: 'https://api.resend.com/emails',
} as const;

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

async function base64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

function apiErrorMessage(detail: string, status: number): string {
  try {
    const j = JSON.parse(detail) as { message?: string };
    if (j.message) return j.message;
  } catch {
    if (detail) return detail.slice(0, 200);
  }
  return `Email service error ${status}`;
}

function providerFor(key: string): 'brevo' | 'resend' {
  if (key.startsWith('re_')) return 'resend';
  return 'brevo'; // xkeysib-… and anything else
}

/** Sends immediately through the configured email service (attachments included). */
export async function sendDirect(email: OutgoingEmail): Promise<{ id: string; provider: string }> {
  const key = await getEmailKey();
  if (!key) throw new Error('No email API key saved (Settings → Email).');
  if (!email.to.trim()) throw new Error('Pick a recipient first.');
  const prefs = await getPrefs();
  const to = email.to.trim();
  const fromEmail = prefs.fromEmail.trim();
  const fromName = prefs.fromName.trim();
  const replyTo = prefs.replyTo.trim();

  let res: Response;
  if (providerFor(key) === 'resend') {
    const attachments = [];
    for (const att of email.attachments) {
      attachments.push({
        filename: att.filename,
        content: await base64(att.uri),
        content_type: mimeFor(att.filename),
      });
    }
    res = await fetch(ENDPOINTS.resend, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [to],
        reply_to: replyTo || undefined,
        subject: email.subject,
        text: email.body,
        attachments: attachments.length ? attachments : undefined,
      }),
    });
  } else {
    const attachment = [];
    for (const att of email.attachments) {
      attachment.push({ name: att.filename, content: await base64(att.uri) });
    }
    res = await fetch(ENDPOINTS.brevo, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'api-key': key,
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName || undefined },
        to: [{ email: to }],
        replyTo: replyTo ? { email: replyTo } : undefined,
        subject: email.subject,
        textContent: email.body,
        attachment: attachment.length ? attachment : undefined,
      }),
    });
  }

  const provider = providerFor(key);
  const bodyText = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`${provider} ${res.status}: ${apiErrorMessage(bodyText, res.status)}`);
  }

  let id = '';
  try {
    const j = JSON.parse(bodyText) as { messageId?: string; id?: string };
    id = j.messageId ?? j.id ?? '';
  } catch {
    // ignore
  }
  if (!id) {
    // 2xx but no id back — the send did NOT register. Surface the body.
    throw new Error(
      `${provider} accepted the request (HTTP ${res.status}) but returned no message id. Response: ${
        bodyText.slice(0, 300) || '(empty)'
      }`,
    );
  }
  return { id, provider };
}

/** Real end-to-end send to the configured From address; returns what the service said. */
export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  const key = await getEmailKey();
  if (!key) return { ok: false, message: 'No email API key saved.' };
  const prefs = await getPrefs();
  const to = prefs.fromEmail.trim();
  if (!to) return { ok: false, message: 'Set a From address first.' };
  try {
    const r = await sendDirect({
      to,
      subject: 'Scanner test email',
      body: 'Test email from the Scanner app. If you see this, sending works.',
      attachments: [],
    });
    return {
      ok: true,
      message: `${r.provider} accepted it (id ${r.id}). Sent to ${to} — check that inbox and spam.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
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

/** iOS share sheet — the only way to get a file into another mail app on iOS. */
export async function shareAttachmentsForEmail(email: OutgoingEmail): Promise<void> {
  if (email.attachments.length === 0) {
    await openOutlookCompose(email);
    return;
  }
  await shareFile(email.attachments[0].uri, email.subject || 'Share');
}

export async function sendEmail(method: EmailMethod, email: OutgoingEmail) {
  if (method === 'app') return sendDirect(email);
  if (method === 'outlook') return openOutlookCompose(email);
  return shareAttachmentsForEmail(email);
}
