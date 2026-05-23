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

type ArtistSyncMetadataResult = {
  success: boolean;
  synced: number;
  failed: number;
  total: number;
  results?: Array<{
    artistId: string;
    name?: string | null;
    ok: boolean;
    message?: string;
    error?: string;
  }>;
};

type SyncState = {
  loading: boolean;
  error: string | null;
  result: SyncAllAccountsResponse | null;
  artistSync: ArtistSyncMetadataResult | null;
  completedAt: string | null;
};

type StatusTone = "emerald" | "amber" | "red" | "zinc";

type ActivityItem = {
  title: string;
  description: string;
  time: string | null;
  tone: StatusTone;
};

type SevenDaySyncStat = {
  key: string;
  label: string;
  date: Date;
  syncTimes: string[];
  latestSync: string | null;
  count: number;
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "No data yet";

  const date = new Date(value);
  const time = date.getTime();

  if (Number.isNaN(time)) return "No data yet";

  const diffMs = Date.now() - time;
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return "Just now";
  if (absMs < hour) return `${Math.round(absMs / minute)} min ago`;
  if (absMs < day) return `${Math.round(absMs / hour)}h ago`;

  return `${Math.round(absMs / day)}d ago`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeOnly(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getBackendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://spotify-growth-hub-backend.onrender.com"
  );
}

