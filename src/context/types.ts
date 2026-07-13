export type ContextProvider = "github" | "linear";

export type ProposedSourceClaim = {
  claimKey: string;
  kind: string;
  statement: string;
  confidence: number;
  policyVersion: string;
  validFrom?: Date | null;
  freshUntil?: Date | null;
  locator?: Record<string, unknown> | null;
  excerpt?: string | null;
};

export type ExternalSourceRecord = {
  provider: ContextProvider;
  objectType: string;
  externalId: string;
  stableKey: string;
  canonicalUrl?: string | null;
  upstreamScope: string;
  externalVersion?: string | null;
  sourceUpdatedAt?: Date | null;
  rawPayload: Record<string, unknown>;
  normalizedText: string;
  sourcePermissionVersion: number;
  proposedClaims: ProposedSourceClaim[];
};

export type ContextPacketClaim = {
  id: string;
  claimKey: string;
  kind: string;
  statement: string;
  confidence: number;
  freshUntil: Date | null;
  score: number;
  evidence: Array<{
    sourceVersionId: string;
    sourceKey: string;
    provider: string;
    objectType: string;
    canonicalUrl: string | null;
    contentHash: string;
    sourceUpdatedAt: Date | null;
    role: string;
    locator: unknown;
    excerpt: string | null;
  }>;
};

export type MemoryDiff = {
  added: Array<{ claimId: string; claimKey: string }>;
  removed: Array<{ claimId: string; claimKey: string }>;
  changed: Array<{
    claimKey: string;
    previousClaimId: string;
    claimId: string;
  }>;
  unchangedCount: number;
};
