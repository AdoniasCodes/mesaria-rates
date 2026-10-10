import { describe, expect, it } from 'vitest';
import { checkRow, nbeMids, pruneDeviant, validateRows } from '../src/validate.ts';
import type { Row } from '../src/types.ts';

const bank = { id: 'cbe', name: 'CBE' };
const row = (o: Partial<Row> = {}): Row => ({ bank, currency: 'USD', transactionalBuying: 160, transactionalSelling: 163, sourceDate: '2026-10-10', sourceUrl: 'x', ...o });
const mids = nbeMids([{ bank: { id: 'nbe', name: 'NBE' }, currency: 'USD', indicativeBuying: 160, indicativeSelling: 162, sourceDate: '2026-10-09', sourceUrl: 'x' }]);
const TODAY = '2026-10-10';

describe('validate', () => {
  it('accepts a good row', () => expect(checkRow(row(), TODAY)).toBeNull());
  it('rejects rows older than 3 days, accepts exactly 3', () => {
    expect(checkRow(row({ sourceDate: '2026-10-06' }), TODAY)).toMatch(/4 days old/);
    expect(checkRow(row({ sourceDate: '2026-10-07' }), TODAY)).toBeNull();
  });
  it('rejects non-numeric, zero and negative values', () => {
    expect(checkRow(row({ transactionalBuying: NaN }), TODAY)).toMatch(/not a number/);
    expect(checkRow(row({ transactionalBuying: 0 }), TODAY)).toMatch(/not positive/);
    expect(checkRow(row({ transactionalBuying: -5 }), TODAY)).toMatch(/not positive/);
    expect(checkRow(row({ transactionalBuying: '160' as any }), TODAY)).toMatch(/not a number/);
  });
  it('rejects rows with no prices', () => {
    expect(checkRow(row({ transactionalBuying: undefined, transactionalSelling: undefined }), TODAY)).toMatch(/no price/);
  });
  it('rejects buying above selling for the same type', () => {
    expect(checkRow(row({ transactionalBuying: 164, transactionalSelling: 163 }), TODAY)).toMatch(/above/);
    expect(checkRow(row({ cashBuying: 170, cashSelling: 163 }), TODAY)).toMatch(/cashBuying/);
  });
  it('keeps EUR cash selling 191 when the NBE mid is 181.2 (5.4% away, inside 10%)', () => {
    const eurMids = new Map([['EUR', 181.2]]);
    const r = row({ currency: 'EUR', cashBuying: 187, cashSelling: 191, transactionalBuying: undefined, transactionalSelling: undefined });
    const { valid, dropped } = validateRows([r], TODAY, eurMids);
    expect(dropped).toHaveLength(0);
    expect(valid[0].cashSelling).toBe(191);
  });
  it('drops a single out-of-range field but keeps the row', () => {
    const r = row({ cashBuying: 160, cashSelling: 163, transactionalBuying: 160, transactionalSelling: 250 });
    const { valid, rejected, dropped } = validateRows([r], TODAY, mids);
    expect(rejected).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/transactionalSelling.*NBE mid/);
    expect(valid[0].transactionalSelling).toBeUndefined();
    expect(valid[0]).toMatchObject({ cashBuying: 160, cashSelling: 163, transactionalBuying: 160 });
  });
  it('drops the row when every price is out of range', () => {
    const { valid, rejected } = validateRows([row({ transactionalBuying: 300, transactionalSelling: 310 })], TODAY, mids);
    expect(valid).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/out of range/);
  });
  it('skips the NBE check when there is no NBE rate for the currency', () => {
    expect(pruneDeviant(row({ currency: 'XXX', transactionalSelling: 999 }), mids).dropped).toHaveLength(0);
  });
  it('does not apply the NBE check to NBE rows themselves', () => {
    const r: Row = { bank: { id: 'nbe', name: 'NBE' }, currency: 'USD', indicativeBuying: 300, indicativeSelling: 301, sourceDate: TODAY, sourceUrl: 'x' };
    expect(pruneDeviant(r, mids).dropped).toHaveLength(0);
  });
  it('splits valid and rejected with reasons', () => {
    const { valid, rejected } = validateRows([row(), row({ transactionalBuying: 0 })], TODAY, mids);
    expect(valid).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/positive/);
  });
});
