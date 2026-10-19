import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../../shared/components/Button";
import { contextDate, sourceUrl, type ContextPacketView } from "../viewTypes";

export function formatContextPacket(packet: ContextPacketView): string {
  return [
    `# Context: ${packet.content.workspace.name}`,
    `Question: ${packet.content.query}`,
    `Generated: ${packet.content.freshness.generatedAt}`,
    `Valid until: ${packet.content.freshness.freshUntil ?? "No source expiry recorded"}`,
    "Snapshot of reviewed claims. Permissions were checked at generation time; rebuild after source or access changes.",
    ...packet.content.claims.flatMap((claim, index) => [
      `\n## ${index + 1}. ${claim.kind.replaceAll("_", " ")}`,
      claim.statement,
      ...claim.evidence.map(
        (source) =>
          `Source: ${source.sourceKey}${sourceUrl(source.canonicalUrl) ? ` (${sourceUrl(source.canonicalUrl)})` : ""}\nVersion: ${source.contentHash}${source.excerpt ? `\nExcerpt: ${source.excerpt}` : ""}`,
      ),
    ]),
    `\nPacket: ${packet.packetHash}`,
    `Trace: ${packet.traceId}`,
    `Permission snapshot: ${packet.permissionSnapshotHash}`,
  ].join("\n\n");
}

export function ContextPacket({
  packet,
  disabled,
  busy,
  onBuild,
  onInvalidate,
}: {
  packet: ContextPacketView | null;
  disabled: boolean;
  busy: boolean;
  onBuild: (query: string) => Promise<void>;
  onInvalidate: () => void;
}) {
  const [query, setQuery] = React.useState("");
  return (
    <div className="memoato-context-section">
      <h2>Build context for a specific task.</h2>
      <p className="memoato-context-intro">
        Only accepted claims with current evidence and access can enter a
        packet. Copy the result into your AI tool, or connect through a
        Context-scoped key in <Link to="/profile">Profile</Link>.
      </p>
      <form
        className="memoato-packet-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) void onBuild(query);
        }}
      >
        <label htmlFor="packet-query">What do you need context for?</label>
        <input
          id="packet-query"
          maxLength={240}
          required
          disabled={disabled}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onInvalidate();
          }}
          placeholder="For example, decisions about authentication"
        />
        <Button type="submit" disabled={disabled || !query.trim()}>
          {busy ? "Building…" : "Build context"}
        </Button>
      </form>
      <p className="memoato-context-muted">
        A packet is a snapshot, not an AI-generated answer. It keeps claims
        linked to their source versions.
      </p>
      {packet ? <PacketOutput key={packet.id} packet={packet} /> : null}
    </div>
  );
}

function PacketOutput({ packet }: { packet: ContextPacketView }) {
  const isExpired = () =>
    !!packet.content.freshness.freshUntil &&
    new Date(packet.content.freshness.freshUntil).getTime() <= Date.now();
  const [expired, setExpired] = React.useState(isExpired);
  const [copying, setCopying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  React.useEffect(() => {
    if (!packet.content.freshness.freshUntil) return;
    const timer = window.setInterval(() => setExpired(isExpired()), 60_000);
    return () => window.clearInterval(timer);
  }, [packet]);
  const text = formatContextPacket(packet);
  async function copy() {
    if (copying || !packet.content.claims.length) return;
    if (isExpired()) {
      setExpired(true);
      return;
    }
    setCopying(true);
    setCopyError(false);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopyError(true);
    } finally {
      setCopying(false);
    }
  }
  return (
    <div
      className="memoato-packet-output"
      role="region"
      aria-label="Context packet"
    >
      <div className="memoato-packet-title">
        <h3>
          {packet.content.claims.length} accepted{" "}
          {packet.content.claims.length === 1 ? "claim" : "claims"}
        </h3>
        <Button
          variant="ghost"
          disabled={copying || expired || !packet.content.claims.length}
          onClick={() => void copy()}
        >
          {copying ? "Copying…" : "Copy context"}
        </Button>
      </div>
      <p className="memoato-packet-query">For “{packet.content.query}”</p>
      <p className="memoato-context-muted">
        Built {contextDate(packet.content.freshness.generatedAt)}
        {packet.content.freshness.freshUntil
          ? ` · Evidence eligible until ${contextDate(packet.content.freshness.freshUntil)}`
          : " · No source expiry recorded"}
      </p>
      <p className="memoato-context-muted">
        Rebuild to check source and permission changes.
      </p>
      {expired ? (
        <p role="status" className="memoato-context-warning">
          This packet’s evidence has expired. Build a new packet before using
          it.
        </p>
      ) : null}
      {copied ? (
        <p role="status" className="memoato-context-feedback">
          Context copied with source versions.
        </p>
      ) : null}
      {copyError ? (
        <div className="memoato-context-form">
          <p role="alert" className="memoato-context-error">
            Couldn’t copy automatically. You can select and copy the packet
            below.
          </p>
          <label htmlFor="packet-copy">Context to copy</label>
          <textarea id="packet-copy" rows={7} readOnly value={text} />
        </div>
      ) : null}
      <dl
        className="memoato-packet-diff"
        aria-label="Changes since the last packet for this query"
      >
        {[
          ["Added", packet.diff.added.length],
          ["Changed", packet.diff.changed.length],
          ["Removed", packet.diff.removed.length],
          ["Unchanged", packet.diff.unchangedCount],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="memoato-context-muted">
        Changes since the last packet for this query.{" "}
        {packet.content.exclusions.stale
          ? `${packet.content.exclusions.stale} expired ${packet.content.exclusions.stale === 1 ? "claim" : "claims"} excluded.`
          : ""}
      </p>
      {packet.content.claims.map((claim) => (
        <article key={claim.id} className="memoato-context-claim">
          <p className="memoato-context-kind">
            {claim.kind.replaceAll("_", " ")}
          </p>
          <h3>{claim.statement}</h3>
          <div className="memoato-context-evidence">
            <h4>Source evidence</h4>
            {claim.evidence.map((source, index) => {
              const href = sourceUrl(source.canonicalUrl);
              return (
                <div key={`${source.sourceVersionId}:${index}`}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {source.sourceKey}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  ) : (
                    <span>{source.sourceKey}</span>
                  )}
                  {source.excerpt ? (
                    <blockquote>{source.excerpt}</blockquote>
                  ) : null}
                  <p className="memoato-context-version">
                    {source.provider} · Version{" "}
                    <code title={source.contentHash}>
                      {source.contentHash.slice(0, 12)}
                    </code>
                    {source.sourceUpdatedAt
                      ? ` · Updated ${contextDate(source.sourceUpdatedAt)}`
                      : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </article>
      ))}
      {!packet.content.claims.length ? (
        <div className="memoato-context-empty">
          <h3>No eligible claims matched.</h3>
          <p>
            Try a different query, review proposed claims, or ask an
            administrator to sync the sources you can access.
          </p>
        </div>
      ) : null}
      <div className="memoato-packet-details">
        <h4>Retrieval details</h4>
        <dl>
          {[
            ["Trace", packet.traceId],
            ["Packet", packet.packetHash],
            ["Permissions", packet.permissionSnapshotHash],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <code>{value}</code>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
