import React from "react";
import {
  buildContextPacket,
  connectContextSource,
  createContextWorkspace,
  getContextOverview,
  reviewContextClaim,
  syncContextSource,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";

const inputClassName =
  "min-h-10 w-full rounded-[4px] border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 outline-none focus:border-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-200";

function dateLabel(value: unknown): string {
  if (!value) return "Never";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function ContextPage() {
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [githubOrg, setGithubOrg] = React.useState("");
  const [githubRepos, setGithubRepos] = React.useState("");
  const [linearTeamId, setLinearTeamId] = React.useState("");
  const [linearTeamName, setLinearTeamName] = React.useState("");
  const [packetQuery, setPacketQuery] = React.useState("");
  const [packet, setPacket] = React.useState<any>(null);
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState("");
  const overview = useQuery(
    getContextOverview,
    { workspaceId: workspaceId || undefined },
    { retry: false },
  );
  const data = overview.data as any;
  const activeWorkspaceId = workspaceId || data?.workspace?.id || "";
  const canManage = ["owner", "admin"].includes(
    String(data?.workspace?.role ?? ""),
  );

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something failed.");
    } finally {
      setBusy("");
    }
  }

  async function createWorkspace() {
    await run("workspace", async () => {
      const created = (await createContextWorkspace({
        name: workspaceName,
        type: "project",
      })) as any;
      setWorkspaceName("");
      setWorkspaceId(created.id);
      setMessage("Workspace created. Sources remain deny-by-default.");
    });
  }

  async function connectGitHub() {
    await run("github", async () => {
      await connectContextSource({
        workspaceId: activeWorkspaceId,
        provider: "github",
        displayName: githubOrg,
        config: {
          organization: githubOrg,
          repositories: githubRepos
            .split(/[\n,]+/)
            .map((value) => value.trim())
            .filter(Boolean),
          takePerRepository: 50,
        },
      });
      setGithubOrg("");
      setGithubRepos("");
      await overview.refetch();
      setMessage("GitHub scope connected. No upstream writes are enabled.");
    });
  }

  async function connectLinear() {
    await run("linear", async () => {
      await connectContextSource({
        workspaceId: activeWorkspaceId,
        provider: "linear",
        displayName: linearTeamName || linearTeamId,
        config: {
          teamId: linearTeamId,
          teamName: linearTeamName || linearTeamId,
          take: 50,
        },
      });
      setLinearTeamId("");
      setLinearTeamName("");
      await overview.refetch();
      setMessage("Linear team connected. No upstream writes are enabled.");
    });
  }

  async function sync(connectionId: string) {
    await run(`sync:${connectionId}`, async () => {
      const result = (await syncContextSource({
        workspaceId: activeWorkspaceId,
        connectionId,
      })) as any;
      await overview.refetch();
      setMessage(
        `Sync preserved ${result.versionsCreated} new versions and proposed ${result.claimsProposed} claims.`,
      );
    });
  }

  async function review(claimId: string, action: "accept" | "reject") {
    await run(`claim:${claimId}`, async () => {
      await reviewContextClaim({
        workspaceId: activeWorkspaceId,
        claimId,
        action,
      });
      await overview.refetch();
      setMessage(
        action === "accept"
          ? "Claim accepted with its exact evidence version."
          : "Claim rejected. Raw evidence remains unchanged.",
      );
    });
  }

  async function buildPacket() {
    await run("packet", async () => {
      const result = await buildContextPacket({
        workspaceId: activeWorkspaceId,
        query: packetQuery,
        take: 20,
      });
      setPacket(result);
      setMessage("Fresh packet built after permission and staleness filters.");
    });
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col justify-between gap-5 border-b border-neutral-300 pb-8 dark:border-neutral-800 sm:flex-row sm:items-end">
        <div>
          <div className="label">Trustworthy context / Pilot</div>
          <h2 className="mt-2 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
            Context with receipts.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            GitHub and Linear stay read-only. Source versions are immutable,
            claims need human review, and permissions are filtered before any
            ranking or packet generation.
          </p>
        </div>
        {data?.workspaces?.length > 0 ? (
          <label className="min-w-56">
            <span className="label">Workspace</span>
            <select
              className={`${inputClassName} mt-1`}
              value={activeWorkspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
                setPacket(null);
              }}
            >
              {data.workspaces.map((workspace: any) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} · {workspace.role}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {message ? (
        <div className="mt-5 border border-neutral-950 bg-white px-4 py-3 text-sm font-semibold dark:border-neutral-100 dark:bg-neutral-900">
          {message}
        </div>
      ) : null}

      {overview.isLoading ? (
        <div className="card mt-8 p-8 text-sm text-neutral-500">
          Loading workspace boundary…
        </div>
      ) : !data?.workspace ? (
        <section className="card mt-8 p-6">
          <div className="label">First project workspace</div>
          <h3 className="mt-2 text-2xl font-bold tracking-tight">
            Personal memory stays exactly where it is.
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Create a separate authorization boundary for the connector pilot.
            This does not move or rewrite any personal Memoato data.
          </p>
          <div className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input
              className={inputClassName}
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="e.g. Memoato product"
            />
            <Button
              onClick={createWorkspace}
              disabled={busy === "workspace" || !workspaceName.trim()}
            >
              Create workspace
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-px border-2 border-neutral-950 bg-neutral-950 dark:border-neutral-100 dark:bg-neutral-100 sm:grid-cols-3">
            {[
              ["Source objects", data.counts.sourceObjects],
              ["Immutable versions", data.counts.sourceVersions],
              ["Accepted claims", data.counts.acceptedClaims],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="bg-[#f3f1ec] p-5 dark:bg-[#11110f]"
              >
                <div className="text-3xl font-black tabular-nums">{value}</div>
                <div className="label mt-2">{label}</div>
              </div>
            ))}
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="label">GitHub organization</div>
                  <h3 className="mt-1 text-xl font-bold">
                    Selected repositories
                  </h3>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {data.providers.githubConfigured
                    ? "Credential ready"
                    : "Server key missing"}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  className={inputClassName}
                  value={githubOrg}
                  onChange={(event) => setGithubOrg(event.target.value)}
                  placeholder="Organization"
                  disabled={!canManage}
                />
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  value={githubRepos}
                  onChange={(event) => setGithubRepos(event.target.value)}
                  placeholder="Repository names, one per line"
                  disabled={!canManage}
                />
                <Button
                  variant="ghost"
                  onClick={connectGitHub}
                  disabled={
                    !canManage ||
                    busy === "github" ||
                    !githubOrg.trim() ||
                    !githubRepos.trim()
                  }
                >
                  Connect read-only GitHub scope
                </Button>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="label">Issue tracker</div>
                  <h3 className="mt-1 text-xl font-bold">Linear team</h3>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {data.providers.linearConfigured
                    ? "Credential ready"
                    : "Server key missing"}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  className={inputClassName}
                  value={linearTeamId}
                  onChange={(event) => setLinearTeamId(event.target.value)}
                  placeholder="Linear team UUID"
                  disabled={!canManage}
                />
                <input
                  className={inputClassName}
                  value={linearTeamName}
                  onChange={(event) => setLinearTeamName(event.target.value)}
                  placeholder="Display name"
                  disabled={!canManage}
                />
                <Button
                  variant="ghost"
                  onClick={connectLinear}
                  disabled={
                    !canManage || busy === "linear" || !linearTeamId.trim()
                  }
                >
                  Connect read-only Linear team
                </Button>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="label">Sources</div>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">
                  Versioned imports
                </h3>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {data.connections.map((connection: any) => (
                <div
                  key={connection.id}
                  className="card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="label">{connection.provider}</span>
                      <span className="font-bold">
                        {connection.displayName}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {connection._count.objects} objects · Last sync{" "}
                      {dateLabel(connection.lastSyncAt)}
                    </div>
                    {connection.lastSyncError ? (
                      <div className="mt-2 text-xs font-semibold text-red-600">
                        {connection.lastSyncError}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sync(connection.id)}
                    disabled={!canManage || busy === `sync:${connection.id}`}
                  >
                    Sync now
                  </Button>
                </div>
              ))}
              {data.connections.length === 0 ? (
                <div className="card p-6 text-sm text-neutral-500">
                  No connected sources. Connecting creates an explicit member
                  grant; it never grants the whole workspace implicitly.
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-8">
            <div className="label">Human review</div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight">
              Proposed claims
            </h3>
            <div className="mt-4 grid gap-3">
              {data.proposedClaims.map((claim: any) => (
                <article key={claim.id} className="card p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="label">{claim.kind}</div>
                      <p className="mt-2 text-lg font-bold leading-7">
                        {claim.statement}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                        {claim.evidence.map((edge: any) => (
                          <a
                            key={`${claim.id}:${edge.sourceVersion.contentHash}`}
                            href={
                              edge.sourceVersion.sourceObject.canonicalUrl ||
                              undefined
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="border border-neutral-300 px-2 py-1 font-mono hover:border-neutral-950 dark:border-neutral-700 dark:hover:border-neutral-200"
                          >
                            {edge.sourceVersion.sourceObject.stableKey}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => review(claim.id, "reject")}
                        disabled={!canManage || busy === `claim:${claim.id}`}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => review(claim.id, "accept")}
                        disabled={!canManage || busy === `claim:${claim.id}`}
                      >
                        Accept with evidence
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
              {data.proposedClaims.length === 0 ? (
                <div className="card p-6 text-sm text-neutral-500">
                  Nothing waiting for review.
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-8 border-2 border-neutral-950 bg-white p-5 dark:border-neutral-100 dark:bg-neutral-900">
            <div className="label">Agent read side</div>
            <h3 className="mt-1 text-2xl font-bold tracking-tight">
              Permission-filtered packet
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              Memoato resolves grants and freshness first. Only the surviving
              accepted claims reach deterministic ranking.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className={inputClassName}
                value={packetQuery}
                onChange={(event) => setPacketQuery(event.target.value)}
                placeholder="What changed around authentication?"
              />
              <Button
                onClick={buildPacket}
                disabled={busy === "packet" || !packetQuery.trim()}
              >
                Build fresh packet
              </Button>
            </div>

            {packet ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_260px]">
                <div className="grid gap-3">
                  {(packet.content?.claims ?? []).map((claim: any) => (
                    <article
                      key={claim.id}
                      className="border border-neutral-300 p-4 dark:border-neutral-700"
                    >
                      <div className="label">
                        #{claim.score.toFixed(3)} · {claim.kind}
                      </div>
                      <p className="mt-2 font-bold leading-6">
                        {claim.statement}
                      </p>
                      <div className="mt-3 text-xs text-neutral-500">
                        {claim.evidence.length} exact evidence version(s)
                      </div>
                    </article>
                  ))}
                  {(packet.content?.claims ?? []).length === 0 ? (
                    <div className="border border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">
                      No fresh, accepted and fully authorized claims matched.
                    </div>
                  ) : null}
                </div>
                <aside className="border border-neutral-300 p-4 text-xs dark:border-neutral-700">
                  <div className="label">Memory diff</div>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-neutral-500">Added</dt>
                      <dd className="text-xl font-black">
                        {packet.diff.added.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Changed</dt>
                      <dd className="text-xl font-black">
                        {packet.diff.changed.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Removed</dt>
                      <dd className="text-xl font-black">
                        {packet.diff.removed.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Unchanged</dt>
                      <dd className="text-xl font-black">
                        {packet.diff.unchangedCount}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 border-t border-neutral-300 pt-3 font-mono text-[10px] leading-5 text-neutral-500 dark:border-neutral-700">
                    trace {packet.traceId}
                    <br />
                    packet {packet.packetHash.slice(0, 16)}…
                    <br />
                    permission {packet.permissionSnapshotHash.slice(0, 16)}…
                  </div>
                </aside>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
