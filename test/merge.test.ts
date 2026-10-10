import { describe, expect, it } from 'vitest';
import { build } from '../src/merge.ts';
import { UNAVAILABLE } from '../src/banks.ts';
import type { RatesFile, Row } from '../src/types.ts';

const now = new Date('2026-10-10T06:30:00Z');
const B = (id: string, name = id) => ({ id, name });
const nbeRow = (date = '2026-10-09'): Row => ({ bank: B('nbe'), currency: 'USD', indicativeBuying: 160, indicativeSelling: 162, sourceDate: date, sourceUrl: 'n' });
const cbeRow = (date = '2026-10-10', sell = 163): Row => ({ bank: B('cbe'), currency: 'USD', transactionalBuying: 160, transactionalSelling: sell, sourceDate: date, sourceUrl: 'c' });
const nibRow = (date = '2026-10-10'): Row => ({ bank: B('nib'), currency: 'USD', cashBuying: 160, cashSelling: 164, sourceDate: date, sourceUrl: 'b' });
const prevFile = (rates: Row[]): RatesFile => ({ schema: 1, generatedAt: '2026-10-09T06:30:00Z', banks: [], rates, unavailable: [] });

describe('build / merge', () => {
  it('outputs the schema, banks and the unavailable list', () => {
    const { file, success } = build({ results: [{ id: 'nbe', rows: [nbeRow()] }, { id: 'cbe', rows: [cbeRow()] }], previous: null, now });
    expect(file.schema).toBe(1);
    expect(file.generatedAt).toBe(now.toISOString());
    expect(file.banks.map((b) => [b.id, b.status])).toEqual([['nbe', 'ok'], ['cbe', 'ok']]);
    expect(file.rates).toHaveLength(2);
    expect(file.unavailable.map((u) => u.id)).toEqual(expect.arrayContaining(['awash', 'zemen', 'wegagen', 'berhan']));
    expect(file.unavailable).toHaveLength(UNAVAILABLE.length);
    expect(success).toBe(true);
  });

  it('carries over a failed bank from the previous file as stale, with its own date', () => {
    const previous = prevFile([nibRow('2026-10-09')]);
    const { file, reports } = build({ results: [{ id: 'nbe', rows: [nbeRow()] }, { id: 'nib', error: 'HTTP 500' }], previous, now });
    const nib = file.banks.find((b) => b.id === 'nib')!;
    expect(nib).toMatchObject({ status: 'stale', sourceDate: '2026-10-09' });
    expect(nib.note).toMatch(/HTTP 500/);
    const kept = file.rates.find((r) => r.bank.id === 'nib')!;
    expect(kept.stale).toBe(true);
    expect(kept.sourceDate).toBe('2026-10-09');
    expect(reports.find((r) => r.id === 'nib')!.status).toBe('stale');
  });

  it('marks a bank unavailable when it failed and nothing usable is stored', () => {
    const { file } = build({ results: [{ id: 'nbe', rows: [nbeRow()] }, { id: 'nib', error: 'boom' }], previous: null, now });
    expect(file.banks.find((b) => b.id === 'nib')!.status).toBe('unavailable');
    expect(file.unavailable.find((u) => u.id === 'nib')!.reason).toMatch(/boom/);
    expect(file.rates.some((r) => r.bank.id === 'nib')).toBe(false);
  });

  it('does not carry over data older than 7 days', () => {
    const previous = prevFile([nibRow('2026-10-01')]);
    const { file } = build({ results: [{ id: 'nbe', rows: [nbeRow()] }, { id: 'nib', error: 'x' }], previous, now });
    expect(file.banks.find((b) => b.id === 'nib')!.status).toBe('unavailable');
  });

  it('treats a provider whose rows are all rejected as a failure', () => {
    const old = nibRow('2026-09-01');
    const { file } = build({ results: [{ id: 'nbe', rows: [nbeRow()] }, { id: 'nib', rows: [old] }], previous: null, now });
    const nib = file.banks.find((b) => b.id === 'nib')!;
    expect(nib.status).toBe('unavailable');
    expect(nib.note).toMatch(/no valid rows/);
  });

  it('drops a far-off value but keeps the rest of the row', () => {
    const { file, reports } = build({ results: [{ id: 'nbe', rows: [nbeRow()] }, { id: 'cbe', rows: [cbeRow('2026-10-10', 250)] }], previous: null, now });
    const kept = file.rates.find((r) => r.bank.id === 'cbe')!;
    expect(kept.transactionalSelling).toBeUndefined();
    expect(kept.transactionalBuying).toBe(160);
    expect(reports.find((r) => r.id === 'cbe')!.dropped).toHaveLength(1);
  });

  it('uses the previous NBE rates as the anchor when NBE fails today (bad value dropped)', () => {
    const previous = prevFile([nbeRow('2026-10-09')]);
    const { file, success } = build({ results: [{ id: 'nbe', error: 'down' }, { id: 'cbe', rows: [cbeRow('2026-10-10', 250)] }], previous, now });
    expect(file.rates.find((r) => r.bank.id === 'cbe')!.transactionalSelling).toBeUndefined();
    expect(file.banks.find((b) => b.id === 'nbe')!.status).toBe('stale');
    expect(success).toBe(true); // CBE is fresh and valid
  });

  it('succeeds with CBE alone and fails when both NBE and CBE fail', () => {
    expect(build({ results: [{ id: 'nbe', error: 'x' }, { id: 'cbe', rows: [cbeRow()] }], previous: null, now }).success).toBe(true);
    expect(build({ results: [{ id: 'nbe', error: 'x' }, { id: 'cbe', error: 'y' }, { id: 'nib', rows: [nibRow()] }], previous: null, now }).success).toBe(false);
  });
});
