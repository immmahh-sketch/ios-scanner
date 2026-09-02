import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

// The Anthropic API key lives in the iOS Keychain (SecureStore) and is only
// ever sent to api.anthropic.com. Non-secret prefs (model choice) go in a plain
// JSON file next to the scans.
const KEY_ITEM = 'anthropic_api_key';
const PREFS_FILE = `${FileSystem.documentDirectory}settings.json`;

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', note: 'Most capable · ~£0.02–0.03 / scan' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'Balanced · ~£0.01 / scan' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Cheapest & fastest · ~£0.005 / scan' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export const DEFAULT_MODEL: ModelId = 'claude-opus-5';

interface Prefs {
  model: ModelId;
}

async function readPrefs(): Promise<Prefs> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return { model: DEFAULT_MODEL };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(PREFS_FILE)) as Partial<Prefs>;
    return { model: parsed.model ?? DEFAULT_MODEL };
  } catch {
    return { model: DEFAULT_MODEL };
  }
}

async function writePrefs(prefs: Prefs): Promise<void> {
  await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs));
}

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_ITEM);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed) await SecureStore.setItemAsync(KEY_ITEM, trimmed);
  else await SecureStore.deleteItemAsync(KEY_ITEM);
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey())?.length ? true : false;
}

export async function getModel(): Promise<ModelId> {
  return (await readPrefs()).model;
}

export async function setModel(model: ModelId): Promise<void> {
  const prefs = await readPrefs();
  await writePrefs({ ...prefs, model });
}
