import { useAuth } from "wasp/client/auth";
import { getSudoOverview, useQuery } from "wasp/client/operations";

function formatDate(d: Date): string {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}

function NotFound() {
  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <div className="text-2xl font-semibold tracking-tight">404</div>
      <div className="mt-1 text-sm text-neutral-500">Not found.</div>
    </div>
  );
}

export function SudoPage() {
  const auth = useAuth();
  const q = useQuery(getSudoOverview, undefined, { enabled: !!auth.data, retry: false });

  if (auth.isLoading) {
    return <div className="mx-auto w-full max-w-screen-lg px-4 py-10 text-sm text-neutral-500">Loading…</div>;
  }

  if (!auth.data) {
    return <NotFound />;
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-10 text-sm text-neutral-500">
        Checking access…
      </div>
    );
  }

  if (q.isError || !q.isSuccess) {
    return <NotFound />;
  }

  const { totals, users } = q.data;

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Sudo</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="card p-3">
            <div className="text-xs font-medium text-neutral-500">Total users</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{totals.users}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-medium text-neutral-500">Total categories</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{totals.categories}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-medium text-neutral-500">Total entries</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{totals.entries}</div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-1 gap-2 border-b border-neutral-200 bg-neutral-50 p-3 text-xs font-semibold text-neutral-600 sm:grid-cols-[1.2fr_1.4fr_0.8fr_0.9fr_0.8fr_0.8fr]">
          <div>Username</div>
          <div>Email</div>
          <div>Role</div>
          <div>Registered</div>
          <div className="text-right">Categories</div>
          <div className="text-right">Entries</div>
        </div>
        <div className="divide-y divide-neutral-200">
          {users.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-1 gap-2 p-3 text-sm sm:grid-cols-[1.2fr_1.4fr_0.8fr_0.9fr_0.8fr_0.8fr]"
            >
              <div className="font-semibold text-neutral-900">{u.username}</div>
              <div className="text-neutral-700">{u.email ?? "—"}</div>
              <div className="font-medium text-neutral-700">{u.role}</div>
              <div className="text-neutral-700">{formatDate(u.createdAt)}</div>
              <div className="text-right font-semibold tabular-nums text-neutral-900">
                {u.categoriesCount}
              </div>
              <div className="text-right font-semibold tabular-nums text-neutral-900">
                {u.entriesCount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
