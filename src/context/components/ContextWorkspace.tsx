import React from "react";
import { useAuth } from "wasp/client/auth";
import {
  connectContextSource,
  reviewContextClaim,
  syncContextSource,
} from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ContextSources } from "./ContextSources";
import { ContextPacket } from "./ContextPacket";
import { useContextActions } from "../useContextActions";
import {
  contextCount,
  contextDate,
  sourceUrl,
  type ContextOverview,
} from "../viewTypes";

export function ContextWorkspace({
  data,
  refreshing,
  updatedAt,
  onRefresh,
  onBusyChange,
  onSaved,
}: {
  data: ContextOverview;
  refreshing: boolean;
  updatedAt: number;
  onRefresh: () => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const { data: user } = useAuth();
  const workspace = data.workspace!;
  const canReview = ["owner", "admin"].includes(workspace.role);
  const canConnect = canReview && user?.role === "admin";
  const [section, setSection] = React.useState("sources");
  const actions = useContextActions({
    workspaceId: workspace.id,
    revision: JSON.stringify([
      updatedAt,
      workspace.role,
      data.connections,
      data.proposedClaims,
      data.counts,
    ]),
    refreshing,
    onRefresh,
    onBusyChange,
    onSaved,
  });

  return (
    <div className="memoato-context-workspace">
      <div className="memoato-context-summary">
        <p>
          {contextCount(data.counts.sourceObjects, "source record")}{" "}
          <span>·</span> {contextCount(data.counts.sourceVersions, "version")}{" "}
          <span>·</span>{" "}
          {contextCount(data.counts.acceptedClaims, "accepted claim")}
        </p>
      </div>
      <nav className="memoato-context-tabs" aria-label="Context tools">
        {[
          ["sources", "Sources"],
          [
            "review",
            `Review${data.proposedClaims.length ? ` (${data.proposedClaims.length})` : ""}`,
          ],
          ["packet", "Build context"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {actions.busy ? (
        <p role="status" className="memoato-context-muted">
          {actions.busy === "packet"
            ? "Building context from current evidence…"
            : actions.busy === "reload"
              ? "Reloading workspace…"
              : actions.busy.startsWith("sync:")
                ? "Importing source versions…"
                : actions.busy.startsWith("claim:")
                  ? "Saving your review…"
                  : "Connecting source…"}
        </p>
      ) : null}
      {actions.error ? (
        <div className="memoato-context-error" role="alert">
          <p>{actions.error}</p>
          <Button
            variant="ghost"
            disabled={actions.disabled}
            onClick={() => void actions.reload()}
          >
            Reload workspace
          </Button>
        </div>
      ) : null}
      <section hidden={section !== "sources"} aria-label="Sources">
        <ContextSources
          data={data}
          canConnect={canConnect}
          disabled={actions.disabled}
          busy={actions.busy}
          run={actions.run}
          connect={connectContextSource}
          sync={syncContextSource}
        />
      </section>
      <section
        hidden={section !== "review"}
        className="memoato-context-section"
        aria-label="Review claims"
      >
        <h2>Review what your sources say.</h2>
        <p className="memoato-context-intro">
          Check the original evidence before a proposed claim can be used in a
          context packet.
        </p>
        {!canReview ? (
          <p className="memoato-context-muted">
            A workspace owner or admin can accept or reject claims. You can
            inspect the evidence below.
          </p>
        ) : null}
        {data.proposedClaims.length ? (
          <div className="memoato-claim-list">
            {data.proposedClaims.map((claim) => {
              const expired =
                claim.freshUntil != null &&
                new Date(claim.freshUntil).getTime() <= Date.now();
              return (
                <article
                  key={claim.id}
                  className="memoato-context-claim"
                  aria-label={claim.statement}
                >
                  <p className="memoato-context-kind">
                    {claim.kind.replaceAll("_", " ")}
                  </p>
                  <h3>{claim.statement}</h3>
                  <p className="memoato-context-muted">
                    {claim.freshUntil
                      ? `Eligible until ${contextDate(claim.freshUntil)}`
                      : "No expiry recorded"}
                  </p>
                  <div className="memoato-context-evidence">
                    <h4>Source evidence</h4>
                    {claim.evidence.map((edge, index) => {
                      const object = edge.sourceVersion.sourceObject;
                      const href = sourceUrl(object.canonicalUrl);
                      return (
                        <div key={`${edge.sourceVersion.contentHash}:${index}`}>
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer">
                              {object.stableKey}
                              <span aria-hidden="true"> ↗</span>
                            </a>
                          ) : (
                            <span>{object.stableKey}</span>
                          )}
                          {edge.excerpt ? (
                            <blockquote>{edge.excerpt}</blockquote>
                          ) : null}
                          <p className="memoato-context-version">
                            {object.provider} · Version{" "}
                            <code title={edge.sourceVersion.contentHash}>
                              {edge.sourceVersion.contentHash.slice(0, 12)}
                            </code>
                            {edge.sourceVersion.sourceUpdatedAt
                              ? ` · Updated ${contextDate(edge.sourceVersion.sourceUpdatedAt)}`
                              : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="memoato-context-actions">
                    <Button
                      disabled={actions.disabled || !canReview || expired}
                      onClick={() =>
                        void actions.run(
                          `claim:${claim.id}`,
                          () =>
                            reviewContextClaim({
                              workspaceId: workspace.id,
                              claimId: claim.id,
                              action: "accept",
                            }),
                          "Claim accepted with its source evidence.",
                        )
                      }
                    >
                      Accept claim
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={actions.disabled || !canReview}
                      onClick={() =>
                        void actions.run(
                          `claim:${claim.id}`,
                          () =>
                            reviewContextClaim({
                              workspaceId: workspace.id,
                              claimId: claim.id,
                              action: "reject",
                            }),
                          "Claim rejected. Original evidence is kept.",
                        )
                      }
                    >
                      Reject claim
                    </Button>
                  </div>
                  {expired ? (
                    <p className="memoato-context-muted">
                      This evidence has expired. Sync its source before
                      accepting a current claim.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="memoato-context-empty">
            <h3>Nothing waiting for review.</h3>
            <p>
              {data.connections.length
                ? "New source imports can propose claims here. Accepted claims are available under Build context."
                : "Connect and sync a source first. Its proposed claims will appear here with their evidence."}
            </p>
            <button
              type="button"
              className="memoato-context-text-action"
              onClick={() =>
                setSection(data.counts.acceptedClaims ? "packet" : "sources")
              }
            >
              {data.counts.acceptedClaims ? "Build context" : "Go to sources"}
            </button>
          </div>
        )}
        {data.proposedClaims.length === 50 ? (
          <p className="memoato-context-muted">
            Showing the 50 most recent proposals. Review these to see older
            proposals.
          </p>
        ) : null}
      </section>
      <section hidden={section !== "packet"} aria-label="Build context">
        <ContextPacket
          packet={actions.packet}
          disabled={actions.disabled}
          busy={actions.busy === "packet"}
          onBuild={actions.build}
          onInvalidate={actions.invalidatePacket}
        />
      </section>
    </div>
  );
}
