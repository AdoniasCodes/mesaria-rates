import { BANKS, UNAVAILABLE } from './banks.ts';
import { nbeMids, validateRows } from './validate.ts';
import type { Rejection } from './validate.ts';
import type { BankEntry, RatesFile, Row, UnavailableEntry } from './types.ts';

export type ProviderResult = { id: string; rows?: Row[]; error?: string };
export type BankReport = { id: string; status: 'ok' | 'stale' | 'unavailable'; rows: number; rejected: Rejection[]; dropped: Rejection[]; message: string };

// Stale rows older than this are dropped rather than carried over forever.
export const MAX_STALE_DAYS = 7;

const ageOf = (d: string, today: string) => Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000);
const maxDate = (rows: Row[]) => rows.map((r) => r.sourceDate).sort().at(-1) ?? null;

export function build(opts: { results: ProviderResult[]; previous: RatesFile | null; now: Date }) {
  const { results, previous, now } = opts;
  const today = now.toISOString().slice(0, 10);
  const prevRows = (id: string) => (previous?.rates ?? []).filter((r) => r.bank.id === id);

  // 1. NBE first, so its mid rates can bound everyone else.
  const nbeRes = results.find((r) => r.id === 'nbe');
  const nbeFresh = nbeRes?.rows ? validateRows(nbeRes.rows, today, new Map()) : null;
  const nbeBasis = nbeFresh?.valid.length ? nbeFresh.valid : prevRows('nbe');
  const mids = nbeMids(nbeBasis);

  const banks: BankEntry[] = [];
  const rates: Row[] = [];
  const unavailable: UnavailableEntry[] = [];
  const reports: BankReport[] = [];

  for (const res of results) {
    const meta = BANKS[res.id];
    const base = { id: meta.id, name: meta.name, nameAm: meta.nameAm ?? '', sourceUrl: meta.url };
    let valid: Row[] = [];
    let rejected: Rejection[] = [];
    let dropped: Rejection[] = [];
    let failure = res.error ?? '';
    if (res.rows) {
      ({ valid, rejected, dropped } = res.id === 'nbe' ? nbeFresh! : validateRows(res.rows, today, mids));
      if (!valid.length && !failure) failure = `no valid rows (${rejected.length} rejected${rejected[0] ? `, e.g. ${rejected[0].reason}` : ''})`;
    }

    if (valid.length) {
      rates.push(...valid);
      const bits = [rejected.length && `${rejected.length} row(s) rejected`, dropped.length && `${dropped.length} value(s) dropped`].filter(Boolean);
      const note = bits.length ? bits.join(', ') : undefined;
      banks.push({ ...base, status: 'ok', sourceDate: maxDate(valid), ...(note ? { note } : {}) });
      reports.push({ id: res.id, status: 'ok', rows: valid.length, rejected, dropped, message: `ok, ${valid.length} rows, date ${maxDate(valid)}` });
      continue;
    }

    const old = prevRows(res.id);
    const oldDate = maxDate(old);
    if (old.length && oldDate && ageOf(oldDate, today) <= MAX_STALE_DAYS) {
      rates.push(...old.map((r) => ({ ...r, stale: true })));
      banks.push({ ...base, status: 'stale', sourceDate: oldDate, note: `Today's fetch failed: ${failure}` });
      reports.push({ id: res.id, status: 'stale', rows: old.length, rejected, dropped, message: `STALE, kept ${old.length} rows from ${oldDate}. Reason: ${failure}` });
    } else {
      banks.push({ ...base, status: 'unavailable', sourceDate: null, note: failure });
      unavailable.push({ id: meta.id, name: meta.name, nameAm: meta.nameAm ?? '', reason: `Could not read today: ${failure}` });
      reports.push({ id: res.id, status: 'unavailable', rows: 0, rejected, dropped, message: `FAILED, no data. Reason: ${failure}` });
    }
  }

  unavailable.push(...UNAVAILABLE);
  const file: RatesFile = { schema: 1, generatedAt: now.toISOString(), banks, rates, unavailable };
  const fresh = (id: string) => reports.find((r) => r.id === id)?.status === 'ok';
  return { file, reports, success: fresh('nbe') || fresh('cbe') };
}
