import { Link } from "react-router-dom";

export function MemoryModeNotice({ mode }: { mode: string }) {
  return (
    <section className="memoato-memory-mode">
      <h1>
        {mode === "local"
          ? "Your notes stay on this device."
          : "Your encrypted notes stay private."}
      </h1>
      <p>
        Memory review and Recall are available in standard cloud mode. Your{" "}
        {mode === "local" ? "local" : "encrypted"} entries remain available in
        their existing views.
      </p>
      <div className="memoato-memory-links">
        <Link to="/views">
          Open your views <span aria-hidden="true">↗</span>
        </Link>
        <Link to="/">Capture privately</Link>
        <Link to="/profile">Privacy settings</Link>
      </div>
    </section>
  );
}
