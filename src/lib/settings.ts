import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

// Secrets (API keys) live in the iOS Keychain via SecureStore and are only ever
// sent to their own service. Non-secret prefs go in a plain JSON file.
const ANTHROPIC_KEY_ITEM = 'anthropic_api_key';
const RESEND_KEY_ITEM = 'resend_api_key';
const PREFS_FILE = `${FileSystem.documentDirectory}settings.json`;

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Most capable · ~£0.02–0.03 / scan' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Balanced · ~£0.01 / scan' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Cheapest & fastest · ~£0.005 / scan' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];
export const DEFAULT_MODEL: ModelId = 'claude-opus-5';

export type EmailMethod = 'resend' | 'outlook' | 'share';

export interface Prefs {
  model: ModelId;
  emailMethod: EmailMethod;
  fromName: string;
  fromEmail: string;
  recipients: string[];
}

const DEFAULT_PREFS: Prefs = {
  model: DEFAULT_MODEL,
  emailMethod: 'resend',
  fromName: '',
  fromEmail: 'gm@blackhorsebeamish.co.uk',
  recipients: [
    'gm@blackhorsebeamish.co.uk',
    'Accounts@blackhorsebeamish.co.uk',
    'Richard@aston.co.uk',
  ],
};

async function readPrefs(): Promise<Prefs> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(PREFS_FILE)) as Partial<Prefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      recipients: Array.isArray(parsed.recipients) && parsed.recipients.length
        ? parsed.recipients
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

// --- Anthropic key ---
export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ANTHROPIC_KEY_ITEM);
  } catch {
    return null;
  }
}
export async function setApiKey(key: string): Promise<void> {
  const t = key.trim();
  if (t) await SecureStore.setItemAsync(ANTHROPIC_KEY_ITEM, t);
  else await SecureStore.deleteItemAsync(ANTHROPIC_KEY_ITEM);
}
export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey())?.length ? true : false;
}

// --- Resend key ---
export async function getResendKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(RESEND_KEY_ITEM);
  } catch {
    return null;
  }
}
export async function setResendKey(key: string): Promise<void> {
  const t = key.trim();
  if (t) await SecureStore.setItemAsync(RESEND_KEY_ITEM, t);
  else await SecureStore.deleteItemAsync(RESEND_KEY_ITEM);
}
export async function hasResendKey(): Promise<boolean> {
  return (await getResendKey())?.length ? true : false;
}

// --- model (kept as thin wrappers for existing callers) ---
export async function getModel(): Promise<ModelId> {
  return (await readPrefs()).model;
}
export async function setModel(model: ModelId): Promise<void> {
  await updatePrefs({ model });
}
