import { BANKS } from '../banks.ts';
import { fetchText } from '../http.ts';
import type { Provider, Row } from '../types.ts';
import { RowCollector, bodyText, codeFrom, load, num, parseDate, tableCells } from './util.ts';

const { url, ...bank } = BANKS.amhara;

export function parseAmhara(html: string): Row[] {
  // The page also has a "WEIGHTED AVERAGE" block with a different date; the date we want precedes it.
  const text = bodyText(html);
  const head = text.split(/WEIGHTED AVERAGE/i)[0];
  const date = parseDate(head.slice(head.search(/EXCHANGE RATE/i)));
  if (!date) throw new Error('Amhara: date not found');
  const $ = load(html);
  const col = new RowCollector();
  $('table').each((_, t) => {
    const cells = tableCells($, t);
    if (!cells[0]?.some((c) => /cash buying/i.test(c))) return;
    for (const r of cells.slice(1)) {
      const i = r.findIndex((c) => codeFrom(c));
      if (i < 0) continue;
      const [cb, cs, tb, ts] = r.slice(i + 1).map(num);
      col.add(codeFrom(r[i])!, { cashBuying: cb, cashSelling: cs, transactionalBuying: tb, transactionalSelling: ts });
    }
  });
  const rows = col.rows(bank, date, url);
  if (!rows.length) throw new Error('Amhara: no rate rows found');
  return rows;
}

export const amhara: Provider = { bank, sourceUrl: url, fetchRows: async () => parseAmhara(await fetchText(url)) };
