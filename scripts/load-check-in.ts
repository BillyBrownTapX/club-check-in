/**
 * Load harness for the public student check-in flow.
 *
 * Purpose:
 *   Prove the shared-NAT venue design (see src/lib/rate-limit.server.ts)
 *   holds by firing 100–200 concurrent first-time check-ins against a
 *   configured event QR and reporting latency, success, and rate-limit
 *   outcomes.
 *
 * Rate-limit reference (register scope — first-time check-ins):
 *   • per-IP: 80 / 60s
 *   • global per-QR: 400 / 60s
 *   In `burst` at concurrency 150 from one IP some 429s are EXPECTED;
 *   `venue` mode retries with jitter to model a real room reaching 100%.
 *
 * Safety:
 *   • Refuses production hosts unless --confirmProduction is passed.
 *   • Refuses concurrency > 200.
 *   • Prints a loud banner before firing.
 *   • Does not log full emails / 900 numbers / tokens — only counts.
 *   • Does not delete anything. Synthetic rows must be cleaned up by a
 *     human using the SELECT examples in docs/load-test.md.
 *
 * Usage:
 *   bun run load:check-in -- \
 *     --baseUrl https://id-preview--<uuid>.lovable.app \
 *     --qrToken <qrToken from /check-in/$qrToken> \
 *     --concurrency 150 \
 *     --scenario venue
 */

type Scenario = "burst" | "venue";

type Args = {
  baseUrl: string;
  qrToken: string;
  concurrency: number;
  total: number;
  scenario: Scenario;
  emailDomain: string;
  idPrefix: string;
  confirmProduction: boolean;
};

type Outcome =
  | "ok"
  | "already_checked_in"
  | "other_blocked"
  | "rate_limited"
  | "http_5xx"
  | "network_error";

type WorkerResult = {
  outcome: Outcome;
  latencyMs: number;
  attempts: number;
  status: number | null;
  state?: string;
};

const PRODUCTION_HOSTS = new Set([
  "attendance-hq.com",
  "www.attendance-hq.com",
  "checkin-swiftly.lovable.app",
]);

const HARD_MAX_CONCURRENCY = 200;

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      map.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }

  const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;
  const baseUrl = map.get("baseUrl") ?? env.LOAD_BASE_URL ?? "";
  const qrToken = map.get("qrToken") ?? env.LOAD_QR_TOKEN ?? "";
  const concurrency = clampInt(map.get("concurrency") ?? env.LOAD_CONCURRENCY ?? "150", 1, HARD_MAX_CONCURRENCY);
  const totalRaw = map.get("total") ?? env.LOAD_TOTAL;
  const total = totalRaw ? Math.max(concurrency, parseInt(totalRaw, 10) || concurrency) : concurrency;
  const scenarioRaw = (map.get("scenario") ?? env.LOAD_SCENARIO ?? "burst").toLowerCase();
  const scenario: Scenario = scenarioRaw === "venue" ? "venue" : "burst";
  const emailDomain = map.get("emailDomain") ?? env.LOAD_EMAIL_DOMAIN ?? "ung.edu";
  const idPrefix = map.get("idPrefix") ?? env.LOAD_ID_PREFIX ?? "891";
  const confirmProduction = flags.has("confirmProduction") || env.LOAD_CONFIRM_PRODUCTION === "1";

  return { baseUrl, qrToken, concurrency, total, scenario, emailDomain, idPrefix, confirmProduction };
}

