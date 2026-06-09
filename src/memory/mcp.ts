import { prisma } from "wasp/server";
import { authenticateRawEntryRequest, createRawMemoryEntry } from "./ingest";
import { searchMemoryEntries, summarizeMemoryMetric } from "./query";

type AuthContext = {
  userId: string;
  apiKeyId: string | null;
};

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

const PROTOCOL_VERSION = "2025-11-25";

const periodSchema = {
  type: "string",
  enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "last_7_days", "last_30_days"],
};

const tools = [
  {
    name: "memoato_create_entry",
    description:
      "Create a raw Memoato memory entry. Use this for low-friction life logs such as workouts, symptoms, sleep, errands, money notes, and contextual observations.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          minLength: 1,
          maxLength: 4000,
          description: "Raw natural-language log text to store in Memoato.",
        },
        occurredAt: {
          type: "string",
          description: "Optional ISO timestamp for when the event occurred. Defaults to server time.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional lightweight tags.",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "memoato_search_entries",
    description:
      "Search Memoato entries and parsed facts. Use this to answer recall questions such as when something happened, when pain appeared, or when a person/activity was mentioned.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          minLength: 1,
          maxLength: 200,
          description: "Search text, e.g. padel, elbow, Example child, biceps curls.",
        },
        from: { type: "string", description: "Optional ISO start timestamp/date." },
        to: { type: "string", description: "Optional ISO end timestamp/date." },
        period: {
          ...periodSchema,
          description: "Optional date preset. Ignored where explicit from/to is more specific.",
        },
        take: {
          type: "number",
          minimum: 1,
          maximum: 50,
          description: "Maximum entries to return. Default 20.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "memoato_summarize_metric",
    description:
      "Summarize a Memoato metric/activity over a date range. Use this for questions like how many push-ups last month or total pull-ups this week.",
    inputSchema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          minLength: 1,
          maxLength: 120,
          description: "Metric/activity/category to summarize, e.g. push ups, pull ups, weight, football.",
        },
        from: { type: "string", description: "Optional ISO start timestamp/date." },
        to: { type: "string", description: "Optional ISO end timestamp/date." },
        period: {
          ...periodSchema,
          description: "Date preset. Defaults to last_30_days if from/to are omitted.",
        },
      },
      required: ["metric"],
      additionalProperties: false,
    },
  },
];

function setMcpHeaders(res: any): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id");
}

async function readJsonBody(req: any): Promise<unknown> {
  if (req.body && typeof req.body === "object") return req.body;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 64 * 1024) throw new Error("body_too_large");
    chunks.push(buf);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("missing_body");
  return JSON.parse(text);
}

function isNotification(request: JsonRpcRequest): boolean {
  return !Object.prototype.hasOwnProperty.call(request, "id");
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function argsObject(params: unknown): Record<string, unknown> {
  const args = params && typeof params === "object" && !Array.isArray(params) ? (params as any).arguments : null;
  return args && typeof args === "object" && !Array.isArray(args) ? args : {};
}

async function callTool(auth: AuthContext, params: unknown): Promise<unknown> {
  const name = params && typeof params === "object" && !Array.isArray(params) ? String((params as any).name ?? "") : "";
  const args = argsObject(params);

  if (name === "memoato_create_entry") {
    const result = await createRawMemoryEntry({
      prisma,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      body: {
        text: args.text,
        occurredAt: args.occurredAt,
        tags: args.tags,
        source: "mcp",
      },
    });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (name === "memoato_search_entries") {
    const result = await searchMemoryEntries({ prisma, userId: auth.userId, body: args });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (name === "memoato_summarize_metric") {
    const result = await summarizeMemoryMetric({ prisma, userId: auth.userId, body: args });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  throw new Error("unknown_tool");
}

async function handleRpcRequest(auth: AuthContext, request: JsonRpcRequest): Promise<unknown | null> {
  if (typeof request.method !== "string") return rpcError(request.id, -32600, "Invalid request");
  if (isNotification(request)) return null;

  if (request.method === "initialize") {
    const requestedVersion =
      request.params && typeof request.params === "object" && !Array.isArray(request.params)
        ? (request.params as any).protocolVersion
        : null;

    return rpcResult(request.id, {
      protocolVersion: typeof requestedVersion === "string" && requestedVersion.trim() ? requestedVersion : PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "memoato", version: "0.1.0" },
    });
  }

  if (request.method === "ping") return rpcResult(request.id, {});
  if (request.method === "tools/list") return rpcResult(request.id, { tools });

  if (request.method === "tools/call") {
    try {
      return rpcResult(request.id, await callTool(auth, request.params));
    } catch (error) {
      const message = error instanceof Error ? error.message : "tool_error";
      const code = message === "unknown_tool" ? -32602 : -32603;
      return rpcError(request.id, code, message);
    }
  }

  return rpcError(request.id, -32601, "Method not found");
}

export function addMcpRoutes(app: any): void {
  app.options("/mcp", (_req: any, res: any) => {
    setMcpHeaders(res);
    res.status(204).end();
  });

  app.post("/mcp", async (req: any, res: any) => {
    setMcpHeaders(res);

    const auth = await authenticateRawEntryRequest(prisma, req);
    if (!auth) {
      res.setHeader("WWW-Authenticate", "Bearer realm=\"memoato\"");
      res.status(401).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    try {
      const body = await readJsonBody(req);
      const requests = Array.isArray(body) ? body : [body];
      const responses: unknown[] = [];

      for (const request of requests) {
        if (!request || typeof request !== "object" || Array.isArray(request)) {
          responses.push(rpcError(null, -32600, "Invalid request"));
          continue;
        }

        const response = await handleRpcRequest(auth, request as JsonRpcRequest);
        if (response) responses.push(response);
      }

      if (responses.length === 0) {
        res.status(202).end("");
        return;
      }

      res.status(200).end(JSON.stringify(Array.isArray(body) ? responses : responses[0]));
    } catch (error) {
      const message = error instanceof SyntaxError ? "Parse error" : error instanceof Error ? error.message : "Internal error";
      const code = error instanceof SyntaxError ? -32700 : -32603;
      res.status(400).end(JSON.stringify(rpcError(null, code, message)));
    }
  });
}
