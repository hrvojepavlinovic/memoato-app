export function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="memoato-auth-layout">
      <section
        className="memoato-auth-intro"
        aria-labelledby="auth-intro-title"
      >
        <h1 id="auth-intro-title">
          Keep the context.
          <br />
          Find it when it matters.
        </h1>
        <p>
          Everyday details. Decisions at work. One place to keep the original
          and make sense of it later.
        </p>
        <dl className="memoato-auth-uses">
          <div>
            <dt>For you</dt>
            <dd>Capture a thought. Remember the details.</dd>
          </div>
          <div>
            <dt>With AI</dt>
            <dd>Recall useful context with the source attached.</dd>
          </div>
        </dl>
      </section>
      <section className="memoato-auth-form-region" aria-label="Account access">
        <div className="memoato-auth">{children}</div>
        <p className="memoato-auth-privacy">
          Your originals stay yours.{" "}
          <a href="https://memoato.com/privacy-first">How privacy works</a>
        </p>
      </section>
    </div>
  );
}
