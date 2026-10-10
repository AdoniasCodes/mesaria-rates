import type { BankRef, UnavailableEntry } from './types.ts';

// Amharic names: only where copied from the bank's own site (nibbanksc.com, nbe.gov.et).
// Everything else stays empty on purpose. Never invent Amharic.
export const BANKS: Record<string, BankRef & { url: string }> = {
  nbe: { id: 'nbe', name: 'National Bank of Ethiopia', nameAm: 'የኢትዮጵያ ብሔራዊ ባንክ', url: 'https://api.nbe.gov.et/api/get-exchange-rates' },
  cbe: { id: 'cbe', name: 'Commercial Bank of Ethiopia', url: 'https://combanketh.et/cbeapi/daily-exchange-rates' },
  amhara: { id: 'amhara', name: 'Amhara Bank', url: 'https://www.amharabank.com.et/daily-exchange-rate/' },
  nib: { id: 'nib', name: 'Nib International Bank', nameAm: 'ንብ ኢንተርናሽናል ባንክ', url: 'https://www.nibbanksc.com/' },
  dashen: { id: 'dashen', name: 'Dashen Bank', url: 'https://dashenbanksc.com/daily-exchange-rates/' },
  boa: { id: 'boa', name: 'Bank of Abyssinia', url: 'https://www.bankofabyssinia.com/exchange-rate-2/' },
};

const u = (id: string, name: string, reason: string): UnavailableEntry => ({ id, name, nameAm: '', reason });

// Banks we cannot read yet. The app lists them as "not available yet".
export const UNAVAILABLE: UnavailableEntry[] = [
  u('awash', 'Awash Bank', 'Rates load by script with a security token; needs a headless browser'),
  u('zemen', 'Zemen Bank', 'Rates load by script after the page opens; no stable source found'),
  u('coopbankoromia', 'Cooperative Bank of Oromia', 'Page takes about 40 seconds to answer; parser not built yet'),
  u('oromia', 'Oromia Bank', 'Website not reachable from our server'),
  u('wegagen', 'Wegagen Bank', 'Website blocks automatic readers; parser not built yet'),
  u('hibret', 'Hibret Bank', 'Slow site and only 4 currencies; parser not built yet'),
  u('bunna', 'Bunna Bank', 'Table has missing rows and no clear date; parser not built yet'),
  u('abay', 'Abay Bank', 'Two tables with different dates and gaps; parser not built yet'),
  u('enat', 'Enat Bank', 'Rates sit in tabs; parser not built yet'),
  u('berhan', 'Berhan Bank', 'Parser not built yet (no cash and transaction split on the page)'),
  u('siinqee', 'Siinqee Bank', 'Parser not built yet'),
  u('lion', 'Lion International Bank', 'Website not reachable from our server'),
  u('global', 'Global Bank Ethiopia', 'Website not reachable from our server'),
  u('addis', 'Addis International Bank', 'Not checked yet'),
  u('ahadu', 'Ahadu Bank', 'Not checked yet'),
  u('tsehay', 'Tsehay Bank', 'Not checked yet'),
  u('hijra', 'Hijra Bank', 'Not checked yet'),
  u('zamzam', 'ZamZam Bank', 'Not checked yet'),
  u('gohbetoch', 'Goh Betoch Bank', 'Not checked yet'),
  u('tsedey', 'Tsedey Bank', 'Not checked yet'),
  u('gadaa', 'Gadaa Bank', 'Not checked yet'),
  u('rammis', 'Rammis Bank', 'Not checked yet'),
  u('shabelle', 'Shabelle Bank', 'Not checked yet'),
];
