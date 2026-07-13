import { prisma } from "wasp/server";
import { authAllowsScope, authenticateApiRequest, createRawMemoryEntry, type ApiAuthContext } from "./ingest";
import { filterMcpToolsForScopes, requiredScopeForMcpTool } from "./mcpCapabilities";
import { searchMemoryEntries, summarizeMemoryMetric } from "./query";
import { requireWorkspaceMember } from "../context/auth";
import { buildPermissionFilteredContextPacket } from "../context/packet";

type AuthContext = ApiAuthContext;

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

const memoatoLoggingSkill = `# Memoato Logging Skill

Memoato is raw-first: preserve what the user said, then attach helpful labels when you are confident.

Before creating a log through MCP:
1. Call memoato_list_categories unless you recently fetched categories in this same session.
2. Match the user's wording to existing categories by title, slug, unit, and fields.
3. If a good category exists, pass a label with categoryId, label/canonical, amount, unit, durationMinutes, or setValues.
4. If no category exists but the fact is clear, pass a label without categoryId; Memoato may create the category.
5. Keep the original text in text. Do not replace the user's raw wording with your interpretation.
6. Use tags only as lightweight context, not as authorization or identity.

Examples:
- "Zgibovi 2 2 3" with a Pull ups category: text="Zgibovi 2 2 3", labels=[{kind:"movement", categoryId:"...", label:"pull ups", canonical:"Pull ups", unit:"reps", setValues:[2,2,3], confidence:0.98}]
- "89.85 kg" with a Weight category: labels=[{kind:"metric", categoryId:"...", label:"body weight", canonical:"Weight", amount:89.85, unit:"kg", confidence:0.98}]
- "Nogomet Karepovac 21:00" with a Football category: use occurredAt for 21:00 if known and labels=[{kind:"movement", categoryId:"...", label:"football", canonical:"Football", amount:1, confidence:0.9, note:"Karepovac"}]

When unsure, send the raw text with no labels. Memoato will still save it and process it asynchronously.`;

const labelSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["movement", "metric", "energy", "context", "note"] },
    label: { type: "string", description: "Human-readable fact label, e.g. pull ups, body weight, football." },
    categoryId: { type: "string", description: "Existing Memoato category id from memoato_list_categories, when confidently matched." },
    canonical: { type: "string", description: "Canonical category/fact name, e.g. Pull ups or Weight." },
    categoryCandidates: { type: "array", items: { type: "string" } },
    amount: { type: "number" },
    unit: { type: "string", description: "Unit such as reps, kg, min, km, kcal, EUR." },
    durationMinutes: { type: "number" },
    sets: { type: "number" },
    reps: { type: "number" },
    setValues: { type: "array", items: { type: "number" }, description: "Per-set reps/values, e.g. [2,2,3]." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    note: { type: "string" },
  },
  required: ["kind", "label"],
  additionalProperties: false,
};

const tools = [
  {
    name: "memoato_logging_guide",
    description:
      "Return the Memoato logging skill/instructions. Use this before creating entries if the client has not already loaded the Memoato skill.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "memoato_list_categories",
    description:
      "List the user's current Memoato categories and units. Call this before creating labeled entries so labels match existing categories and dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional text filter for title, slug, unit, or kind." },
        take: { type: "number", minimum: 1, maximum: 250, description: "Maximum categories to return. Default 150." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "memoato_create_entry",
    description:
      "Create a raw Memoato memory entry. Memoato saves the raw entry immediately and processes labels/facts asynchronously. Prefer calling memoato_list_categories first, then pass labels when confidently matched.",
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
        labels: {
          type: "array",
          items: labelSchema,
          description:
            "Optional client-side labels/facts derived from memoato_list_categories. These reduce backend AI work and guide category matching/creation.",
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
          description: "Search text, e.g. padel, elbow, Stela, biceps curls.",
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
  {
    name: "memoato_build_context_packet",
    description:
      "Build a fresh permission-filtered context packet from human-accepted GitHub and Linear claims. Permissions and freshness are enforced before ranking.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: {
          type: "string",
          minLength: 1,
          description: "Memoato workspace id the API key owner belongs to.",
        },
        query: {
          type: "string",
          maxLength: 240,
          description: "Coding/project context question or search text.",
        },
        take: {
          type: "number",
          minimum: 1,
          maximum: 20,
          description: "Maximum accepted claims in the packet.",
        },
      },
      required: ["workspaceId", "query"],
      additionalProperties: false,
    },
  },
];

export function mcpToolsForScopes(scopes: string[]) {
  return filterMcpToolsForScopes(tools, scopes);
}

