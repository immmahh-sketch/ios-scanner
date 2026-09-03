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
  /**
   * Domains that belong to your own organisation. Mail to these addresses is
   * always sent from your real mailbox (share sheet) instead of the email API —
   * Microsoft 365 blocks API mail "from" your own domain family as phishing, no
   * matter how well it is authenticated.
   */
  internalDomains: string[];
  /** Internal prefs schema version for one-time migrations. */
  _v?: number;
}

// Bump when a one-time migration is needed in applyMigrations().
const PREFS_VERSION = 3;

const DEFAULT_PREFS: Prefs = {
  model: DEFAULT_MODEL,
  emailMethod: 'app',
  fromName: 'Black Horse Beamish',
  fromEmail: 'scanner@scan.blackhorsebeamish.co.uk',
  replyTo: 'gm@blackhorsebeamish.co.uk',
  recipients: [
    'gm@blackhorsebeamish.co.uk',
    'Accounts@blackhorsebeamish.co.uk',
    'Richard@aston.co.uk',
  ],
  internalDomains: ['blackhorsebeamish.co.uk'],
  _v: PREFS_VERSION,
};

/** One-time transforms for prefs saved by an older app version. */
function applyMigrations(p: Prefs): { prefs: Prefs; changed: boolean } {
  let prefs = p;
  let changed = false;

  if ((prefs._v ?? 1) < 2) {
    // v2: send from the authenticated Brevo subdomain so Microsoft 365 stops
    // quarantining mail "from" the primary domain as internal spoofing.
    prefs = {
      ...prefs,
      fromEmail:
        prefs.fromEmail === 'gm@blackhorsebeamish.co.uk' || !prefs.fromEmail
          ? 'scanner@scan.blackhorsebeamish.co.uk'
          : prefs.fromEmail,
      fromName: prefs.fromName || 'Black Horse Beamish',
      replyTo: prefs.replyTo || 'gm@blackhorsebeamish.co.uk',
      emailMethod: 'app',
      _v: 2,
    };
    changed = true;
  }

  if ((prefs._v ?? 1) < 3) {
    // v3: internal recipients now route through the real mailbox (share sheet)
    // instead of the email API, so Microsoft 365 stops flagging them as phishing.
    prefs = {
      ...prefs,
      internalDomains:
        Array.isArray(prefs.internalDomains) && prefs.internalDomains.length
          ? prefs.internalDomains
          : ['blackhorsebeamish.co.uk'],
      _v: 3,
    };
    changed = true;
  }

  return { prefs, changed };
}

/** True when `email` is on one of the configured internal (own-organisation) domains. */
export function isInternalRecipient(prefs: Prefs, email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return (prefs.internalDomains ?? []).some((d) => {
    const dd = d.trim().toLowerCase().replace(/^@/, '');
    return !!dd && (domain === dd || domain.endsWith(`.${dd}`));
  });
}

/**
 * The method a send should actually use for `recipient`, given the user's
 * preference. "Send through the app" is downgraded to the share sheet for
 * internal recipients (see Prefs.internalDomains). An explicit override on the
 * SendEmail screen bypasses this.
 */
export function effectiveMethod(prefs: Prefs, recipient: string): EmailMethod {
  if (prefs.emailMethod === 'app' && isInternalRecipient(prefs, recipient)) return 'share';
  return prefs.emailMethod;
}

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
      internalDomains:
        Array.isArray(parsed.internalDomains) && parsed.internalDomains.length
          ? (parsed.internalDomains as string[])
          : DEFAULT_PREFS.internalDomains,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

async function writePrefs(prefs: Prefs): Promise<void> {
  await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs));
}

export async function getPrefs(): Promise<Prefs> {
  const { prefs, changed } = applyMigrations(await readPrefs());
  if (changed) await writePrefs(prefs);
  return prefs;
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
