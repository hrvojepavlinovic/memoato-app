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
  const token = env("MEMOATO_MCP_TOKEN");
  if (!token) {
    throw new Error("MEMOATO_MCP_TOKEN is not configured.");
  }

  const res = await fetch(`${apiOrigin()}/api/raw-entry`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      text: args.text,
      occurredAt: args.occurredAt,
      source: args.source || "mcp",
      tags: args.tags ?? [],
    }),
  });

  const bodyText = await res.text();
  let body: unknown = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  if (!res.ok) {
    throw new Error(`Memoato raw-entry request failed (${res.status}): ${bodyText}`);
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

