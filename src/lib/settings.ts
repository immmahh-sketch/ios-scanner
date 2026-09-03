import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

// Secrets (API keys) live in the iOS Keychain via SecureStore and are only ever
// sent to their own service. Non-secret prefs go in a plain JSON file.
const ANTHROPIC_KEY_ITEM = 'anthropic_api_key';
const EMAIL_KEY_ITEM = 'email_api_key';
// Older key items, read once so an already-saved key keeps working.
const LEGACY_EMAIL_ITEMS = ['brevo_api_key', 'resend_api_key'];
const PREFS_FILE = `${FileSystem.documentDirectory}settings.json`;

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Most capable · ~£0.02–0.03 / scan' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Balanced · ~£0.01 / scan' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Cheapest & fastest · ~£0.005 / scan' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];
export const DEFAULT_MODEL: ModelId = 'claude-opus-5';

export type EmailMethod = 'app' | 'outlook' | 'share';

export interface Prefs {
  model: ModelId;
  emailMethod: EmailMethod;
  fromName: string;
  fromEmail: string;
  /** Reply-To for "Send through the app". Useful when From is a sending subdomain. */
  replyTo: string;
  recipients: string[];
}

const DEFAULT_PREFS: Prefs = {
  model: DEFAULT_MODEL,
  emailMethod: 'app',
  fromName: '',
  fromEmail: 'gm@blackhorsebeamish.co.uk',
  replyTo: 'gm@blackhorsebeamish.co.uk',
  recipients: [
    'gm@blackhorsebeamish.co.uk',
    'Accounts@blackhorsebeamish.co.uk',
    'Richard@aston.co.uk',
  ],
};

function normaliseMethod(v: unknown): EmailMethod {
  if (v === 'outlook' || v === 'share' || v === 'app') return v;
  return 'app'; // older provider-named values collapse to the in-app sender
}

async function readPrefs(): Promise<Prefs> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(PREFS_FILE)) as Record<string, unknown>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      emailMethod: normaliseMethod(parsed.emailMethod),
      recipients:
        Array.isArray(parsed.recipients) && parsed.recipients.length
          ? (parsed.recipients as string[])
          : DEFAULT_PREFS.recipients,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

async function writePrefs(prefs: Prefs): Promise<void> {
  await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs));
}

export async function getPrefs(): Promise<Prefs> {
  return readPrefs();
}

export async function updatePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await readPrefs()), ...patch };
  await writePrefs(next);
  return next;
}

async function readItem(item: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(item);
  } catch {
    return null;
  }
}

// --- Anthropic key ---
export async function getApiKey(): Promise<string | null> {
  return readItem(ANTHROPIC_KEY_ITEM);
}
export async function setApiKey(key: string): Promise<void> {
  const t = key.trim();
  if (t) await SecureStore.setItemAsync(ANTHROPIC_KEY_ITEM, t);
  else await SecureStore.deleteItemAsync(ANTHROPIC_KEY_ITEM);
}
export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey())?.length ? true : false;
}

// --- Email sending key (service auto-detected from the key format) ---
export async function getEmailKey(): Promise<string | null> {
  const primary = await readItem(EMAIL_KEY_ITEM);
  if (primary) return primary;
  for (const legacy of LEGACY_EMAIL_ITEMS) {
    const v = await readItem(legacy);
    if (v) return v;
  }
  return null;
}
export async function setEmailKey(key: string): Promise<void> {
  const t = key.trim();
  if (t) await SecureStore.setItemAsync(EMAIL_KEY_ITEM, t);
  else await SecureStore.deleteItemAsync(EMAIL_KEY_ITEM);
}
export async function hasEmailKey(): Promise<boolean> {
  return (await getEmailKey())?.length ? true : false;
}

/** Whether the selected method is ready to send (the 'app' method needs a key). */
export async function methodReady(method: EmailMethod): Promise<boolean> {
  return method === 'app' ? hasEmailKey() : true;
}

// --- model (thin wrappers for existing callers) ---
export async function getModel(): Promise<ModelId> {
  return (await readPrefs()).model;
}
export async function setModel(model: ModelId): Promise<void> {
  await updatePrefs({ model });
}
