/** RFC-4180 CSV field: quote if it contains a comma, quote, CR or LF. */
export function csvField(value: string | number): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(fields: Array<string | number>): string {
  return fields.map(csvField).join(',');
}

export function csvDocument(header: string[], rows: Array<Array<string | number>>): string {
  return [csvRow(header), ...rows.map(csvRow)].join('\r\n') + '\r\n';
}
