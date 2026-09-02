import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { getApiKey, getModel } from './settings';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TIMEOUT_MS = 45000;

export interface RightToWorkResult {
  personName: string;
  idType: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface MeetingNotesResult {
  meetingType: string;
  personName: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ReceiptResult {
  supplier: string;
  date: string; // ISO YYYY-MM-DD, or '' if unreadable
  purchases: string[];
  total: number;
  vat: number;
  nett: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
}

const PROMPTS = {
  rightToWork: `You are looking at a scanned identity document used for a UK Right to Work check (passport, driving licence, biometric residence permit, birth certificate, etc.).
Extract the full name of the document holder.
Respond with ONLY a JSON object, no markdown, no commentary:
{"personName": string, "idType": string, "confidence": "high"|"medium"|"low"}
- personName: the holder's full name as printed, in normal title case (e.g. "Jane Alice Smith"). Empty string if you cannot read a name.
- idType: short label, e.g. "Passport", "Driving licence", "BRP", "Birth certificate".`,

  meetingNotes: `You are reading scanned notes or minutes from a UK workplace HR meeting.
Decide the meeting type - one of exactly: "Fact Finding", "Disciplinary Hearing", "Sickness Absence Review", "Redundancy Consultation", "Grievance Hearing", "Investigation Meeting", "Return to Work", "Probation Review", "Other".
Also extract the name of the employee the meeting concerns.
Respond with ONLY a JSON object, no markdown, no commentary:
{"meetingType": string, "personName": string, "confidence": "high"|"medium"|"low"}
- personName: employee's full name in title case, or empty string if unclear.`,

  receipt: `You are reading a scanned purchase receipt.
Extract:
- supplier: the store / company name (short, as branded)
- date: the purchase date as ISO "YYYY-MM-DD". If the year is 2 digits assume 20xx. Empty string if unreadable.
- purchases: a list of the individual items bought (short descriptions). Exclude subtotal / discount / change / tax lines.
- total: the grand total actually paid, as a number (no currency symbol)
- vat: the VAT / tax amount as a number. If only a rate is shown, compute it. If no VAT is shown, use 0.
- nett: total minus vat, as a number
- currency: ISO code, e.g. "GBP"
Respond with ONLY a JSON object, no markdown, no commentary:
{"supplier": string, "date": string, "purchases": string[], "total": number, "vat": number, "nett": number, "currency": string, "confidence": "high"|"medium"|"low"}`,
} as const;

export type AiTask = keyof typeof PROMPTS;

/** Downscale + JPEG so the image is a few hundred KB (keeps token cost sane). */
async function toBase64(uri: string): Promise<string> {
  const resized = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  return FileSystem.readAsStringAsync(resized.uri, { encoding: FileSystem.EncodingType.Base64 });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model response.');
  return JSON.parse(body.slice(start, end + 1));
}

async function callClaude(task: AiTask, base64Jpeg: string): Promise<unknown> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');
  const model = await getModel();

  // `effort` is supported on Opus 5 / Sonnet 5 but rejected by Haiku 4.5.
  const supportsEffort = model === 'claude-opus-5' || model === 'claude-sonnet-5';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        ...(supportsEffort ? { output_config: { effort: 'low' } } : {}),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg },
              },
              { type: 'text', text: PROMPTS[task] },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n');
    return extractJson(text);
  } finally {
    clearTimeout(timer);
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
function conf(v: unknown): 'high' | 'medium' | 'low' {
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
}

export async function analyzeRightToWork(uri: string): Promise<RightToWorkResult | null> {
  try {
    const raw = (await callClaude('rightToWork', await toBase64(uri))) as Record<string, unknown>;
    return { personName: str(raw.personName), idType: str(raw.idType) || 'ID document', confidence: conf(raw.confidence) };
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_API_KEY') return null;
    console.warn('analyzeRightToWork failed', err);
    return null;
  }
}

export async function analyzeMeetingNotes(uri: string): Promise<MeetingNotesResult | null> {
  try {
    const raw = (await callClaude('meetingNotes', await toBase64(uri))) as Record<string, unknown>;
    return {
      meetingType: str(raw.meetingType) || 'Meeting notes',
      personName: str(raw.personName),
      confidence: conf(raw.confidence),
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_API_KEY') return null;
    console.warn('analyzeMeetingNotes failed', err);
    return null;
  }
}

export async function analyzeReceipt(uri: string): Promise<ReceiptResult | null> {
  try {
    const raw = (await callClaude('receipt', await toBase64(uri))) as Record<string, unknown>;
    const total = num(raw.total);
    let vat = num(raw.vat);
    let nett = num(raw.nett);
    if (!nett && total) nett = Math.round((total - vat) * 100) / 100;
    if (!vat && total && nett) vat = Math.round((total - nett) * 100) / 100;
    return {
      supplier: str(raw.supplier) || 'Unknown supplier',
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(raw.date)) ? str(raw.date) : '',
      purchases: Array.isArray(raw.purchases) ? raw.purchases.map(str).filter(Boolean) : [],
      total,
      vat,
      nett,
      currency: str(raw.currency) || 'GBP',
      confidence: conf(raw.confidence),
    };
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_API_KEY') return null;
    console.warn('analyzeReceipt failed', err);
    return null;
  }
}

/** Lightweight connectivity / key check for the Settings screen. */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, message: 'No API key saved.' };
  const model = await getModel();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Reply with the word OK.' }],
      }),
    });
    if (res.ok) return { ok: true, message: `Connected (${model}).` };
    const detail = await res.text().catch(() => '');
    return { ok: false, message: `${res.status}: ${detail.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
