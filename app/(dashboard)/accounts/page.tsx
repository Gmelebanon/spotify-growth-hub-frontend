"use client";

import { useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

export default function AccountsPage() {
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((state) => state.setActiveAccountId);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-2 text-sm text-zinc-500">Select the Spotify account to use across the app.</p>
      </div>

      {accountsQuery.isLoading ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-400">
          Loading accounts...
        </div>
      ) : null}

      {accountsQuery.error instanceof Error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
          Failed to load accounts: {accountsQuery.error.message}
        </div>
      ) : null}

      {accountsQuery.data && accountsQuery.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accountsQuery.data.map((account) => {
            const isActive = activeAccountId === account.id;

            return (
              <button
                key={account.id}
                onClick={() => setActiveAccountId(account.id)}
                className={`rounded-2xl border p-5 text-left transition ${
                  isActive
                    ? "border-green-500 bg-zinc-900 shadow-[0_0_0_1px_rgba(34,197,94,0.15)]"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className={`text-lg font-semibold ${isActive ? "text-green-400" : "text-white"}`}>
                      {account.display_name || "Unnamed Account"}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500">ID: {account.id}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Spotify User: {account.spotify_user_id || "—"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">Email: {account.email || "—"}</p>
                  </div>

                  {isActive ? (
                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
                      Active
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {accountsQuery.data && accountsQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-500">
          No accounts found.
        </div>
      ) : null}
    </div>
  );
}