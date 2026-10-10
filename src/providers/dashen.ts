import { BANKS } from '../banks.ts';
import { fetchText } from '../http.ts';
import type { Provider, Row } from '../types.ts';
import { RowCollector, bodyText, codeFrom, load, num, parseDate, tableCells } from './util.ts';

const { url, ...bank } = BANKS.dashen;

// Three tables: Transaction, Cash, Weighted Average (ignored, it has its own date).
export function parseDashen(html: string): Row[] {
  const m = bodyText(html).match(/Applicable on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  const date = m ? parseDate(m[1]) : null;
  if (!date) throw new Error('Dashen: date not found');
  const $ = load(html);
  const col = new RowCollector();
  $('table').each((_, t) => {
    const cells = tableCells($, t);
    const head = (cells[0] ?? []).join(' ');
    const kind = /transaction buying/i.test(head) ? 'transactional' : /cash buying/i.test(head) ? 'cash' : null;
    if (!kind) return;
    for (const r of cells.slice(1)) {
      const code = codeFrom(r[0] ?? '');
      if (!code) continue;
      const buy = num(r[2]);
      const sell = num(r[3]);
      col.add(code, kind === 'cash' ? { cashBuying: buy, cashSelling: sell } : { transactionalBuying: buy, transactionalSelling: sell });
    }
  });
  const rows = col.rows(bank, date, url);
  if (!rows.length) throw new Error('Dashen: no rate rows found');
  return rows;
}

export const dashen: Provider = { bank, sourceUrl: url, fetchRows: async () => parseDashen(await fetchText(url)) };
