# Mesaria rates collector

A standalone Node job that reads today's exchange rates from Ethiopian banks, checks them,
and writes one file, `out/rates.json`. A GitHub Action runs it every day and publishes the
file to the `rates-data` branch, which the app downloads. The app never talks to the banks.

Sources, in priority order: NBE JSON (indicative rate), CBE JSON, then the HTML pages of
Amhara Bank, Nib, Dashen and Bank of Abyssinia. Research notes: `../docs/research/exchange-rates.md`.

## Run locally

```
pnpm install && pnpm start     # live, writes out/rates.json
pnpm test                                    # offline, uses saved fixtures
```

Needs Node 22.18 or newer (it runs the `.ts` files directly with `--experimental-strip-types`,
no build step). Only two dependencies: `cheerio` (HTML parsing) and `vitest` (dev).

Environment: `PREVIOUS_RATES` is a file path or URL of the last published `rates.json`
(default `out/rates.json`), used to keep a bank's last good rows when it fails today.
`RATES_MAX_DEVIATION` (default `0.10`) is the allowed distance from the NBE mid.

Exit code: 0 if NBE or CBE returned fresh valid rates, 1 if both failed (GitHub then emails us).
The file is still written, with stale carry-over.

## What it does

1. Fetches each source (45 s timeout, 2 retries with backoff, browser User-Agent, at most 1 request per second per host).
2. Parses it into normalised rows. A value of 0 or "No trade" means "not quoted" and is left out.
3. Validates (`src/validate.ts`) and logs the reason for every rejection:
   - `sourceDate` older than 3 days is rejected;
   - values that are not numbers, or not above zero, are rejected;
   - buying above selling for the same type is rejected;
   - a retail value (cash and transactional each compared on its own) more than 10% away from the NBE
     indicative mid for that currency is dropped; the rest of the row is kept, and the row goes only if no prices remain
     (the NBE mid comes from today's NBE rows, or yesterday's if NBE failed).
   A provider with zero valid rows counts as failed.
4. Merges with the previous file (`src/merge.ts`). A bank that failed today keeps its last good
   rows, marked `stale: true`, with their own `sourceDate`. Stale data older than 7 days is dropped
   and the bank becomes `unavailable`.

## Output schema (`schema: 1`)

```
{
  "schema": 1,
  "generatedAt": "2026-10-10T06:31:02.000Z",
  "banks": [
    { "id": "cbe", "name": "...", "nameAm": "", "status": "ok" | "stale" | "unavailable",
      "sourceDate": "2026-10-10" | null, "sourceUrl": "...", "note": "optional" }
  ],
  "rates": [
    { "bank": { "id": "cbe", "name": "...", "nameAm": "optional" }, "currency": "USD",
      "cashBuying": 160.2, "cashSelling": 163.4,
      "transactionalBuying": 160.2, "transactionalSelling": 163.4,
      "indicativeBuying": 0, "indicativeSelling": 0,   // only on NBE rows
      "sourceDate": "2026-10-10", "sourceUrl": "...", "stale": true /* only when carried over */ }
  ],
  "unavailable": [ { "id": "awash", "name": "Awash Bank", "nameAm": "", "reason": "..." } ]
}
```

Fields that a bank does not quote are absent. Cash, transactional and indicative values are
never mixed. NBE rows carry only the indicative pair. `nameAm` is filled only where we copied
the official Amharic name from the bank's own site (NBE, Nib); everywhere else it is empty.

## Add a bank

1. Add it to `BANKS` in `src/banks.ts` (id, name, page URL).
2. Create `src/providers/<id>.ts` exporting a pure `parseX(html): Row[]` (throw if the date or
   rows are missing) and a `Provider`. Copy `dashen.ts` or `nib.ts` as a template; helpers are in `src/providers/util.ts`.
3. Add it to `src/providers/index.ts`, and remove it from `UNAVAILABLE` in `src/banks.ts`.
4. Save the page to `test/fixtures/<id>.html` (strip scripts and styles) and add a test in `test/providers.test.ts`.

If a bank's server sends a broken certificate chain (Bank of Abyssinia does), add the missing
public intermediate certificate to `certs/` and list the host in `EXTRA_CA` in `src/http.ts`.
TLS checking stays on.

## Banks we cannot read yet (listed in `unavailable`)

| Bank | Why |
|---|---|
| Awash | Rates load by script with a security token; needs a headless browser |
| Zemen | Rates load by script after the page opens; no stable source found |
| Cooperative Bank of Oromia | Page takes about 40 seconds; parser not built |
| Oromia Bank, Lion International, Global Bank | Website not reachable from our server |
| Wegagen | Blocks automatic readers; parser not built |
| Hibret | Slow site, only 4 currencies; parser not built |
| Bunna, Abay | Missing rows, unclear or mixed dates; parser not built |
| Enat, Berhan, Siinqee | Static pages, parser not built yet (next candidates) |
| Addis, Ahadu, Tsehay, Hijra, ZamZam, Goh Betoch, Tsedey, Gadaa, Rammis, Shabelle | Not checked yet |

## About this repository
Public on purpose: the [Mesaria](https://github.com/AdoniasCodes) app downloads `rates.json` from the
`rates-data` branch once a day. Everything here comes from the banks' own public exchange-rate
pages. No personal data, keys or secrets live in this repository.
