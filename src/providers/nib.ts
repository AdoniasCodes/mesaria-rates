import { BANKS } from '../banks.ts';
import { fetchText } from '../http.ts';
import type { Provider, Row } from '../types.ts';
import { RowCollector, bodyText, codeFrom, load, num, parseDate, tableCells } from './util.ts';

const { url, ...bank } = BANKS.nib;

// The home page has a Cash/Transaction table (columns: buy, sell, buy, sell) and a separate
// weighted-average table, which we ignore.
export function parseNib(html: string): Row[] {
  const text = bodyText(html);
  const at = text.search(/Exchange Rate\s+[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}/i);
  const date = at < 0 ? null : parseDate(text.slice(at, at + 40));
  if (!date) throw new Error('Nib: date not found');
  const $ = load(html);
  const col = new RowCollector();
  $('table').each((_, t) => {
    const cells = tableCells($, t);
    const head = cells[0] ?? [];
    if (head.length !== 5 || !/currency/i.test(head[0])) return;
    for (const r of cells.slice(1)) {
      const code = codeFrom(r[0] ?? '');
      if (!code) continue;
      const [cb, cs, tb, ts] = r.slice(1).map(num);
      col.add(code, { cashBuying: cb, cashSelling: cs, transactionalBuying: tb, transactionalSelling: ts });
    }
  });
  const rows = col.rows(bank, date, url);
  if (!rows.length) throw new Error('Nib: no rate rows found');
  return rows;
}

export const nib: Provider = { bank, sourceUrl: url, fetchRows: async () => parseNib(await fetchText(url)) };
