import { BANKS } from '../banks.ts';
import { fetchJson } from '../http.ts';
import type { Provider, Row } from '../types.ts';
import { num } from './util.ts';

const { url, ...bank } = BANKS.cbe;
// NEVER call this endpoint without _limit: it returns 100 records (1.8 MB).
const API = `${url}?_sort=Date:DESC&_limit=1`;

export function parseCbe(json: unknown): Row[] {
  if (!Array.isArray(json) || json.length === 0) throw new Error('CBE: empty or unexpected response');
  const rec = json[0] as Record<string, any>;
  const date = typeof rec.Date === 'string' ? rec.Date.slice(0, 10) : '';
  if (!date || !Array.isArray(rec.ExchangeRate)) throw new Error('CBE: missing Date or ExchangeRate');
  const rows: Row[] = [];
  for (const it of rec.ExchangeRate as Record<string, any>[]) {
    const code = it?.currency?.CurrencyCode;
    if (typeof code !== 'string') continue;
    const row: Row = { bank, currency: code.toUpperCase(), sourceDate: date, sourceUrl: url };
    const map = {
      cashBuying: it.cashBuying,
      cashSelling: it.cashSelling,
      transactionalBuying: it.transactionalBuying,
      transactionalSelling: it.transactionalSelling,
    } as const;
    for (const [k, v] of Object.entries(map)) {
      const n = num(v);
      if (n !== undefined) (row as Record<string, unknown>)[k] = n;
    }
    rows.push(row);
  }
  return rows;
}

export const cbe: Provider = { bank, sourceUrl: url, fetchRows: async () => parseCbe(await fetchJson(API)) };
