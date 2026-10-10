// Entry point. Run with: node --experimental-strip-types src/run.ts  (pnpm start)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './merge.ts';
import type { ProviderResult } from './merge.ts';
import { providers } from './providers/index.ts';
import { fetchText } from './http.ts';
import type { RatesFile } from './types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'out/rates.json');

async function loadPrevious(): Promise<RatesFile | null> {
  const src = process.env.PREVIOUS_RATES || OUT;
  try {
    const text = /^https?:\/\//.test(src) ? await fetchText(src) : await readFile(src, 'utf8');
    const j = JSON.parse(text) as RatesFile;
    if (j?.schema !== 1 || !Array.isArray(j.rates)) throw new Error('not a schema 1 rates file');
    return j;
  } catch (e) {
    console.log(`No previous rates used (${src}): ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function main() {
  const previous = await loadPrevious();
  // Providers hit different hosts, so run them in parallel; each host is throttled to 1 req/s.
  const results: ProviderResult[] = await Promise.all(
    providers.map(async (p): Promise<ProviderResult> => {
      try {
        return { id: p.bank.id, rows: await p.fetchRows() };
      } catch (e) {
        return { id: p.bank.id, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  const { file, reports, success } = build({ results, previous, now: new Date() });

  console.log('\nPer-bank summary');
  for (const r of reports) {
    console.log(`  ${r.id.padEnd(8)} ${r.message}`);
    for (const j of r.rejected) console.log(`           rejected row ${j.row.currency}: ${j.reason}`);
    for (const j of r.dropped) console.log(`           dropped value ${j.row.currency}: ${j.reason}`);
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(file, null, 2) + '\n');
  console.log(`\nWrote ${OUT} (${file.rates.length} rows, ${file.unavailable.length} banks unavailable)`);
  if (!success) {
    console.error('FAIL: neither NBE nor CBE returned fresh valid rates');
    process.exitCode = 1;
  }
}

main();
