import { prisma } from "wasp/server";
import { authenticateApiRequest, authAllowsScope } from "../memory/ingest";
import { CONTEXT_READ_SCOPE } from "../memory/apiKeys";
import { requireWorkspaceMember } from "./auth";
import { buildPermissionFilteredContextPacket } from "./packet";

function setJson(res: any) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
}

async function readJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 32 * 1024) throw new Error("body_too_large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

export function addContextRoutes(app: any) {
  app.post("/api/context/packet", async (req: any, res: any) => {
    setJson(res);
    const auth = await authenticateApiRequest(prisma, req);
    if (!auth) {
      res.status(401).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (!authAllowsScope(auth, CONTEXT_READ_SCOPE)) {
      res.status(403).end(JSON.stringify({ error: "forbidden" }));
      return;
    }
    try {
      const body = await readJsonBody(req);
      const workspaceId = String(body.workspaceId ?? "").trim();
      if (!workspaceId) throw new Error("workspace_required");
      const member = await requireWorkspaceMember({
        prisma,
        userId: auth.userId,
        workspaceId,
      });
      const packet = await buildPermissionFilteredContextPacket({
        prisma,
        member,
        query: String(body.query ?? "").trim(),
        take: Number(body.take),
      });
      res.status(200).end(JSON.stringify(packet));
    } catch (error) {
      const message = error instanceof Error ? error.message : "server_error";
      const httpStatus = Number((error as any)?.statusCode);
      const status =
        message === "workspace_required" || error instanceof SyntaxError
          ? 400
          : [403, 404].includes(httpStatus)
            ? httpStatus
            : 500;
      res.status(status).end(
        JSON.stringify({
          error: status === 500 ? "server_error" : message,
        }),
      );
    }
  });
}
