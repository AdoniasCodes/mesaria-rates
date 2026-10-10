export type BankRef = { id: string; name: string; nameAm?: string };

export type Row = {
  bank: BankRef;
  currency: string;
  cashBuying?: number;
  cashSelling?: number;
  transactionalBuying?: number;
  transactionalSelling?: number;
  indicativeBuying?: number;
  indicativeSelling?: number;
  sourceDate: string;
  sourceUrl: string;
  stale?: boolean;
};

export type BankStatus = 'ok' | 'stale' | 'unavailable';

export type BankEntry = {
  id: string;
  name: string;
  nameAm: string;
  status: BankStatus;
  sourceDate: string | null;
  sourceUrl: string;
  note?: string;
};

export type UnavailableEntry = { id: string; name: string; nameAm: string; reason: string };

export type RatesFile = {
  schema: 1;
  generatedAt: string;
  banks: BankEntry[];
  rates: Row[];
  unavailable: UnavailableEntry[];
};

export type Provider = {
  bank: BankRef;
  sourceUrl: string;
  fetchRows: () => Promise<Row[]>;
};

export const PRICE_FIELDS = [
  'cashBuying',
  'cashSelling',
  'transactionalBuying',
  'transactionalSelling',
  'indicativeBuying',
  'indicativeSelling',
] as const;
