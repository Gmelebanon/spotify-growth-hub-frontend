"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAccounts,
  syncAllAccountPlaylists,
  triggerLogin,
  type SpotifyAccount,
  type SyncAllAccountsResponse,
} from "@/lib/api/accounts";
import { ApiError } from "@/lib/api/client";

type SyncState = {
  loading: boolean;
  error: string | null;
  result: SyncAllAccountsResponse | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [syncState, setSyncState] = useState<SyncState>({
    loading: false,
    error: null,
    result: null,
  });

  const loadAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      setAccountsError(null);

      const data = await getAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      setAccountsError(
        error instanceof Error ? error.message : "Failed to load accounts",
      );
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleSyncAll = useCallback(async () => {
    if (syncState.loading) return;

    setSyncState({
      loading: true,
      error: null,
      result: null,
    });

    try {
      const result = await syncAllAccountPlaylists({
        limit: 25,
        offset: 0,
        timeoutMs: 180000,
      });

      setSyncState({
        loading: false,
        error: null,
        result,
      });

      await loadAccounts();
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Failed to sync all accounts";

      setSyncState({
        loading: false,
        error: message,
        result: null,
      });
    }
  }, [loadAccounts, syncState.loading]);

  const activeCount = useMemo(() => {
    return accounts.filter((account) => !account.token_expired).length;
  }, [accounts]);

  const expiredCount = useMemo(() => {
    return accounts.filter((account) => account.token_expired).length;
  }, [accounts]);

  const hasAccounts = accounts.length > 0;

  return (
    <div className="space-y-6 p-6 text-zinc-100">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Spotify Growth Hub
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Sync all connected Spotify accounts from one place. Sync ALL uses
            every account returned by <code>/accounts</code>, not only the
            selected active account.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadAccounts()}
            disabled={accountsLoading || syncState.loading}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>

          {!hasAccounts ? (
            <button
              type="button"
              onClick={triggerLogin}
              disabled={accountsLoading}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Connect Spotify Account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSyncAll()}
              disabled={accountsLoading || syncState.loading}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncState.loading ? "Syncing all accounts..." : "Sync ALL"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Connected Accounts
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {accountsLoading ? "…" : accounts.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Ready
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {accountsLoading ? "…" : activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Expired
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {accountsLoading ? "…" : expiredCount}
          </p>
        </div>
      </div>

      {accountsError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {accountsError}
        </div>
      ) : null}

      {syncState.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {syncState.error}
        </div>
      ) : null}

      {syncState.result ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Success: {syncState.result.ok}
            </span>
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
              Failed: {syncState.result.failed}
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
              Total: {syncState.result.total}
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {syncState.result.results.map((item) => (
                  <tr
                    key={item.accountId}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/70"
                  >
                    <td className="px-3 py-3 text-sm text-white">
                      {item.accountName}
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-400">
                      {item.accountId}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={
                          item.ok
                            ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
                            : "rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300"
                        }
                      >
                        {item.ok ? "Synced" : "Failed"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-400">
                      {item.ok
                        ? item.data?.message ||
                          item.data?.detail ||
                          `Synced account ${item.accountId}`
                        : item.error || "Unknown sync error"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!accountsLoading && !hasAccounts && !accountsError ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xl font-semibold text-white">
              No accounts found
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Connect a Spotify account first, then run Sync ALL to load
              playlists into the database.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={triggerLogin}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                Connect Spotify Account
              </button>

              <button
                type="button"
                onClick={() => void loadAccounts()}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hasAccounts ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Accounts</h2>
            {accountsLoading ? (
              <span className="text-sm text-zinc-500">Loading…</span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {account.display_name}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Spotify User: {account.spotify_user_id}
                    </p>
                  </div>

                  <span
                    className={
                      account.token_expired
                        ? "rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300"
                        : "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
                    }
                  >
                    {account.token_expired ? "Expired" : "Ready"}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-zinc-400">
                  <p>ID: {account.id}</p>
                  <p>Email: {account.email || "—"}</p>
                  <p>Created: {formatDate(account.created_at)}</p>
                  <p>Updated: {formatDate(account.updated_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}