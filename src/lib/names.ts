/** Strips characters that are unsafe in a file name; keeps it readable. */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return cleaned.length ? cleaned : 'Scan';
}

/** Default name suggested when a new scan is created, e.g. "Scan 2026-09-02 14.05". */
export function defaultScanName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}.${pad(date.getMinutes())}`;
  return `Scan ${d} ${t}`;
}
