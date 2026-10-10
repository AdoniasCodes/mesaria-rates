import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAmhara } from '../src/providers/amhara.ts';
import { parseBoa } from '../src/providers/boa.ts';
import { parseCbe } from '../src/providers/cbe.ts';
import { parseDashen } from '../src/providers/dashen.ts';
import { parseNbe } from '../src/providers/nbe.ts';
import { parseNib } from '../src/providers/nib.ts';
import { num, parseDate } from '../src/providers/util.ts';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const find = (rows: { currency: string }[], c: string) => rows.find((r) => r.currency === c) as any;

describe('helpers', () => {
  it('num treats 0 and no-trade as not quoted, garbage as NaN', () => {
    expect(num('0')).toBeUndefined();
    expect(num(0)).toBeUndefined();
    expect(num('NO TRADE')).toBeUndefined();
    expect(num('...')).toBeUndefined();
    expect(num('160.2319')).toBe(160.2319);
    expect(num('1,234.5')).toBe(1234.5);
    expect(num('abc')).toBeNaN();
  });
  it('parseDate handles the formats the banks use', () => {
    expect(parseDate('October 10, 2026')).toBe('2026-10-10');
    expect(parseDate('Oct 9, 2026')).toBe('2026-10-09');
    expect(parseDate('10 OCT, 2026')).toBe('2026-10-10');
    expect(parseDate('10-Oct-2026')).toBe('2026-10-10');
    expect(parseDate('Exchange RateOctober 10, 2026')).toBe('2026-10-10');
    expect(parseDate('nothing')).toBeNull();
  });
});

describe('NBE', () => {
  const pages = [1, 2, 3, 4].map((p) => JSON.parse(fx(`nbe-${p}.json`)));
  const rows = parseNbe(pages);
  it('parses all pages into indicative rows', () => {
    expect(rows).toHaveLength(19);
    const usd = find(rows, 'USD');
    expect(usd.indicativeBuying).toBe(160.9897);
    expect(usd.indicativeSelling).toBe(162.5996);
    expect(usd.sourceDate).toBe('2026-10-09');
    expect(usd.cashBuying).toBeUndefined();
    expect(usd.bank.id).toBe('nbe');
  });
  it('throws on an unexpected shape', () => {
    expect(() => parseNbe([{ nope: 1 }])).toThrow();
  });
});

describe('CBE', () => {
  const rows = parseCbe(JSON.parse(fx('cbe.json')));
  it('parses cash and transactional rates and the record date', () => {
    const usd = find(rows, 'USD');
    expect(usd.cashBuying).toBe(160.2319);
    expect(usd.transactionalSelling).toBe(163.4365);
    expect(usd.sourceDate).toBe('2026-10-10');
    expect(usd.indicativeBuying).toBeUndefined();
    expect(rows.length).toBeGreaterThanOrEqual(15);
  });
  it('omits zero values (not quoted)', () => {
    const inr = find(rows, 'INR');
    expect(inr.cashBuying).toBeUndefined();
    expect(inr.transactionalBuying).toBeGreaterThan(0);
  });
  it('throws on empty', () => {
    expect(() => parseCbe([])).toThrow();
  });
});

describe('Amhara', () => {
  const rows = parseAmhara(fx('amhara.html'));
  it('parses cash and transaction columns and the cash-block date', () => {
    const usd = find(rows, 'USD');
    expect(usd).toMatchObject({ cashBuying: 161.6999, cashSelling: 164.9339, transactionalBuying: 161.6999, transactionalSelling: 164.9339, sourceDate: '2026-10-10' });
    expect(find(rows, 'CNY')).toBeDefined();
    expect(find(rows, 'EUR').currency).toBe('EUR');
  });
  it('does not take the weighted-average table', () => {
    expect(find(rows, 'USD').cashBuying).not.toBe(164.1179);
  });
  it('throws when the date is missing', () => {
    expect(() => parseAmhara('<html><body><table></table></body></html>')).toThrow();
  });
});

describe('Nib', () => {
  const rows = parseNib(fx('nib.html'));
  it('parses the cash/transaction table', () => {
    expect(find(rows, 'USD')).toMatchObject({ cashBuying: 160.9077, cashSelling: 164.1259, transactionalBuying: 160.9077, transactionalSelling: 164.1259, sourceDate: '2026-10-10' });
    expect(rows.map((r) => r.currency)).toEqual(expect.arrayContaining(['GBP', 'EUR', 'CHF', 'CAD', 'AED', 'SAR']));
  });
  it('ignores the weighted average table (USD 167.0678)', () => {
    expect(find(rows, 'USD').cashBuying).not.toBe(167.0678);
  });
});

describe('Dashen', () => {
  const rows = parseDashen(fx('dashen.html'));
  it('merges transaction and cash tables by currency', () => {
    expect(find(rows, 'USD')).toMatchObject({ transactionalBuying: 160.8707, transactionalSelling: 164.0881, cashBuying: 160.8707, cashSelling: 164.0881, sourceDate: '2026-10-10' });
    expect(find(rows, 'CAD').cashBuying).toBe(116.4198);
    expect(find(rows, 'CAD').transactionalBuying).toBeUndefined();
  });
  it('ignores the weighted average table', () => {
    expect(find(rows, 'USD').cashBuying).not.toBe(163.8186);
  });
});

describe('Bank of Abyssinia', () => {
  const rows = parseBoa(fx('boa.html'));
  it('splits the cash and transaction blocks', () => {
    expect(find(rows, 'USD')).toMatchObject({ cashBuying: 161.3129, cashSelling: 164.5392, transactionalBuying: 160.8768, transactionalSelling: 164.0943, sourceDate: '2026-10-10' });
    expect(find(rows, 'KWD').transactionalBuying).toBe(522.1415);
    expect(find(rows, 'KWD').cashBuying).toBeUndefined();
  });
});
