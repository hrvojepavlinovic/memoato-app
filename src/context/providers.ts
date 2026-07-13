import { CONNECTOR_CLAIM_POLICY_VERSION, CONTEXT_SYNC_LIMIT } from "./policy";
import type {
  ContextProvider,
  ExternalSourceRecord,
  ProposedSourceClaim,
} from "./types";

type FetchLike = typeof fetch;

const GITHUB_API = "https://api.github.com";
const LINEAR_API = "https://api.linear.app/graphql";
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_FRESH_DAYS = 7;

export class ContextProviderError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "ContextProviderError";
  }
}

function cleanString(value: unknown, max = 240): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function cleanList(value: unknown, max = 20): string[] {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  return Array.from(
    new Set(input.map((item) => cleanString(item, 120)).filter(Boolean)),
  ).slice(0, max);
}

function boundedTake(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return CONTEXT_SYNC_LIMIT;
  return Math.max(1, Math.min(CONTEXT_SYNC_LIMIT, Math.floor(parsed)));
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function freshUntil(sourceUpdatedAt: Date | null): Date {
  const base = sourceUpdatedAt?.getTime() ?? Date.now();
  return new Date(base + DEFAULT_FRESH_DAYS * 24 * 60 * 60_000);
}

function excerpt(value: unknown): string | null {
  const text = cleanString(value, 500);
  return text || null;
}

function providerCredential(
  provider: ContextProvider,
  credentialRef: unknown,
): string {
  const expected =
    provider === "github"
      ? "env:GITHUB_CONTEXT_TOKEN"
      : "env:LINEAR_CONTEXT_API_KEY";
  if (credentialRef !== expected) {
    throw new ContextProviderError("credential_ref_not_allowed");
  }
  const value =
    provider === "github"
      ? process.env.GITHUB_CONTEXT_TOKEN
      : process.env.LINEAR_CONTEXT_API_KEY;
  if (!value?.trim()) {
    throw new ContextProviderError(`${provider}_credential_not_configured`);
  }
  return value.trim();
}

export type GitHubConnectionConfig = {
  organization: string;
  repositories: string[];
  takePerRepository: number;
};

export type LinearConnectionConfig = {
  teamId: string;
  teamName: string;
  take: number;
};

export function normalizeGitHubConfig(value: unknown): GitHubConnectionConfig {
  const config =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const organization = cleanString(config.organization, 120);
  const repositories = cleanList(config.repositories, 20);
  if (!organization || repositories.length === 0) {
    throw new ContextProviderError("github_scope_required");
  }
  return {
    organization,
    repositories,
    takePerRepository: boundedTake(config.takePerRepository),
  };
}

export function normalizeLinearConfig(value: unknown): LinearConnectionConfig {
  const config =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const teamId = cleanString(config.teamId, 120);
  const teamName = cleanString(config.teamName, 160) || teamId;
  if (!teamId) throw new ContextProviderError("linear_team_required");
  return { teamId, teamName, take: boundedTake(config.take) };
}

async function fetchJson(args: {
  fetchImpl: FetchLike;
  url: string;
  init: RequestInit;
  provider: ContextProvider;
}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await args.fetchImpl(args.url, {
      ...args.init,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ContextProviderError(
        `${args.provider}_request_failed`,
        `${args.provider} request failed (${response.status})`,
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function githubClaim(args: {
  organization: string;
  repository: string;
  pull: any;
  updatedAt: Date | null;
}): ProposedSourceClaim {
  const state = args.pull.merged_at
    ? "merged"
    : args.pull.state === "closed"
      ? "closed"
      : args.pull.draft
        ? "draft"
        : "open";
  const title = cleanString(args.pull.title, 240) || "Untitled pull request";
  return {
    claimKey: `github:${args.organization}/${args.repository}:pull:${args.pull.number}:state`,
    kind: "delivery.pull_request_state",
    statement: `PR #${args.pull.number} “${title}” is ${state} in ${args.organization}/${args.repository}.`,
    confidence: 1,
    policyVersion: CONNECTOR_CLAIM_POLICY_VERSION,
    validFrom: args.updatedAt,
    freshUntil: freshUntil(args.updatedAt),
    locator: { field: "state", pullNumber: args.pull.number },
    excerpt: excerpt(args.pull.body),
  };
}

async function fetchGitHubRecords(args: {
  connection: any;
  fetchImpl: FetchLike;
}): Promise<ExternalSourceRecord[]> {
  const config = normalizeGitHubConfig(args.connection.config);
  const token = providerCredential("github", args.connection.credentialRef);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2026-03-10",
  };
  const pages = await Promise.all(
    config.repositories.map(async (repository) => {
      const url = `${GITHUB_API}/repos/${encodeURIComponent(config.organization)}/${encodeURIComponent(repository)}/pulls?state=all&sort=updated&direction=desc&per_page=${config.takePerRepository}`;
      const pulls = await fetchJson({
        fetchImpl: args.fetchImpl,
        url,
        init: { method: "GET", headers },
        provider: "github",
      });
      if (!Array.isArray(pulls)) {
        throw new ContextProviderError("github_invalid_response");
      }
      return pulls.map((pull: any): ExternalSourceRecord => {
        const updatedAt = validDate(pull.updated_at);
        const payload = {
          number: pull.number,
          title: pull.title ?? null,
          body: pull.body ?? null,
          state: pull.state ?? null,
          draft: pull.draft === true,
          mergedAt: pull.merged_at ?? null,
          closedAt: pull.closed_at ?? null,
          updatedAt: pull.updated_at ?? null,
          author: pull.user?.login ?? null,
          labels: Array.isArray(pull.labels)
            ? pull.labels.map((label: any) => label?.name).filter(Boolean)
            : [],
          baseRef: pull.base?.ref ?? null,
          headSha: pull.head?.sha ?? null,
          url: pull.html_url ?? null,
        };
        const title = cleanString(pull.title, 240);
        const body = cleanString(pull.body, 4_000);
        return {
          provider: "github",
          objectType: "pull_request",
          externalId: String(pull.node_id ?? pull.id ?? pull.number),
          stableKey: `github:${config.organization}/${repository}:pull:${pull.number}`,
          canonicalUrl: cleanString(pull.html_url, 500) || null,
          upstreamScope: `${config.organization}/${repository}`,
          externalVersion: cleanString(
            `${pull.updated_at ?? ""}:${pull.head?.sha ?? ""}`,
            300,
          ),
          sourceUpdatedAt: updatedAt,
          rawPayload: payload,
          normalizedText: [
            config.organization,
            repository,
            `PR ${pull.number}`,
            title,
            body,
            pull.state,
            pull.merged_at ? "merged" : null,
            pull.user?.login,
            payload.labels.join(" "),
          ]
            .filter(Boolean)
            .join("\n")
            .slice(0, 12_000),
          sourcePermissionVersion: args.connection.permissionVersion,
          proposedClaims: [
            githubClaim({
              organization: config.organization,
              repository,
              pull,
              updatedAt,
            }),
          ],
        };
      });
    }),
  );
  return pages.flat().slice(0, CONTEXT_SYNC_LIMIT * config.repositories.length);
}

const LINEAR_ISSUES_QUERY = `
  query MemoatoContextIssues($teamId: String!, $first: Int!) {
    team(id: $teamId) {
      id
      name
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          createdAt
          updatedAt
          archivedAt
          state { id name type }
          assignee { id name }
          labels { nodes { id name } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

function linearClaim(args: {
  issue: any;
  teamName: string;
  updatedAt: Date | null;
}): ProposedSourceClaim {
  const identifier = cleanString(args.issue.identifier, 80) || "Issue";
  const title = cleanString(args.issue.title, 240) || "Untitled issue";
  const state = cleanString(args.issue.state?.name, 120) || "Unknown";
  return {
    claimKey: `linear:${args.issue.id}:state`,
    kind: "delivery.issue_state",
    statement: `${identifier} “${title}” is ${state} in ${args.teamName}.`,
    confidence: 1,
    policyVersion: CONNECTOR_CLAIM_POLICY_VERSION,
    validFrom: args.updatedAt,
    freshUntil: freshUntil(args.updatedAt),
    locator: { field: "state", issueIdentifier: identifier },
    excerpt: excerpt(args.issue.description),
  };
}

async function fetchLinearRecords(args: {
  connection: any;
  fetchImpl: FetchLike;
}): Promise<ExternalSourceRecord[]> {
  const config = normalizeLinearConfig(args.connection.config);
  const token = providerCredential("linear", args.connection.credentialRef);
  const payload = await fetchJson({
    fetchImpl: args.fetchImpl,
    url: LINEAR_API,
    init: {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: LINEAR_ISSUES_QUERY,
        variables: { teamId: config.teamId, first: config.take },
      }),
    },
    provider: "linear",
  });
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new ContextProviderError("linear_graphql_error");
  }
  const team = payload?.data?.team;
  const issues = team?.issues?.nodes;
  if (!team || !Array.isArray(issues)) {
    throw new ContextProviderError("linear_invalid_response");
  }
  const teamName = cleanString(team.name, 160) || config.teamName;
  return issues.map((issue: any): ExternalSourceRecord => {
    const updatedAt = validDate(issue.updatedAt);
    const issuePayload = {
      id: issue.id,
      identifier: issue.identifier ?? null,
      title: issue.title ?? null,
      description: issue.description ?? null,
      url: issue.url ?? null,
      priority: issue.priority ?? null,
      createdAt: issue.createdAt ?? null,
      updatedAt: issue.updatedAt ?? null,
      archivedAt: issue.archivedAt ?? null,
      state: issue.state ?? null,
      assignee: issue.assignee ?? null,
      labels: Array.isArray(issue.labels?.nodes) ? issue.labels.nodes : [],
      team: { id: team.id, name: teamName },
    };
    return {
      provider: "linear",
      objectType: "issue",
      externalId: String(issue.id),
      stableKey: `linear:${config.teamId}:issue:${issue.id}`,
      canonicalUrl: cleanString(issue.url, 500) || null,
      upstreamScope: config.teamId,
      externalVersion: cleanString(issue.updatedAt, 160) || null,
      sourceUpdatedAt: updatedAt,
      rawPayload: issuePayload,
      normalizedText: [
        teamName,
        issue.identifier,
        issue.title,
        issue.description,
        issue.state?.name,
        issue.assignee?.name,
        ...(Array.isArray(issue.labels?.nodes)
          ? issue.labels.nodes.map((label: any) => label?.name)
          : []),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 12_000),
      sourcePermissionVersion: args.connection.permissionVersion,
      proposedClaims: [linearClaim({ issue, teamName, updatedAt })],
    };
  });
}

export async function fetchConnectionRecords(args: {
  connection: any;
  fetchImpl?: FetchLike;
}): Promise<ExternalSourceRecord[]> {
  const provider = args.connection.provider as ContextProvider;
  const fetchImpl = args.fetchImpl ?? fetch;
  if (provider === "github") {
    return fetchGitHubRecords({ connection: args.connection, fetchImpl });
  }
  if (provider === "linear") {
    return fetchLinearRecords({ connection: args.connection, fetchImpl });
  }
  throw new ContextProviderError("unsupported_context_provider");
}

export function normalizeConnectionConfig(
  provider: ContextProvider,
  value: unknown,
): GitHubConnectionConfig | LinearConnectionConfig {
  return provider === "github"
    ? normalizeGitHubConfig(value)
    : normalizeLinearConfig(value);
}
