import type { ContextPacketClaim, MemoryDiff } from "./types";

export type ContextWorkspaceRecord = {
  id: string;
  name: string;
  role: string;
  type: string;
  slug?: string;
};
export type ContextConnection = {
  id: string;
  provider: string;
  displayName: string;
  status: string;
  lastSyncAt: string | Date | null;
  lastSyncError: string | null;
  _count: { objects: number };
};
export type ContextClaim = {
  id: string;
  kind: string;
  statement: string;
  freshUntil: string | Date | null;
  evidence: Array<{
    role: string;
    excerpt: string | null;
    sourceVersion: {
      contentHash: string;
      sourceUpdatedAt: string | Date | null;
      sourceObject: {
        stableKey: string;
        canonicalUrl: string | null;
        provider: string;
      };
    };
  }>;
};
export type ContextOverview = {
  workspaces: ContextWorkspaceRecord[];
  workspace: ContextWorkspaceRecord | null;
  connections: ContextConnection[];
  proposedClaims: ContextClaim[];
  counts: {
    sourceObjects: number;
    sourceVersions: number;
    acceptedClaims: number;
  };
  providers: { githubConfigured: boolean; linearConfigured: boolean };
};
export type ContextPacketView = {
  id: string;
  traceId: string;
  packetHash: string;
  permissionSnapshotHash: string;
  content: {
    query: string;
    workspace: { id: string; name: string };
    claims: ContextPacketClaim[];
    freshness: { generatedAt: string; freshUntil: string | null };
    exclusions: { stale: number; permission: number };
  };
  diff: MemoryDiff;
};

export function contextDate(value: string | Date | null): string {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
export function sourceUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function contextCount(value: number, singular: string): string {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}
