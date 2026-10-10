import type { Provider } from '../types.ts';
import { amhara } from './amhara.ts';
import { boa } from './boa.ts';
import { cbe } from './cbe.ts';
import { dashen } from './dashen.ts';
import { nbe } from './nbe.ts';
import { nib } from './nib.ts';

// Priority order. To add a bank: write src/providers/<id>.ts, add it to BANKS in
// src/banks.ts, list it here, and remove it from UNAVAILABLE.
export const providers: Provider[] = [nbe, cbe, amhara, nib, dashen, boa];
