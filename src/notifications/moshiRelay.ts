import fs from "node:fs/promises";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __memoatoMoshiRelayStarted: boolean | undefined;
}

function outboxDir(): string {
  // Server runs with cwd = repo root (see `scripts/run_api_prod.sh`).
  return process.env.MOSHI_OUTBOX_DIR || path.join(process.cwd(), "deploy", "moshi_outbox");
}

function moshiUrl(): string {
  return process.env.MOSHI_WEBHOOK_URL || "https://api.getmoshi.app/api/webhook";
}

function token(): string {
  return process.env.MOSHI_WEBHOOK_TOKEN || "";
}

async function listQueueFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir).catch(() => []);
  return entries
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(dir, f));
}

async function readJson(filePath: string): Promise<any> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function post(title: string, message: string): Promise<void> {
  const res = await fetch(moshiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token(), title, message }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Moshi HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function tick(): Promise<void> {
  const dir = outboxDir();
  await fs.mkdir(dir, { recursive: true });
  if (!token()) return;

  const files = await listQueueFiles(dir);
  for (const f of files.slice(0, 10)) {
    try {
      const data = await readJson(f);
      const title = typeof data?.title === "string" ? data.title : "Task Update";
      const message = typeof data?.message === "string" ? data.message : "Done";
      await post(title, message);
      await fs.unlink(f);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[moshi_relay] failed: ${path.basename(f)}: ${(err as any)?.message ?? err}`);
      break; // retry later
    }
  }
}

export function startMoshiRelay(): void {
  if (globalThis.__memoatoMoshiRelayStarted) return;
  globalThis.__memoatoMoshiRelayStarted = true;

  // eslint-disable-next-line no-console
  console.log(`[moshi_relay] enabled (outbox: ${outboxDir()})`);

  const intervalMs = 4000;
  setInterval(() => {
    void tick();
  }, intervalMs);
}

