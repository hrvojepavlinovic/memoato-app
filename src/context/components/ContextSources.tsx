import React from "react";
import { Button } from "../../shared/components/Button";
import { contextCount, contextDate, type ContextOverview } from "../viewTypes";
import type { ContextAction } from "../useContextActions";
import type {
  connectContextSource,
  syncContextSource,
} from "wasp/client/operations";

export function ContextSources({
  data,
  canConnect,
  disabled,
  busy,
  run,
  connect,
  sync,
}: {
  data: ContextOverview;
  canConnect: boolean;
  disabled: boolean;
  busy: string;
  run: ContextAction;
  connect: typeof connectContextSource;
  sync: typeof syncContextSource;
}) {
  const [provider, setProvider] = React.useState<"github" | "linear" | null>(
    null,
  );
  const [organization, setOrganization] = React.useState("");
  const [repositories, setRepositories] = React.useState("");
  const [teamId, setTeamId] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const workspaceId = data.workspace!.id;
  const configured =
    provider === "github"
      ? data.providers.githubConfigured
      : data.providers.linearConfigured;
  const repos = Array.from(
    new Set(
      repositories
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canConnect || !configured || disabled || !provider) return;
    const github = provider === "github";
    if (
      github
        ? !organization.trim() || !repos.length || repos.length > 20
        : !teamId.trim()
    )
      return;
    void run(
      provider,
      () =>
        connect({
          workspaceId,
          provider,
          displayName: github
            ? organization.trim()
            : teamName.trim() || teamId.trim(),
          config: github
            ? {
                organization: organization.trim(),
                repositories: repos,
                takePerRepository: 50,
              }
            : {
                teamId: teamId.trim(),
                teamName: teamName.trim() || teamId.trim(),
                take: 50,
              },
        }),
      "Source connected. Sync it to import evidence for your review.",
      () => {
        setProvider(null);
        setOrganization("");
        setRepositories("");
        setTeamId("");
        setTeamName("");
      },
    );
  }
  return (
    <div className="memoato-context-section">
      <div className="memoato-context-section-heading">
        <div>
          <h2>Sources for this workspace</h2>
          <p className="memoato-context-intro">
            Imports keep the original source and its versions. GitHub and Linear
            are read-only.
          </p>
        </div>
        {canConnect ? (
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => setProvider(provider ? null : "github")}
          >
            {provider ? "Cancel setup" : "Add a source"}
          </Button>
        ) : null}
      </div>
      {!canConnect ? (
        <p className="memoato-context-muted">
          Source setup and syncing are managed by Memoato administrators during
          the pilot. Your workspace role is {data.workspace!.role}.
        </p>
      ) : null}
      {provider && canConnect ? (
        <form className="memoato-context-source-form" onSubmit={submit}>
          <h3>Connect a read-only source</h3>
          <div
            className="memoato-context-provider-options"
            aria-label="Source provider"
          >
            {(["github", "linear"] as const).map((item) => (
              <button
                type="button"
                key={item}
                disabled={disabled}
                aria-pressed={provider === item}
                onClick={() => setProvider(item)}
              >
                {item === "github" ? "GitHub" : "Linear"}
              </button>
            ))}
          </div>
          <p className="memoato-context-muted">
            Only sources approved for this pilot can connect. This gives you
            read access to the selected source; other members receive no
            automatic access.
          </p>
          {!configured ? (
            <p className="memoato-context-warning">
              {provider === "github" ? "GitHub" : "Linear"} setup is not
              available yet. A Memoato administrator needs to configure this
              provider before you can connect.
            </p>
          ) : null}
          <fieldset disabled={disabled || !configured}>
            <legend className="sr-only">
              {provider === "github"
                ? "GitHub repository scope"
                : "Linear team scope"}
            </legend>
            {provider === "github" ? (
              <>
                <label htmlFor="context-org">GitHub organization</label>
                <input
                  id="context-org"
                  maxLength={120}
                  required
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Organization name"
                />
                <label htmlFor="context-repos">Repository names</label>
                <textarea
                  id="context-repos"
                  required
                  rows={3}
                  maxLength={2500}
                  aria-describedby="context-repo-help"
                  value={repositories}
                  onChange={(event) => setRepositories(event.target.value)}
                  placeholder="One repository name per line"
                />
                <p
                  id="context-repo-help"
                  className={
                    repos.length > 20
                      ? "memoato-context-error"
                      : "memoato-context-muted"
                  }
                >
                  Up to 20 repositories from this organization.
                  {repos.length > 20
                    ? " Remove extra names before connecting."
                    : ""}
                </p>
              </>
            ) : (
              <>
                <label htmlFor="context-team">Linear team ID</label>
                <input
                  id="context-team"
                  required
                  maxLength={120}
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  placeholder="Team UUID"
                />
                <label htmlFor="context-team-name">
                  Display name <span>(optional)</span>
                </label>
                <input
                  id="context-team-name"
                  maxLength={160}
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="For example, Product"
                />
              </>
            )}
          </fieldset>
          <Button
            type="submit"
            disabled={
              disabled ||
              !configured ||
              (provider === "github"
                ? !organization.trim() || !repos.length || repos.length > 20
                : !teamId.trim())
            }
          >
            {busy === provider
              ? "Connecting…"
              : `Connect ${provider === "github" ? "GitHub" : "Linear"}`}
          </Button>
        </form>
      ) : null}
      <div className="memoato-context-source-list">
        {data.connections.map((connection) => {
          const ready =
            connection.provider === "github"
              ? data.providers.githubConfigured
              : data.providers.linearConfigured;
          return (
            <article className="memoato-context-source" key={connection.id}>
              <div>
                <h3>{connection.displayName}</h3>
                <p className="memoato-context-muted">
                  {connection.provider === "github" ? "GitHub" : "Linear"} ·{" "}
                  {contextCount(connection._count.objects, "source record")} ·{" "}
                  {connection.status}
                </p>
                <p className="memoato-context-muted">
                  {connection.lastSyncAt
                    ? `Last sync ${contextDate(connection.lastSyncAt)}`
                    : "Not synced yet"}
                </p>
                {connection.lastSyncError ? (
                  <p className="memoato-context-error">
                    Last sync failed: {connection.lastSyncError}
                  </p>
                ) : null}
                {!ready && canConnect ? (
                  <p className="memoato-context-warning">
                    Provider setup is required before syncing.
                  </p>
                ) : null}
              </div>
              {canConnect ? (
                <Button
                  variant="ghost"
                  disabled={
                    disabled || !ready || connection.status !== "active"
                  }
                  onClick={() =>
                    void run(
                      `sync:${connection.id}`,
                      () => sync({ workspaceId, connectionId: connection.id }),
                      "Sync complete. Open Review to check any new proposed claims.",
                    )
                  }
                >
                  {busy === `sync:${connection.id}`
                    ? "Syncing…"
                    : "Sync source"}
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>
      {!data.connections.length ? (
        <div className="memoato-context-empty">
          <h3>No sources connected yet.</h3>
          <p>
            {canConnect
              ? "Add a GitHub organization with selected repositories, or a Linear team. Then sync to start reviewing source-backed claims."
              : "An administrator can connect an approved GitHub organization or Linear team. Imported evidence will appear here once you have access."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
