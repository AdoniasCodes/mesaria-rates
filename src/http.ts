import { readFileSync } from 'node:fs';
import https from 'node:https';
import { rootCertificates } from 'node:tls';

// Polite HTTP: browser User-Agent, 45 s timeout, 2 retries with backoff,
// and at most one request per second per host.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const TIMEOUT_MS = 45_000;
export const RETRIES = 2;
const MIN_GAP_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lastStart = new Map<string, number>();
const queue = new Map<string, Promise<void>>();

// Serialises request starts per host so they are at least MIN_GAP_MS apart.
function throttle(host: string): Promise<void> {
  const prev = queue.get(host) ?? Promise.resolve();
  const next = prev.then(async () => {
    const wait = (lastStart.get(host) ?? 0) + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart.set(host, Date.now());
  });
  queue.set(host, next);
  return next;
}

// Some bank servers send an incomplete certificate chain (curl and browsers repair it, Node does not).
// For those hosts we add the missing public intermediate certificate, so verification stays ON.
const EXTRA_CA: Record<string, string> = {
  'www.bankofabyssinia.com': new URL('../certs/globalsign-gcc-r6-alphassl-ca-2025.pem', import.meta.url).pathname,
};

function httpsGet(url: string, caFile: string, headers: Record<string, string>): Promise<string> {
  const ca = [...rootCertificates, readFileSync(caFile, 'utf8')];
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, ca, timeout: TIMEOUT_MS }, (res) => {
      if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

export async function fetchText(url: string, opts: { backoffMs?: number } = {}): Promise<string> {
  const host = new URL(url).host;
  const backoff = opts.backoffMs ?? 2000;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(backoff * attempt * attempt);
    await throttle(host);
    try {
      const headers = { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' };
      if (EXTRA_CA[host]) return await httpsGet(url, EXTRA_CA[host], headers);
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`${url}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)} (after ${RETRIES + 1} tries)`);
}

export async function fetchJson(url: string): Promise<unknown> {
  return JSON.parse(await fetchText(url));
}
