import { BANKS } from '../banks.ts';
import { fetchText } from '../http.ts';
import type { Provider, Row } from '../types.ts';
import { RowCollector, bodyText, codeFrom, load, num, parseDate, tableCells } from './util.ts';

const { url, ...bank } = BANKS.boa;

// One table with a "Cash Rates" block followed by a "Transaction Rates" block.
export function parseBoa(html: string): Row[] {
  const text = bodyText(html);
  const at = text.search(/Exchange Rate\s*[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}/i);
  const date = at < 0 ? null : parseDate(text.slice(at, at + 40));
  if (!date) throw new Error('BoA: date not found');
  const $ = load(html);
  const col = new RowCollector();
  $('table').each((_, t) => {
    let kind: 'cash' | 'transactional' | null = null;
    for (const r of tableCells($, t)) {
      if (/^cash rates/i.test(r[0] ?? '')) kind = 'cash';
      else if (/^transaction rates/i.test(r[0] ?? '')) kind = 'transactional';
      const code = codeFrom(r[0] ?? '');
      if (!kind || !code) continue;
      const buy = num(r[1]);
      const sell = num(r[2]);
      col.add(code, kind === 'cash' ? { cashBuying: buy, cashSelling: sell } : { transactionalBuying: buy, transactionalSelling: sell });
    }
  });
  const rows = col.rows(bank, date, url);
  if (!rows.length) throw new Error('BoA: no rate rows found');
  return rows;
}

export const boa: Provider = { bank, sourceUrl: url, fetchRows: async () => parseBoa(await fetchText(url)) };
