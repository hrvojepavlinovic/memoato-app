export function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="mx-auto grid w-full max-w-screen-lg flex-1 px-4 py-8 sm:px-6 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-20">
      <section className="hidden border-l-2 border-[#ff5c35] pl-6 lg:block">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
          Your life, with context
        </div>
        <h2 className="mt-6 max-w-md text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-neutral-950 dark:text-neutral-100">
          Remember what actually happened.
        </h2>
        <p className="mt-5 max-w-sm text-base leading-7 text-neutral-600 dark:text-neutral-400">
          One quiet place for the details your brain should not have to keep carrying.
        </p>
        <div className="mt-12 grid max-w-sm grid-cols-3 border-y border-neutral-300 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          <span>Private</span>
          <span>Fast</span>
          <span>Human</span>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
        <div className="mb-8 border-b border-neutral-300 pb-4 dark:border-neutral-700 lg:hidden">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400">Your life, with context</div>
          <p className="mt-2 text-xl font-semibold tracking-[-0.035em]">Remember what actually happened.</p>
        </div>
        <div className="card h-fit w-full border-t-2 border-t-neutral-950 px-5 py-7 dark:border-t-neutral-100 sm:px-8 sm:py-9">
          {children}
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
          <span>Private by default</span>
          <a href="https://memoato.com/privacy-first" className="hover:text-neutral-950 dark:hover:text-white">Privacy →</a>
        </div>
      </section>
    </div>
  );
}
