import { prisma } from "wasp/server";
import { authAllowsScope, authenticateApiRequest, createRawMemoryEntry } from "./ingest";
import { MEMORY_READ_SCOPE, RAW_ENTRY_WRITE_SCOPE } from "./apiKeys";
import { searchMemoryEntries, summarizeMemoryMetric } from "./query";

function setJson(res: any): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

function statusForError(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "invalid_body" || message === "missing_text" || message === "text_too_long") return 400;
  if (message === "missing_metric") return 400;
  if (error instanceof SyntaxError) return 400;
  if (message === "ingest_user_not_configured") return 503;
  return 500;
}

async function readJsonBody(req: any): Promise<unknown> {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 32 * 1024) throw new Error("text_too_long");
    chunks.push(buf);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}

export function addMemoryIngestRoutes(app: any): void {
  app.post("/api/raw-entry", async (req: any, res: any) => {
    setJson(res);

    const auth = await authenticateApiRequest(prisma, req);
    if (!auth) {
      res.status(401).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (!authAllowsScope(auth, RAW_ENTRY_WRITE_SCOPE)) {
      res.status(403).end(JSON.stringify({ error: "forbidden" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await createRawMemoryEntry({ prisma, body, userId: auth.userId, apiKeyId: auth.apiKeyId });
      res.status(201).end(JSON.stringify(result));
    } catch (error) {
      const status = statusForError(error);
      const code = error instanceof SyntaxError ? "invalid_json" : error instanceof Error ? error.message : "server_error";
      res.status(status).end(JSON.stringify({ error: status === 500 ? "server_error" : code || "invalid_json" }));
    }
  });

  app.post("/api/memory/search", async (req: any, res: any) => {
    setJson(res);

    const auth = await authenticateApiRequest(prisma, req);
    if (!auth) {
      res.status(401).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (!authAllowsScope(auth, MEMORY_READ_SCOPE)) {
      res.status(403).end(JSON.stringify({ error: "forbidden" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await searchMemoryEntries({ prisma, userId: auth.userId, body });
      res.status(200).end(JSON.stringify(result));
    } catch (error) {
      const status = statusForError(error);
      const code = error instanceof SyntaxError ? "invalid_json" : error instanceof Error ? error.message : "server_error";
      res.status(status).end(JSON.stringify({ error: status === 500 ? "server_error" : code || "invalid_json" }));
    }
  });

  app.post("/api/memory/summary", async (req: any, res: any) => {
    setJson(res);

    const auth = await authenticateApiRequest(prisma, req);
    if (!auth) {
      res.status(401).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (!authAllowsScope(auth, MEMORY_READ_SCOPE)) {
      res.status(403).end(JSON.stringify({ error: "forbidden" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = await summarizeMemoryMetric({ prisma, userId: auth.userId, body });
      res.status(200).end(JSON.stringify(result));
    } catch (error) {
      const status = statusForError(error);
      const code = error instanceof SyntaxError ? "invalid_json" : error instanceof Error ? error.message : "server_error";
      res.status(status).end(JSON.stringify({ error: status === 500 ? "server_error" : code || "invalid_json" }));
    }
  });
}
