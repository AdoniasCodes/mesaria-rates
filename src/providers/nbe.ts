import { BANKS } from '../banks.ts';
import { fetchJson } from '../http.ts';
import type { Provider, Row } from '../types.ts';
import { num } from './util.ts';

const { url, ...bank } = BANKS.nbe;
const API = 'https://api.nbe.gov.et/api/get-exchange-rates';

// pages: parsed JSON of every page of the paginated endpoint.
export function parseNbe(pages: unknown[]): Row[] {
  const rows: Row[] = [];
  for (const page of pages) {
    const items = (page as { data?: { data?: unknown[] } })?.data?.data;
    if (!Array.isArray(items)) throw new Error('NBE: unexpected response shape');
    for (const it of items as Record<string, any>[]) {
      const code = it?.currency?.code;
      if (typeof code !== 'string' || typeof it.date !== 'string') continue;
      const row: Row = { bank, currency: code.toUpperCase(), sourceDate: it.date.slice(0, 10), sourceUrl: url };
      const b = num(it.buying);
      const s = num(it.selling);
      if (b !== undefined) row.indicativeBuying = b;
      if (s !== undefined) row.indicativeSelling = s;
      rows.push(row);
    }
  }
  return rows;
}

async function fetchRows(): Promise<Row[]> {
  const first = (await fetchJson(`${API}?page=1`)) as { data?: { last_page?: number } };
  const last = Math.min(Number(first?.data?.last_page) || 1, 10);
  const pages: unknown[] = [first];
  for (let p = 2; p <= last; p++) pages.push(await fetchJson(`${API}?page=${p}`));
  return parseNbe(pages);
}

export const nbe: Provider = { bank, sourceUrl: url, fetchRows };
