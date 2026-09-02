import * as FileSystem from 'expo-file-system/legacy';

// Per-prefix scan counters, so "Passport scan 0001" is followed by
// "Passport scan 0002" on the next passport scan, etc. Persisted next to the
// scans so it survives OTA updates and app restarts.
const DIR = `${FileSystem.documentDirectory}scans/`;
const FILE = `${DIR}counters.json`;

async function readAll(): Promise<Record<string, number>> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    return JSON.parse(await FileSystem.readAsStringAsync(FILE)) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Returns the next number for a prefix and persists the increment. */
export async function nextCount(prefix: string): Promise<number> {
  const counters = await readAll();
  const next = (counters[prefix] ?? 0) + 1;
  counters[prefix] = next;
  try {
    const dirInfo = await FileSystem.getInfoAsync(DIR);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify(counters));
  } catch {
    // If persistence fails we still return `next`; worst case a number repeats.
  }
  return next;
}
