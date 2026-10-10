import { PRICE_FIELDS } from './types.ts';
import type { Row } from './types.ts';

export const MAX_AGE_DAYS = 3;
// Default 10%. Override with RATES_MAX_DEVIATION (fraction, e.g. 0.08) without a code change.
export const MAX_DEVIATION = Number(process.env.RATES_MAX_DEVIATION) || 0.10;

export type Rejection = { row: Row; reason: string };

const RETAIL = ['cashBuying', 'cashSelling', 'transactionalBuying', 'transactionalSelling'] as const;
const PAIRS = [
  ['cashBuying', 'cashSelling'],
  ['transactionalBuying', 'transactionalSelling'],
  ['indicativeBuying', 'indicativeSelling'],
] as const;

export function ageDays(sourceDate: string, today: string): number {
  return Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(sourceDate + 'T00:00:00Z')) / 86_400_000);
}

// Mid of the NBE indicative rate per currency, used as a sanity anchor for retail quotes.
export function nbeMids(nbeRows: Row[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of nbeRows) {
    const { indicativeBuying: b, indicativeSelling: s } = r;
    if (b && s) m.set(r.currency, (b + s) / 2);
    else if (b || s) m.set(r.currency, (b ?? s)!);
  }
  return m;
}

export function checkRow(row: Row, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.sourceDate) || Number.isNaN(Date.parse(row.sourceDate))) return `bad sourceDate "${row.sourceDate}"`;
  const age = ageDays(row.sourceDate, today);
  if (age > MAX_AGE_DAYS) return `sourceDate ${row.sourceDate} is ${age} days old (max ${MAX_AGE_DAYS})`;
  if (age < -1) return `sourceDate ${row.sourceDate} is in the future`;
  if (!/^[A-Z]{3}$/.test(row.currency)) return `bad currency "${row.currency}"`;

  let present = 0;
  for (const f of PRICE_FIELDS) {
    const v = row[f];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) return `${f} is not a number (${String(v)})`;
    if (v <= 0) return `${f} is not positive (${v})`;
    present++;
  }
  if (present === 0) return 'no price fields';

  for (const [b, s] of PAIRS) {
    if (row[b] !== undefined && row[s] !== undefined && row[b]! > row[s]!) return `${b} ${row[b]} is above ${s} ${row[s]}`;
  }
  return null;
}

// Drops only the individual retail values that are too far from the NBE mid (cash and
// transactional are each compared against it separately). Returns the pruned row and why.
export function pruneDeviant(row: Row, mids: Map<string, number>): { row: Row; dropped: string[] } {
  const mid = mids.get(row.currency);
  if (row.bank.id === 'nbe' || !mid) return { row, dropped: [] };
  const out: Row = { ...row };
  const dropped: string[] = [];
  for (const f of RETAIL) {
    const v = out[f];
    if (v !== undefined && Math.abs(v - mid) / mid > MAX_DEVIATION) {
      dropped.push(`${f} ${v} is more than ${+(MAX_DEVIATION * 100).toFixed(2)}% from NBE mid ${mid.toFixed(4)}`);
      delete out[f];
    }
  }
  return { row: out, dropped };
}

export function validateRows(rows: Row[], today: string, mids: Map<string, number>) {
  const valid: Row[] = [];
  const rejected: Rejection[] = [];
  const dropped: Rejection[] = [];
  for (const row of rows) {
    const reason = checkRow(row, today);
    if (reason) {
      rejected.push({ row, reason });
      continue;
    }
    const pruned = pruneDeviant(row, mids);
    for (const d of pruned.dropped) dropped.push({ row, reason: d });
    if (PRICE_FIELDS.some((f) => pruned.row[f] !== undefined)) valid.push(pruned.row);
    else rejected.push({ row, reason: 'every price was out of range: ' + pruned.dropped.join('; ') });
  }
  return { valid, rejected, dropped };
}
