import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_API_ORIGIN = "https://api.memoato.com";

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function apiOrigin(): string {
  return (env("MEMOATO_API_ORIGIN") || DEFAULT_API_ORIGIN).replace(/\/+$/, "");
}

async function postRawEntry(args: {
  text: string;
  occurredAt?: string;
  source?: string;
  tags?: string[];
}) {
  return postMemoatoJson("/api/raw-entry", {
    text: args.text,
    occurredAt: args.occurredAt,
    source: args.source || "mcp",
    tags: args.tags ?? [],
  });
}

async function postMemoatoJson(path: string, payload: unknown) {
  const token = env("MEMOATO_MCP_TOKEN");
  if (!token) {
    throw new Error("MEMOATO_MCP_TOKEN is not configured.");
  }

  const res = await fetch(`${apiOrigin()}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Memoato MCP/0.1",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await res.text();
  let body: unknown = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  if (!res.ok) {
    throw new Error(`Memoato request failed (${res.status}): ${bodyText}`);
  }

  return body;
}

const server = new McpServer({
  name: "memoato",
  version: "0.1.0",
});

server.tool(
  "memoato_create_entry",
  "Create a raw Memoato memory entry. Use this for low-friction life logs such as workouts, symptoms, sleep, errands, money notes, and contextual observations.",
  {
    text: z.string().min(1).max(4000).describe("Raw natural-language log text to store in Memoato."),
    occurredAt: z
      .string()
      .optional()
      .describe("Optional ISO timestamp for when the event occurred. Defaults to server time."),
    tags: z.array(z.string()).optional().describe("Optional lightweight tags."),
  },
  async ({ text, occurredAt, tags }) => {
    const result = await postRawEntry({ text, occurredAt, tags, source: "mcp" });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "memoato_search_entries",
  "Search Memoato entries and parsed facts. Use this to answer recall questions such as when something happened, when pain appeared, or when a person/activity was mentioned.",
  {
    query: z.string().min(1).max(200).describe("Search text, e.g. padel, elbow, Stela, biceps curls."),
    from: z.string().optional().describe("Optional ISO start timestamp/date."),
    to: z.string().optional().describe("Optional ISO end timestamp/date."),
    period: z
      .enum(["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "last_7_days", "last_30_days"])
      .optional()
      .describe("Optional date preset. Ignored where explicit from/to is more specific."),
    take: z.number().int().min(1).max(50).optional().describe("Maximum entries to return. Default 20."),
  },
  async ({ query, from, to, period, take }) => {
    const result = await postMemoatoJson("/api/memory/search", { query, from, to, period, take });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "memoato_summarize_metric",
  "Summarize a Memoato metric/activity over a date range. Use this for questions like how many push-ups last month or total pull-ups this week.",
  {
    metric: z.string().min(1).max(120).describe("Metric/activity/category to summarize, e.g. push ups, pull ups, weight, football."),
    from: z.string().optional().describe("Optional ISO start timestamp/date."),
    to: z.string().optional().describe("Optional ISO end timestamp/date."),
    period: z
      .enum(["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "last_7_days", "last_30_days"])
      .optional()
      .describe("Date preset. Defaults to last_30_days if from/to are omitted."),
  },
  async ({ metric, from, to, period }) => {
    const result = await postMemoatoJson("/api/memory/summary", { metric, from, to, period });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