async function syncArtistLibraryMetadata() {
  const backendBaseUrl = getBackendBaseUrl();

  const response = await fetch(`${backendBaseUrl}/api/artist-library/sync-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || "Failed to sync artist metadata",
    );
  }

  return data as ArtistSyncMetadataResult;
}

function isDateLike(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function collectSyncTimestamps(value: unknown, depth = 0): string[] {
  if (!value || depth > 3) return [];

  const timestamps: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item) => {
      timestamps.push(...collectSyncTimestamps(item, depth + 1));
    });
    return timestamps;
  }

  if (typeof value !== "object") return timestamps;

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    const normalizedKey = key.toLowerCase();
    const isSyncDateField =
      normalizedKey.includes("sync") ||
      normalizedKey.includes("push") ||
      normalizedKey.includes("import") ||
      normalizedKey.includes("fetch") ||
      normalizedKey.includes("crawl") ||
      normalizedKey.includes("updated_at") ||
      normalizedKey.includes("created_at") ||
      normalizedKey.includes("completed_at") ||
      normalizedKey.includes("last_run");

    if (isSyncDateField && isDateLike(item)) {
      timestamps.push(String(item));
      return;
    }

    if (item && typeof item === "object") {
      timestamps.push(...collectSyncTimestamps(item, depth + 1));
    }
  });

  return timestamps;
}

function getLatestSyncTimestamp(value: unknown) {
  return collectSyncTimestamps(value).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )[0] || null;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getStatusClasses(tone: StatusTone) {
  const classes = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    zinc: "border-zinc-700 bg-zinc-900 text-zinc-300",
  };

  return classes[tone];
}

function MetricCard({
  label,
  value,
  helper,
  tone = "zinc",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: StatusTone;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </p>
        <span
          className={`h-2.5 w-2.5 rounded-full ${tone === "emerald" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-400" : "bg-zinc-500"}`}
        />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-zinc-500">{helper}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.45)] transition-all"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [syncState, setSyncState] = useState<SyncState>({
    loading: false,
    error: null,
    result: null,
    artistSync: null,
    completedAt: null,
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
      artistSync: null,
      completedAt: null,
    });

    try {
      const result = await syncAllAccountPlaylists({
        limit: 25,
        offset: 0,
        timeoutMs: 180000,
      });

      let artistSync: ArtistSyncMetadataResult | null = null;
      let artistSyncError: string | null = null;

      try {
        artistSync = await syncArtistLibraryMetadata();
      } catch (error) {
        artistSyncError =
          error instanceof Error
            ? error.message
            : "Artist metadata sync failed";
      }

      setSyncState({
        loading: false,
        error: artistSyncError,
        result,
        artistSync,
        completedAt: new Date().toISOString(),
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
        artistSync: null,
        completedAt: null,
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

  const syncLogItems = useMemo(() => {
    return [...accounts]
      .sort((a, b) => {
        const aTime = new Date(getLatestSyncTimestamp(a) || 0).getTime();
        const bTime = new Date(getLatestSyncTimestamp(b) || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [accounts]);

  const latestSyncDate = useMemo(() => {
    const first = syncLogItems[0];
    return syncState.completedAt || getLatestSyncTimestamp(first) || null;
  }, [syncLogItems, syncState.completedAt]);

  const lastThreePushes = useMemo(() => {
    const dates = new Set<string>();

    if (syncState.completedAt) dates.add(syncState.completedAt);

    syncLogItems.forEach((account) => {
      collectSyncTimestamps(account).forEach((date) => dates.add(date));
    });

    return Array.from(dates)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 3);
  }, [syncLogItems, syncState.completedAt]);

  const sevenDaySyncStats = useMemo<SevenDaySyncStat[]>(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = startOfLocalDay(now);
      day.setDate(day.getDate() - index);

      return {
        key: getLocalDateKey(day),
        label: index === 0 ? "Today" : formatDayLabel(day),
        date: day,
        syncTimes: [] as string[],
        latestSync: null as string | null,
        count: 0,
      };
    });

    const dayMap = new Map(days.map((day) => [day.key, day]));
    const dates = new Set<string>();

    if (syncState.completedAt) dates.add(syncState.completedAt);

    accounts.forEach((account) => {
      collectSyncTimestamps(account).forEach((date) => dates.add(date));
    });

    Array.from(dates).forEach((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return;

      const key = getLocalDateKey(date);
      const day = dayMap.get(key);
      if (!day) return;

      day.syncTimes.push(value);
    });

    return days.map((day) => {
      const syncTimes = [...day.syncTimes].sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
      );

      return {
        ...day,
        syncTimes,
        latestSync: syncTimes[0] || null,
        count: syncTimes.length,
      };
    });
  }, [accounts, syncState.completedAt]);

  const totalSevenDaySyncs = useMemo(() => {
    return sevenDaySyncStats.reduce((total, day) => total + day.count, 0);
  }, [sevenDaySyncStats]);

  const healthScore = useMemo(() => {
    if (!hasAccounts) return 0;

    const connectionScore = (activeCount / accounts.length) * 70;
    const syncScore = latestSyncDate ? 20 : 0;
    const errorScore = syncState.error || accountsError ? 0 : 10;

    return Math.round(connectionScore + syncScore + errorScore);
  }, [
    accounts.length,
    accountsError,
    activeCount,
    hasAccounts,
    latestSyncDate,
    syncState.error,
  ]);

  const healthTone: StatusTone =
    healthScore >= 90 ? "emerald" : healthScore >= 65 ? "amber" : "red";
  const successRate = syncState.result?.total
    ? Math.round((syncState.result.ok / syncState.result.total) * 100)
    : hasAccounts
      ? Math.round((activeCount / accounts.length) * 100)
      : 0;

  const warningCount =
    expiredCount + (accountsError ? 1 : 0) + (syncState.error ? 1 : 0);

  const activityFeed = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    if (syncState.result) {
      items.push({
        title: "Manual sync completed",
        description: `${syncState.result.ok} accounts synced, ${syncState.result.failed} failed`,
        time: syncState.completedAt,
        tone: syncState.result.failed > 0 ? "amber" : "emerald",
      });
    }

    if (syncState.artistSync) {
      items.push({
        title: "Artist library synced",
        description: `${syncState.artistSync.synced} artists updated, ${syncState.artistSync.failed} failed`,
        time: syncState.completedAt,
        tone: syncState.artistSync.failed > 0 ? "amber" : "emerald",
      });
    }

    if (syncState.error) {
      items.push({
        title: "Sync failed",
        description: syncState.error,
        time: new Date().toISOString(),
        tone: "red",
      });
    }

    accounts.slice(0, 4).forEach((account) => {
      items.push({
        title: account.token_expired
          ? "Reconnect required"
          : "Account operational",
        description: `${account.display_name} ${account.token_expired ? "has an expired token" : "is connected and ready"}`,
        time: getLatestSyncTimestamp(account),
        tone: account.token_expired ? "red" : "emerald",
      });
    });

    if (items.length === 0) {
      items.push({
        title: "Waiting for first connection",
        description:
          "Connect Spotify to start collecting growth and sync activity.",
        time: null,
        tone: "zinc",
      });
    }

    return items.slice(0, 6);
  }, [
    accounts,
    syncState.artistSync,
    syncState.completedAt,
    syncState.error,
    syncState.result,
  ]);

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_top_left,rgba(39,39,42,0.9),transparent_34%)] p-6 text-zinc-100">
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Command Center
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Spotify Growth Hub Dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Monitor account connections, cron-job data pushes, playlist syncs,
            automation health, and growth operations from one control room.
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
              {syncState.loading ? "Syncing all data..." : "Sync ALL"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Platform Health"
          value={`${accountsLoading ? "…" : healthScore}%`}
          helper={`${warningCount} warning${warningCount === 1 ? "" : "s"} detected`}
          tone={healthTone}
        />
        <MetricCard
          label="Connected Accounts"
          value={accountsLoading ? "…" : accounts.length}
          helper={`${activeCount} ready / ${expiredCount} expired`}
          tone={expiredCount > 0 ? "amber" : "emerald"}
        />
        <MetricCard
          label="Sync Success Rate"
          value={`${accountsLoading ? "…" : successRate}%`}
          helper={
            syncState.result
              ? "From latest manual sync"
              : "Based on active connections"
          }
          tone={
            successRate >= 90 ? "emerald" : successRate >= 65 ? "amber" : "red"
          }
        />
        <MetricCard
          label="Last Data Push"
          value={accountsLoading ? "…" : formatRelativeTime(latestSyncDate)}
          helper={formatDate(latestSyncDate)}
          tone={latestSyncDate ? "emerald" : "zinc"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Cron Job Sync Monitor
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Website Data Pushes
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Track the latest 3 pushes and the exact sync dates/times for the
                last 7 days.
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${syncState.loading ? getStatusClasses("emerald") : getStatusClasses(latestSyncDate ? "emerald" : "zinc")}`}
            >
              {syncState.loading
                ? "Cron-style sync running…"
                : latestSyncDate
                  ? "Data pipeline active"
                  : "Waiting for data"}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((index) => {
              const date = lastThreePushes[index];

              return (
                <div
                  key={`push-${index}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Push #{index + 1}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {formatDate(date)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatRelativeTime(date)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/25 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Last 7 Days
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  Sync Date & Time Log
                </h3>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {totalSevenDaySyncs} sync event
                {totalSevenDaySyncs === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-7 md:grid-cols-2">
              {sevenDaySyncStats.map((day) => (
                <div
                  key={day.key}
                  className={`min-h-[132px] rounded-2xl border p-3 ${
                    day.count > 0
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {day.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {day.date.toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${day.count > 0 ? "bg-emerald-400 text-black" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      {day.count}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {day.syncTimes.length > 0 ? (
                      day.syncTimes.slice(0, 3).map((time) => (
                        <div
                          key={time}
                          className="rounded-xl border border-black/20 bg-black/25 px-2.5 py-2"
                        >
                          <p className="text-xs font-semibold text-emerald-200">
                            {formatTimeOnly(time)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            {formatRelativeTime(time)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-zinc-800 bg-black/20 px-2.5 py-2 text-xs text-zinc-500">
                        No cron log found
                      </p>
                    )}

                    {day.syncTimes.length > 3 ? (
                      <p className="text-[10px] text-zinc-500">
                        +{day.syncTimes.length - 3} more sync
                        {day.syncTimes.length - 3 === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800">
            <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
              <span>Account</span>
              <span>Last Synced</span>
              <span>Status</span>
              <span>Freshness</span>
            </div>

            {accountsLoading ? (
              <div className="px-4 py-4 text-sm text-zinc-500">
                Loading sync log…
              </div>
            ) : syncLogItems.length > 0 ? (
              syncLogItems.map((account) => (
                <div
                  key={`sync-log-${account.id}`}
                  className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] border-b border-zinc-800 px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="font-medium text-white">
                    {account.display_name}
                  </span>
                  <span className="text-zinc-400">
                    {formatDate(getLatestSyncTimestamp(account))}
                  </span>
                  <span
                    className={
                      account.token_expired
                        ? "text-red-300"
                        : "text-emerald-300"
                    }
                  >
                    {account.token_expired ? "Expired" : "Connected"}
                  </span>
                  <span className="text-zinc-500">
                    {formatRelativeTime(
                      getLatestSyncTimestamp(account),
                    )}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-zinc-500">
                No sync log yet. Run Sync ALL to create the first sync entry.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Operational Score
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-semibold tracking-tight text-white">
                {accountsLoading ? "…" : healthScore}
              </p>
              <p className="mt-1 text-sm text-zinc-500">out of 100</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(healthTone)}`}
            >
              {healthScore >= 90
                ? "Excellent"
                : healthScore >= 65
                  ? "Needs attention"
                  : "Critical"}
            </span>
          </div>
          <div className="mt-5">
            <ProgressBar value={healthScore} />
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm">
              <span className="text-zinc-400">Account readiness</span>
              <span className="font-semibold text-white">
                {activeCount}/{accounts.length || 0}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm">
              <span className="text-zinc-400">Token issues</span>
              <span
                className={
                  expiredCount > 0
                    ? "font-semibold text-red-300"
                    : "font-semibold text-emerald-300"
                }
              >
                {expiredCount}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm">
              <span className="text-zinc-400">Latest sync result</span>
              <span className="font-semibold text-white">
                {syncState.result
                  ? `${syncState.result.ok}/${syncState.result.total}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Automation Metrics
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Worker Activity
          </h2>
          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-zinc-400">Playlist sync automation</span>
                <span className="text-white">{successRate}%</span>
              </div>
              <ProgressBar value={successRate} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs text-zinc-500">Runs today</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {syncState.result ? 1 : 0}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs text-zinc-500">Retry count</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {syncState.result?.failed || 0}
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-zinc-500">
              Connect this card later to your cron execution table for duration,
              queue size, retry attempts, and worker latency.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            AI Growth Insights
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Recommendations
          </h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-300">
                Keep sync freshness high
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Trigger automatic syncs before reporting dashboards load.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-sm font-semibold text-white">
                Track playlist movement
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Add ranking, saves, streams, and follower deltas per playlist.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-sm font-semibold text-white">Detect spikes</p>
              <p className="mt-1 text-sm text-zinc-400">
                Highlight abnormal listener, save, or stream growth
                automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Error Center
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Warnings</h2>
          <div className="mt-5 space-y-3">
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
            {expiredCount > 0 ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                {expiredCount} Spotify account{expiredCount === 1 ? "" : "s"}{" "}
                need reconnection.
              </div>
            ) : null}
            {!accountsError && !syncState.error && expiredCount === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                No critical errors detected.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {syncState.result ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
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
            {syncState.artistSync ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                Artists synced: {syncState.artistSync.synced}/{syncState.artistSync.total}
              </span>
            ) : null}
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
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xl font-semibold text-white">
              No accounts found
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Connect a Spotify account first, then run Sync ALL to load
              playlists into the database and activate dashboard monitoring.
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
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Live Activity Feed
              </h2>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                Live
              </span>
            </div>
            <div className="space-y-3">
              {activityFeed.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(item.tone)}`}
                    >
                      {formatRelativeTime(item.time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Connected Accounts
              </h2>
              {accountsLoading ? (
                <span className="text-sm text-zinc-500">Loading…</span>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
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
                      {account.token_expired ? "Expired" : "Connected"}
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
        </div>
      ) : null}
    </div>
  );
}
