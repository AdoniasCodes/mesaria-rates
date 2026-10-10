import * as cheerio from 'cheerio';
import type { BankRef, Row } from '../types.ts';

export const load = (html: string) => cheerio.load(html);

const NOT_QUOTED = /^(|-+|\.+|…|n\/?a|no\s*trade|nil|null)$/i;

// 0 and "not quoted" markers become undefined. Anything else non-numeric becomes
// NaN so validate.ts can reject the row instead of silently dropping bad data.
export function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return v === 0 ? undefined : v;
  const s = String(v).trim().replace(/,/g, '');
  if (NOT_QUOTED.test(s)) return undefined;
  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  return n === 0 ? undefined : n;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "October 10, 2026", "Oct 10, 2026", "10 OCT, 2026", "10-Oct-2026", "2026-10-10" -> YYYY-MM-DD
export function parseDate(s: string): string | null {
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (m) {
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  m = s.match(/(\d{1,2})[\s-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?[\s-]+(\d{4})/i);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

export function bodyText(html: string): string {
  const $ = load(html);
  $('script,style,noscript').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

export function tableCells($: cheerio.CheerioAPI, table: Parameters<cheerio.CheerioAPI>[0]): string[][] {
  return $(table)
    .find('tr')
    .map((_, tr) =>
      [
        $(tr)
          .children('td,th')
          .map((__, c) => $(c).text().replace(/\s+/g, ' ').trim())
          .get(),
      ],
    )
    .get();
}

// ISO code from a cell: "US Dollar (USD)", "China ( CNY)", or a bare "USD".
export function codeFrom(cell: string): string | null {
  const m = cell.match(/\(\s*([A-Za-z]{3})\s*\)/);
  if (m) return m[1].toUpperCase();
  return /^[A-Z]{3}$/.test(cell) ? cell : null;
}

export type Fields = Partial<
  Pick<Row, 'cashBuying' | 'cashSelling' | 'transactionalBuying' | 'transactionalSelling'>
>;

// Collects per-currency fields from several tables into one row per currency.
export class RowCollector {
  private map = new Map<string, Fields>();
  add(code: string, fields: Fields) {
    const cur = this.map.get(code) ?? {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) (cur as Record<string, number>)[k] = v;
    this.map.set(code, cur);
  }
  rows(bank: BankRef, sourceDate: string, sourceUrl: string): Row[] {
    return [...this.map.entries()]
      .filter(([, f]) => Object.keys(f).length > 0)
      .map(([currency, f]) => ({ bank, currency, ...f, sourceDate, sourceUrl }));
  }
}