function clampInt(raw: string, min: number, max: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function die(message: string, code = 2): never {
  console.error(`\n[load-check-in] ${message}\n`);
  process.exit(code);
}

function assertConfig(args: Args) {
  if (!args.baseUrl) die("--baseUrl (or LOAD_BASE_URL) is required.");
  if (!args.qrToken) die("--qrToken (or LOAD_QR_TOKEN) is required.");
  if (args.concurrency < 1 || args.concurrency > HARD_MAX_CONCURRENCY) {
    die(`concurrency must be between 1 and ${HARD_MAX_CONCURRENCY}.`);
  }
  let host: string;
  try {
    host = new URL(args.baseUrl).host.toLowerCase();
  } catch {
    die(`--baseUrl is not a valid URL: ${args.baseUrl}`);
  }
  if (PRODUCTION_HOSTS.has(host) && !args.confirmProduction) {
    die(
      `Refusing to load-test production host "${host}" without --confirmProduction. ` +
        `Prefer the preview URL for write load. See docs/load-test.md.`,
    );
  }
}

function makeRunId(): string {
  const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
  return `${Date.now().toString(36)}-${rnd}`;
}

function makeNineHundred(prefix: string, i: number, runSeed: number): string {
  // Deterministic-per-run 9-digit id: prefix (3) + 6 digits derived from
  // (runSeed + i). Collisions across parallel runs are avoided by the
  // random runSeed.
  const trimmed = prefix.replace(/\D/g, "").slice(0, 3).padEnd(3, "8");
  const rest = ((runSeed + i * 1_000_003) % 1_000_000).toString().padStart(6, "0");
  return `${trimmed}${rest}`;
}

function shortHash(input: string): string {
  // Non-crypto FNV-1a-ish fold, good enough for a redaction id in logs.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function jitter(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

async function delay(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function classify(status: number | null, body: unknown): Omit<WorkerResult, "latencyMs" | "attempts"> {
  if (status === null) return { outcome: "network_error", status: null };
  if (status === 429) return { outcome: "rate_limited", status };
  if (status >= 500) return { outcome: "http_5xx", status };
  const b = (body ?? {}) as { ok?: boolean; state?: string };
  if (b.ok === true) return { outcome: "ok", status, state: "ok" };
  if (b.state === "already_checked_in") return { outcome: "already_checked_in", status, state: b.state };
  return { outcome: "other_blocked", status, state: b.state };
}

async function fireOnce(url: string, body: unknown): Promise<{ status: number | null; json: unknown; ms: number }> {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON body — ignore, status alone drives classification */
    }
    return { status: res.status, json: parsed, ms: performance.now() - started };
  } catch {
    return { status: null, json: null, ms: performance.now() - started };
  }
}

async function runWorker(args: Args, runId: string, runSeed: number, i: number): Promise<WorkerResult> {
  const url = `${args.baseUrl.replace(/\/+$/, "")}/api/public/student-check-in`;
  const body = {
    qrToken: args.qrToken,
    firstName: "Load",
    lastName: `Test${i}`,
    studentEmail: `loadtest+${runId}-${i}@${args.emailDomain}`,
    nineHundredNumber: makeNineHundred(args.idPrefix, i, runSeed),
    rememberDevice: false,
  };

  // burst = single shot. venue = up to 3 retries on 429 with jitter.
  const maxAttempts = args.scenario === "venue" ? 3 : 1;
  let attempts = 0;
  let last: { status: number | null; json: unknown; ms: number } = { status: null, json: null, ms: 0 };
  let totalMs = 0;

  // venue mode: small pre-jitter so 150 workers don't hit t=0 exactly.
  if (args.scenario === "venue") await delay(jitter(0, 500));

  while (attempts < maxAttempts) {
    attempts++;
    last = await fireOnce(url, body);
    totalMs += last.ms;
    if (last.status !== 429) break;
    if (attempts >= maxAttempts) break;
    await delay(jitter(250, 1500));
  }

  const cls = classify(last.status, last.json);
  return { ...cls, latencyMs: totalMs, attempts };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

function banner(args: Args) {
  const host = (() => {
    try {
      return new URL(args.baseUrl).host;
    } catch {
      return args.baseUrl;
    }
  })();
  const isProd = PRODUCTION_HOSTS.has(host.toLowerCase());
  const bar = "=".repeat(60);
  console.log(`\n${bar}`);
  console.log(`  LOAD TEST — public student check-in`);
  console.log(`  target host   : ${host}${isProd ? "  [PRODUCTION]" : ""}`);
  console.log(`  scenario      : ${args.scenario}`);
  console.log(`  concurrency   : ${args.concurrency}`);
  console.log(`  total workers : ${args.total}`);
  console.log(`  qrToken hash  : ${shortHash(args.qrToken)} (raw not logged)`);
  console.log(`  email domain  : ${args.emailDomain}`);
  console.log(`  900 prefix    : ${args.idPrefix}xxxxxx`);
  console.log(`${bar}\n`);
  console.log("Register rate limits in effect:");
  console.log("  per-IP  : 80 / 60s");
  console.log("  per-QR  : 400 / 60s (global)");
  console.log("A burst at concurrency > 80 from one IP will produce 429s by design.\n");
}

async function runAll(args: Args): Promise<WorkerResult[]> {
  const runId = makeRunId();
  const runSeed = Math.floor(Math.random() * 1_000_000);
  const results: WorkerResult[] = [];
  const queue: number[] = Array.from({ length: args.total }, (_, i) => i);
  let inFlight = 0;
  let idx = 0;

  return await new Promise<WorkerResult[]>((resolve) => {
    const tick = () => {
      while (inFlight < args.concurrency && idx < queue.length) {
        const i = queue[idx++]!;
        inFlight++;
        runWorker(args, runId, runSeed, i)
          .then((r) => results.push(r))
          .catch(() => results.push({ outcome: "network_error", latencyMs: 0, attempts: 1, status: null }))
          .finally(() => {
            inFlight--;
            if (results.length === queue.length) resolve(results);
            else tick();
          });
      }
    };
    tick();
  });
}

function report(args: Args, results: WorkerResult[], wallMs: number) {
  const totals: Record<Outcome, number> = {
    ok: 0,
    already_checked_in: 0,
    other_blocked: 0,
    rate_limited: 0,
    http_5xx: 0,
    network_error: 0,
  };
  for (const r of results) totals[r.outcome]++;

  const okLatencies = results.filter((r) => r.outcome === "ok").map((r) => r.latencyMs).sort((a, b) => a - b);

  const bar = "-".repeat(60);
  console.log(`\n${bar}`);
  console.log(`  RESULTS`);
  console.log(bar);
  console.log(`  wall clock          : ${(wallMs / 1000).toFixed(2)} s`);
  console.log(`  total requests      : ${results.length}`);
  console.log(`  ok                  : ${totals.ok}`);
  console.log(`  already_checked_in  : ${totals.already_checked_in}`);
  console.log(`  other_blocked       : ${totals.other_blocked}`);
  console.log(`  rate_limited (429)  : ${totals.rate_limited}`);
  console.log(`  http_5xx            : ${totals.http_5xx}`);
  console.log(`  network_error       : ${totals.network_error}`);
  console.log(bar);
  console.log(`  ok latency p50      : ${percentile(okLatencies, 50)} ms`);
  console.log(`  ok latency p95      : ${percentile(okLatencies, 95)} ms`);
  console.log(`  ok latency max      : ${okLatencies.length ? Math.round(okLatencies[okLatencies.length - 1]!) : 0} ms`);
  console.log(bar);

  if (args.scenario === "burst" && totals.rate_limited > 0) {
    console.log(
      `  note: ${totals.rate_limited} rate-limited responses are EXPECTED in burst mode\n` +
        `        when concurrency exceeds the per-IP 80/60s register budget.\n` +
        `        Re-run with --scenario venue to model retries.`,
    );
  }

  const failureShare = (totals.http_5xx + totals.network_error) / Math.max(1, results.length);
  if (args.scenario === "venue" && failureShare > 0.1) {
    console.error(
      `\n  FAIL: venue-mode 5xx/network share ${(failureShare * 100).toFixed(1)}% exceeds 10%. ` +
        `Investigate — this is a real outage signal, not a rate-limit artifact.`,
    );
    process.exit(1);
  }

  console.log("\nCleanup: synthetic rows use loadtest+*@<domain> emails and 900 numbers");
  console.log("with your --idPrefix. See docs/load-test.md for SELECT examples.");
  console.log(`Run id (for filtering): ${shortHash(String(wallMs) + String(results.length))}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertConfig(args);
  banner(args);
  const started = performance.now();
  const results = await runAll(args);
  report(args, results, performance.now() - started);
}

main().catch((err) => {
  console.error("[load-check-in] fatal:", (err as Error)?.message);
  process.exit(2);
});
