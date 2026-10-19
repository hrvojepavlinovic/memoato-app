import { Link } from "react-router-dom";
import { getMemoryOverview, useQuery } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { usePrivacy } from "../../privacy/PrivacyProvider";
import { useRawCapture } from "./useRawCapture";

type RecentEntry = {
  id: string;
  rawText: string;
  occurredAt: string | Date;
  processingStatus: string;
};
type Overview = {
  capturedToday: number;
  reviewCount: number;
  failedCount: number;
  recent: RecentEntry[];
};

function entryTime(value: string | Date): string {
  const date = new Date(value);
  const today = new Date().toDateString() === date.toDateString();
  return new Intl.DateTimeFormat("en", {
    ...(today ? {} : ({ month: "short", day: "numeric" } as const)),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function processingLabel(status: string): string {
  if (status === "queued") return "Waiting to process";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Original saved · processing needs attention";
  return "Original saved";
}

export function TodayMemoryPanel({
  onOpenLegacyCapture,
}: {
  onOpenLegacyCapture: () => void;
}) {
  const privacy = usePrivacy();
  const capture = useRawCapture();
  const overview = useQuery(getMemoryOverview, undefined, {
    enabled: privacy.mode === "cloud",
    refetchInterval: privacy.mode === "cloud" ? 5_000 : false,
  });
  const data = overview.data as Overview | undefined;

  if (privacy.mode !== "cloud") {
    return (
      <section
        className="memoato-private-capture"
        aria-labelledby="private-capture-title"
      >
        <div>
          <h2 id="private-capture-title">
            {privacy.mode === "local"
              ? "Keep it on this device"
              : "Capture an encrypted note"}
          </h2>
          <p>
            {privacy.mode === "local"
              ? "Your notes stay on this device and aren’t sent to AI services."
              : "Use the private capture flow. Encrypted notes aren’t sent to AI services."}
          </p>
        </div>
        <Button onClick={onOpenLegacyCapture}>Capture privately</Button>
      </section>
    );
  }

  return (
    <section
      className="memoato-today-memory"
      aria-label="Capture and recent memory"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void capture.save();
        }}
        className="memoato-capture"
      >
        <label htmlFor="memoato-today-capture">
          What would you like to remember?
        </label>
        <p id="capture-hint">
          A moment, a conversation, an idea. Start with your own words.
        </p>
        <textarea
          id="memoato-today-capture"
          value={capture.text}
          onChange={(event) => capture.updateText(event.target.value)}
          placeholder="Had a useful conversation about the next release…"
          aria-describedby={
            capture.error ? "capture-hint capture-error" : "capture-hint"
          }
          maxLength={4000}
          rows={5}
        />
        <div className="memoato-capture-actions">
          <span className="memoato-capture-count">
            {capture.text.length > 3600
              ? `${capture.text.length.toLocaleString()} / 4,000`
              : "Your original comes first."}
          </span>
          <Button
            type="submit"
            disabled={!capture.text.trim() || capture.saving}
          >
            {capture.saving ? "Saving…" : "Save note"}
          </Button>
        </div>
        <p className="memoato-capture-notice" role="status">
          {capture.notice}
        </p>
        {capture.error ? (
          <p id="capture-error" className="memoato-inline-error" role="alert">
            {capture.error}
          </p>
        ) : null}
        <button
          type="button"
          className="memoato-text-action"
          onClick={onOpenLegacyCapture}
        >
          Log to a view instead <span aria-hidden="true">↗</span>
        </button>
      </form>

      <div className="memoato-recent">
        <div className="memoato-recent-heading">
          <h2>Recently remembered</h2>
          <Link to="/memory">
            All memory <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {overview.isLoading && !data ? (
          <p role="status" className="memoato-muted">
            Loading recent notes…
          </p>
        ) : null}
        {overview.isError ? (
          <div className="memoato-inline-error" role="alert">
            <p>
              {data
                ? "Recent notes may be out of date."
                : "Couldn’t load recent notes. You can still write a new one."}
            </p>
            <button
              type="button"
              className="memoato-text-action"
              onClick={() => void overview.refetch()}
            >
              Try loading again
            </button>
          </div>
        ) : null}
        {data?.recent.length === 0 ? (
          <p className="memoato-recent-empty">
            Your first note starts here.
            <br />
            You can organize it later.
          </p>
        ) : null}
        {data?.recent.slice(0, 3).map((entry) => (
          <article className="memoato-recent-entry" key={entry.id}>
            <p>{entry.rawText}</p>
            <div className="memoato-entry-meta">
              <time dateTime={new Date(entry.occurredAt).toISOString()}>
                {entryTime(entry.occurredAt)}
              </time>
              <span>{processingLabel(entry.processingStatus)}</span>
            </div>
          </article>
        ))}
        {data ? (
          <div className="memoato-memory-summary">
            <p>
              {data.capturedToday} {data.capturedToday === 1 ? "note" : "notes"}{" "}
              today
            </p>
            {data.reviewCount > 0 || data.failedCount > 0 ? (
              <Link to="/memory">
                {data.reviewCount > 0
                  ? `${data.reviewCount} facts to review`
                  : `${data.failedCount} ${data.failedCount === 1 ? "note needs" : "notes need"} processing attention`}{" "}
                <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