function clampTake(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function listMcpCategories(userId: string, args: Record<string, unknown>) {
  const query = normalizeText(args.query);
  const take = clampTake(args.take, 150, 250);
  const categories = await prisma.category.findMany({
    where: { userId, sourceArchivedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      unit: true,
      categoryType: true,
      chartType: true,
      period: true,
      bucketAggregation: true,
      goalDirection: true,
      fieldsSchema: true,
      kind: true,
      type: true,
      isSystem: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: 500,
  });

  return categories
    .filter((category: any) => {
      if (!query) return true;
      const haystack = normalizeText([
        category.title,
        category.slug,
        category.unit,
        category.categoryType,
        category.chartType,
        category.kind,
        JSON.stringify(category.fieldsSchema ?? null),
      ].join(" "));
      return haystack.includes(query);
    })
    .slice(0, take)
    .map((category: any) => ({
      id: category.id,
      title: category.title,
      slug: category.slug,
      unit: category.unit,
      categoryType: category.categoryType,
      chartType: category.chartType,
      period: category.period,
      bucketAggregation: category.bucketAggregation,
      goalDirection: category.goalDirection,
      fieldsSchema: Array.isArray(category.fieldsSchema) ? category.fieldsSchema : null,
      kind: category.kind,
      type: category.type,
      isSystem: category.isSystem,
    }));
}

const codexInstallerScript =
  [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'config_dir="${CODEX_HOME:-${HOME}/.codex}"',
    'config_file="${config_dir}/config.toml"',
    'mcp_url="${MEMOATO_MCP_URL:-https://api.memoato.com/mcp}"',
    'token="${MEMOATO_MCP_TOKEN:-}"',
    "",
    'if [[ -z "${token}" ]]; then',
    "  if [[ ! -r /dev/tty ]]; then",
    '    echo "Memoato API key is required. Run with MEMOATO_MCP_TOKEN=memoato_live_... or use an interactive terminal." >&2',
    "    exit 1",
    "  fi",
    '  printf "Paste Memoato API key: " > /dev/tty',
    "  IFS= read -r -s token < /dev/tty",
    '  printf "\\n" > /dev/tty',
    "fi",
    "",
    'if [[ ! "${token}" =~ ^memoato_live_[A-Za-z0-9_-]+$ ]]; then',
    '  echo "That does not look like a Memoato API key." >&2',
    "  exit 1",
    "fi",
    "",
    'mkdir -p "${config_dir}"',
    'touch "${config_file}"',
    'tmp_file="$(mktemp)"',
    "",
    "awk '",
    "  /^\\[mcp_servers\\.memoato\\]$/ { skip = 1; next }",
    "  /^\\[/ && skip { skip = 0 }",
    "  !skip { print }",
    '\' "${config_file}" > "${tmp_file}"',
    "",
    "{",
    '  cat "${tmp_file}"',
    '  printf "\\n[mcp_servers.memoato]\\n"',
    '  printf "url = \\"%s\\"\\n" "${mcp_url}"',
    '  printf "http_headers = { Authorization = \\"Bearer %s\\" }\\n" "${token}"',
    '} > "${config_file}"',
    "",
    'rm -f "${tmp_file}"',
    "",
    'skill_dir="${config_dir}/skills/memoato"',
    'mkdir -p "${skill_dir}"',
    "cat > \"${skill_dir}/SKILL.md\" <<'MEMOATO_SKILL'",
    "---",
    "name: memoato",
    "description: Use when logging to Memoato through MCP, creating raw life/training/health/money notes, searching Memoato memory, or summarizing Memoato metrics. Guides the agent to list Memoato categories first and pass client-side labels when confident.",
    "---",
    "",
    memoatoLoggingSkill,
    "MEMOATO_SKILL",
    "",
    'echo "Memoato MCP added to ${config_file}"',
    'echo "Memoato Codex skill installed to ${skill_dir}/SKILL.md"',
    'echo "Restart Codex to load the new MCP server and skill."',
  ].join("\n") + "\n";

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
  const requiredScope = requiredScopeForMcpTool(name);
  if (!requiredScope) throw new Error("unknown_tool");
  if (!authAllowsScope(auth, requiredScope)) throw new Error("forbidden");

  if (name === "memoato_logging_guide") {
    return { content: [{ type: "text", text: memoatoLoggingSkill }] };
  }

  if (name === "memoato_list_categories") {
    const result = await listMcpCategories(auth.userId, args);
    return { content: [{ type: "text", text: JSON.stringify({ count: result.length, categories: result }, null, 2) }] };
  }

  if (name === "memoato_create_entry") {
    const result = await createRawMemoryEntry({
      prisma,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      body: {
        text: args.text,
        occurredAt: args.occurredAt,
        tags: args.tags,
        labels: args.labels,
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

  if (name === "memoato_build_context_packet") {
    const workspaceId = String(args.workspaceId ?? "").trim();
    if (!workspaceId) throw new Error("workspace_required");
    const member = await requireWorkspaceMember({
      prisma,
      userId: auth.userId,
      workspaceId,
    });
    const result = await buildPermissionFilteredContextPacket({
      prisma,
      member,
      query: String(args.query ?? "").trim(),
      take: Number(args.take),
    });
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
  if (request.method === "tools/list") return rpcResult(request.id, { tools: mcpToolsForScopes(auth.scopes) });

  if (request.method === "tools/call") {
    try {
      return rpcResult(request.id, await callTool(auth, request.params));
    } catch (error) {
      const message = error instanceof Error ? error.message : "tool_error";
      const code = message === "unknown_tool" ? -32602 : message === "forbidden" ? -32003 : -32603;
      return rpcError(request.id, code, message);
    }
  }

  return rpcError(request.id, -32601, "Method not found");
}

export function addMcpRoutes(app: any): void {
  app.get("/mcp-codex", (_req: any, res: any) => {
    res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).end(codexInstallerScript);
  });

  app.options("/mcp", (_req: any, res: any) => {
    setMcpHeaders(res);
    res.status(204).end();
  });

  app.post("/mcp", async (req: any, res: any) => {
    setMcpHeaders(res);

    const auth = await authenticateApiRequest(prisma, req);
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
