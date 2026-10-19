import React from "react";
import {
  createContextWorkspace,
  getContextOverview,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../shared/components/Button";
import { ContextWorkspace } from "./components/ContextWorkspace";
import type { ContextOverview } from "./viewTypes";
import "./context.css";

export function ContextPage() {
  const [workspaceId, setWorkspaceId] = React.useState("");
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [workspaceBusy, setWorkspaceBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [lastSaved, setLastSaved] = React.useState("");
  const createPending = React.useRef(false);
  const overview = useQuery(
    getContextOverview,
    { workspaceId: workspaceId || undefined },
    { retry: false },
  );
  const data = overview.data as ContextOverview | undefined;
  const matches = !workspaceId || data?.workspace?.id === workspaceId;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (createPending.current || !name.trim()) return;
    createPending.current = true;
    setCreating(true);
    setError("");
    try {
      const result = (await createContextWorkspace({
        name: name.trim(),
        type: "project",
      })) as { id: string };
      setWorkspaceId(result.id);
      setName("");
    } catch {
      setError(
        "Couldn’t create this workspace. Your name is kept below; try again.",
      );
    } finally {
      createPending.current = false;
      setCreating(false);
    }
  }

  return (
    <div className="memoato-context-page">
      <header className="memoato-context-heading">
        <h1>Context</h1>
        <p>
          Bring project knowledge to your AI tools, with a source behind every
          claim.
        </p>
        <p className="memoato-context-pilot">
          Read-only pilot · GitHub and Linear
        </p>
      </header>
      {data && data.workspaces.length > 0 ? (
        <nav className="memoato-workspaces" aria-label="Choose workspace">
          <span className="memoato-context-label">Workspace</span>
          <div>
            {data.workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                aria-pressed={data.workspace?.id === workspace.id && matches}
                disabled={workspaceBusy || creating}
                onClick={() => {
                  setError("");
                  setLastSaved("");
                  setWorkspaceId(workspace.id);
                }}
              >
                <span>{workspace.name}</span>
                <small>{workspace.role}</small>
              </button>
            ))}
          </div>
        </nav>
      ) : null}
      {lastSaved ? (
        <p role="status" className="memoato-context-feedback">
          {lastSaved}
        </p>
      ) : null}
      {overview.isError ? (
        <div className="memoato-context-notice" role="alert">
          <h2>Couldn’t load Context.</h2>
          <p>Try again to check your current workspace access.</p>
          <Button variant="ghost" onClick={() => void overview.refetch()}>
            Try again
          </Button>
        </div>
      ) : overview.isLoading || (overview.isFetching && !matches) ? (
        <div className="memoato-context-loading" role="status">
          Loading your workspace…
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      ) : data && !matches ? (
        <div className="memoato-context-notice" role="alert">
          <h2>This workspace is unavailable.</h2>
          <p>Choose another workspace above or reload to check your access.</p>
          <Button variant="ghost" onClick={() => setWorkspaceId("")}>
            Reload workspaces
          </Button>
        </div>
      ) : data?.workspace ? (
        <ContextWorkspace
          key={data.workspace.id}
          data={data}
          refreshing={overview.isFetching}
          updatedAt={overview.dataUpdatedAt}
          onBusyChange={setWorkspaceBusy}
          onSaved={setLastSaved}
          onRefresh={() => overview.refetch({ throwOnError: true })}
        />
      ) : data ? (
        <section
          className="memoato-context-start"
          aria-labelledby="context-start-heading"
        >
          <div>
            <h2 id="context-start-heading">Start with a project workspace.</h2>
            <p>
              Keep source documents, review what they say, and build a context
              packet for the task at hand.
            </p>
            <p className="memoato-context-muted">
              Project sources stay separate from your personal notes. Source
              connections are managed by Memoato administrators during this
              pilot.
            </p>
          </div>
          <form onSubmit={create} className="memoato-context-form">
            <label htmlFor="workspace-name">Workspace name</label>
            <input
              id="workspace-name"
              value={name}
              maxLength={120}
              disabled={creating}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example, Product launch"
              required
            />
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "Creating workspace…" : "Create workspace"}
            </Button>
            {error ? (
              <p role="alert" className="memoato-context-error">
                {error}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
