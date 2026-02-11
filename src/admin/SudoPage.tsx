import { useAuth } from "wasp/client/auth";
import { getSudoOverview, useQuery } from "wasp/client/operations";
import React from "react";

function formatDate(d: Date): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function NotFound() {
  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-10">
      <div className="text-2xl font-semibold tracking-tight">404</div>
      <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Not found.</div>
    </div>
  );
}

export function SudoPage() {
  const auth = useAuth();
  const q = useQuery(getSudoOverview, undefined, { enabled: !!auth.data, retry: false });
  const [sortKey, setSortKey] = React.useState<"createdAt" | "categoriesCount" | "entriesCount" | "lastEntryAt">("createdAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const totals = q.data?.totals ?? { users: 0, categories: 0, entries: 0 };
  const users = q.data?.users ?? [];
  const sortedUsers = React.useMemo(() => {
    const copy = [...users];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortKey === "createdAt") {
        return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      if (sortKey === "lastEntryAt") {
        const aa = a.lastEntryAt ? new Date(a.lastEntryAt).getTime() : 0;
        const bb = b.lastEntryAt ? new Date(b.lastEntryAt).getTime() : 0;
        return dir * (aa - bb);
      }
      if (sortKey === "categoriesCount") return dir * (a.categoriesCount - b.categoriesCount);
      if (sortKey === "entriesCount") return dir * (a.entriesCount - b.entriesCount);
      return 0;
    });
    return copy;
  }, [users, sortDir, sortKey]);

  if (auth.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-10 text-sm text-neutral-500 dark:text-neutral-400">
        Loading…
      </div>
    );
  }

  if (!auth.data) {
    return <NotFound />;
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-screen-lg px-4 py-10 text-sm text-neutral-500 dark:text-neutral-400">
        Checking access…
      </div>
    );
  }

  if (q.isError || !q.isSuccess) {
    return <NotFound />;
  }

  function toggleSort(nextKey: typeof sortKey) {
    if (nextKey === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: typeof sortKey): string {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Sudo</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="card p-3">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Total users</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{totals.users}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Total categories</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{totals.categories}</div>
          </div>
          <div className="card p-3">
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Total entries</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{totals.entries}</div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-1 gap-2 border-b border-neutral-200 bg-neutral-50 p-3 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 sm:grid-cols-[1.2fr_1.4fr_0.9fr_0.9fr_0.8fr_0.8fr]">
          <div>Username</div>
          <div>Email</div>
          <button type="button" onClick={() => toggleSort("createdAt")} className="text-left hover:underline">
            Registered{sortIndicator("createdAt")}
          </button>
          <button type="button" onClick={() => toggleSort("lastEntryAt")} className="text-left hover:underline">
            Last entry{sortIndicator("lastEntryAt")}
          </button>
          <button type="button" onClick={() => toggleSort("categoriesCount")} className="text-right hover:underline">
            Categories{sortIndicator("categoriesCount")}
          </button>
          <button type="button" onClick={() => toggleSort("entriesCount")} className="text-right hover:underline">
            Entries{sortIndicator("entriesCount")}
          </button>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {sortedUsers.map((u) => (
            <div
              key={u.id}
              className="grid min-w-0 grid-cols-1 gap-2 p-3 text-sm sm:grid-cols-[1.2fr_1.4fr_0.9fr_0.9fr_0.8fr_0.8fr]"
            >
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">{u.username}</div>
              <div
                className="min-w-0 truncate text-neutral-700 dark:text-neutral-300"
                title={u.email ?? ""}
              >
                {u.email ?? "n/a"}
              </div>
              <div className="text-neutral-700 dark:text-neutral-300">{formatDate(u.createdAt)}</div>
              <div className="text-neutral-700 dark:text-neutral-300">{u.lastEntryAt ? formatDate(u.lastEntryAt) : "—"}</div>
              <div className="text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {u.categoriesCount}
              </div>
              <div className="text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                {u.entriesCount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
