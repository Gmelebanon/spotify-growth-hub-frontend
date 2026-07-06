"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import {
  getPlaylist,
  getPlaylistHistory,
  getPlaylistTracks,
  getPlaylists,
  syncPlaylist,
  type Playlist,
  type PlaylistHistoryItem,
  type PlaylistTrack,
} from "@/lib/api/playlists";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type ChartRange = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

function formatNumber(value: number | undefined | null) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

function formatGrowth(value: number | undefined | null) {
  const safe = value ?? 0;
  if (safe > 0) return `+${safe}`;
  return `${safe}`;
}

function getRangeStart(range: ChartRange) {
  const now = new Date();

  if (range === "7d") now.setDate(now.getDate() - 7);
  if (range === "30d") now.setDate(now.getDate() - 30);
  if (range === "90d") now.setDate(now.getDate() - 90);
  if (range === "6m") now.setMonth(now.getMonth() - 6);
  if (range === "1y") now.setFullYear(now.getFullYear() - 1);
  if (range === "all") return null;

  return now;
}

function getHistoryDateValue(item: PlaylistHistoryItem) {
  return item.date || item.created_at || "";
}

function getHistoryDayKey(item: PlaylistHistoryItem) {
  const value = getHistoryDateValue(item);
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return date.toISOString().slice(0, 10);
}

function getHistoryTimestamp(item: PlaylistHistoryItem) {
  const value = getHistoryDateValue(item);
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getDailyHistoryValue(item: PlaylistHistoryItem) {
  const raw = item as PlaylistHistoryItem & {
    growth?: number | null;
    value?: number | null;
    count?: number | null;
  };

  const value = raw.growth ?? raw.value ?? raw.count ?? item.followers ?? 0;
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function buildDailyGrowth(history: PlaylistHistoryItem[], range: ChartRange) {
  const start = getRangeStart(range);

  const latestByDate = new Map<string, PlaylistHistoryItem>();

  history
    .filter((item) => item.created_at || item.date)
    .forEach((item) => {
      const dayKey = getHistoryDayKey(item);
      if (!dayKey) return;

      const existing = latestByDate.get(dayKey);
      if (!existing || getHistoryTimestamp(item) >= getHistoryTimestamp(existing)) {
        latestByDate.set(dayKey, item);
      }
    });

  return [...latestByDate.entries()]
    .map(([dayKey, item]) => {
      const dateValue = item.date || item.created_at || dayKey;
      const date = new Date(dateValue);
      const growth = getDailyHistoryValue(item);

      return {
        date: dateValue,
        dayKey,
        timestamp: Number.isNaN(date.getTime()) ? 0 : date.getTime(),
        followers: growth,
        growth,
      };
    })
    .filter((item) => {
      if (!start) return true;
      if (!item.timestamp) return true;
      return item.timestamp >= start.getTime();
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function downloadCsv(rows: { date: string; followers: number; growth: number }[]) {
  const header = "date,followers,daily_growth";
  const body = rows
    .map((row) => [`"${row.date}"`, row.followers, row.growth].join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "playlist-followers-growth.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function PlaylistDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const playlistId = Number(params.playlistId);
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);
  const accountIdFromUrl = Number(searchParams.get("accountId"));

  const [chartRange, setChartRange] = useState<ChartRange>("all");
  const [tracksOpen, setTracksOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<{
    date: string;
    growth: number;
    followers: number;
  } | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const accounts = accountsQuery.data ?? [];

  const shouldAutoDetect =
    (!Number.isFinite(accountIdFromUrl) || accountIdFromUrl <= 0) &&
    (!(typeof activeAccountId === "number") || activeAccountId <= 0);

  const allPlaylistQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ["playlists", account.id],
      queryFn: () => getPlaylists(account.id),
      enabled: shouldAutoDetect && accounts.length > 0,
    })),
  });

  const autoDetectedAccountId = useMemo(() => {
    for (let index = 0; index < allPlaylistQueries.length; index += 1) {
      const account = accounts[index];
      const playlists = allPlaylistQueries[index].data ?? [];
      const found = playlists.some((playlist: Playlist) => playlist.id === playlistId);

      if (found) return account.id;
    }

    return null;
  }, [accounts, allPlaylistQueries, playlistId]);

  const resolvedAccountId =
    Number.isFinite(accountIdFromUrl) && accountIdFromUrl > 0
      ? accountIdFromUrl
      : typeof activeAccountId === "number" && activeAccountId > 0
        ? activeAccountId
        : autoDetectedAccountId;

  const accountName =
    accounts.find((account) => account.id === resolvedAccountId)?.display_name ||
    `Account ${resolvedAccountId || ""}`;

  const canLoad = Boolean(resolvedAccountId && resolvedAccountId > 0 && playlistId);

  const playlistQuery = useQuery<Playlist>({
    queryKey: ["playlist", resolvedAccountId, playlistId],
    queryFn: () => getPlaylist(resolvedAccountId as number, playlistId),
    enabled: canLoad,
  });

  const historyQuery = useQuery<PlaylistHistoryItem[]>({
    queryKey: ["playlist-history", resolvedAccountId, playlistId],
    queryFn: () => getPlaylistHistory(resolvedAccountId as number, playlistId),
    enabled: canLoad,
  });

  const tracksQuery = useQuery<PlaylistTrack[]>({
    queryKey: ["playlist-tracks", resolvedAccountId, playlistId],
    queryFn: () => getPlaylistTracks(resolvedAccountId as number, playlistId),
    enabled: canLoad && tracksOpen,
  });

  const syncMutation = useMutation({
    mutationFn: () => syncPlaylist(resolvedAccountId as number, playlistId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["playlist", resolvedAccountId, playlistId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["playlist-history", resolvedAccountId, playlistId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["playlist-tracks", resolvedAccountId, playlistId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["playlists", resolvedAccountId],
      });
    },
  });

  const playlist = playlistQuery.data;
  const history = historyQuery.data ?? [];
  const tracks = tracksQuery.data ?? [];

  const playlistSyncSource = (playlist ?? {}) as Playlist & {
    last_synced?: string | null;
    last_synced_at?: string | null;
    synced_at?: string | null;
    updated_at?: string | null;
  };

  const lastSyncedAt =
    playlistSyncSource.last_synced_at ||
    playlistSyncSource.last_synced ||
    playlistSyncSource.synced_at ||
    playlistSyncSource.updated_at ||
    null;

  const dailyGrowth = useMemo(
    () => buildDailyGrowth(history, chartRange),
    [history, chartRange],
  );

  const maxGrowth = Math.max(...dailyGrowth.map((item) => Math.abs(item.growth || 0)), 1);

  const copyPlaylistLink = async () => {
    const link =
      playlist?.spotify_url ||
      (typeof window !== "undefined" ? window.location.href : "");

    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isDetectingAccount =
    !canLoad &&
    accounts.length > 0 &&
    allPlaylistQueries.some((query) => query.isLoading);

  if (accountsQuery.isLoading || isDetectingAccount || playlistQuery.isLoading) {
    return (
      <div className="min-h-screen bg-black px-8 py-10 text-white">
        <Link href="/playlists" className="text-sm font-semibold text-white hover:text-green-400">
          &lt; Back to Playlists
        </Link>
        <div className="mt-6 text-sm text-zinc-400">Loading playlist...</div>
      </div>
    );
  }

  if (!resolvedAccountId || resolvedAccountId <= 0 || !playlist) {
    return (
      <div className="min-h-screen bg-black px-8 py-10 text-white">
        <Link href="/playlists" className="text-sm font-semibold text-white hover:text-green-400">
          &lt; Back to Playlists
        </Link>
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Playlist not found.
        </div>
      </div>
    );
  }

  const titleContent = playlist.spotify_url ? (
    <a
      href={playlist.spotify_url}
      target="_blank"
      rel="noreferrer"
      className="hover:text-green-400"
    >
      {playlist.name}
    </a>
  ) : (
    playlist.name
  );

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/playlists" className="text-sm font-semibold text-white hover:text-green-400">
            &lt; Back to Playlists
          </Link>

          <h1 className="mt-5 max-w-[980px] text-4xl font-semibold leading-tight tracking-tight">
            {titleContent}
          </h1>

          <button
            type="button"
            onClick={copyPlaylistLink}
            className="mt-3 text-sm font-semibold text-green-400 hover:text-green-300"
          >
            {copied ? "Copied playlist link" : "Copy Playlist Link"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="mt-10 rounded-xl bg-green-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncMutation.isPending ? "Syncing..." : "Sync"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid grid-cols-[1fr_110px] items-start gap-4">
              <div className="aspect-square overflow-hidden rounded-xl bg-zinc-900">
                {playlist.image_url ? (
                  <img
                    src={playlist.image_url}
                    alt={playlist.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square w-full bg-zinc-800" />
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="border-b border-zinc-800 pb-3">
                  <div className="text-zinc-400">Followers</div>
                  <div className="font-semibold text-white">
                    {formatNumber(playlist.followers)}
                  </div>
                </div>

                <div className="border-b border-zinc-800 pb-3">
                  <div className="text-zinc-400">Tracks</div>
                  <div className="font-semibold text-white">
                    {formatNumber(playlist.tracks_count)}
                  </div>
                </div>

                <div className="border-b border-zinc-800 pb-3">
                  <div className="text-zinc-400">Account</div>
                  <div className="font-semibold text-white">{accountName}</div>
                </div>

                <div className="border-b border-zinc-800 pb-3">
                  <div className="text-zinc-400">Growth</div>
                  <div className="font-semibold text-white">
                    {formatGrowth(playlist.growth_24h ?? playlist.growth)}
                  </div>
                </div>

                <div>
                  <div className="text-zinc-400">Last Synced</div>
                  <div className="font-semibold text-white">
                    {formatDate(lastSyncedAt)}
                  </div>
                </div>
              </div>
            </div>

            {playlist.description ? (
              <p className="mt-6 whitespace-pre-line text-sm leading-7 text-zinc-400">
                {playlist.description}
              </p>
            ) : (
              <p className="mt-6 text-sm leading-7 text-zinc-500">
                No description available.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h2 className="text-2xl font-semibold">Audience Distribution</h2>

            <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-black p-4 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">🇪🇸</span>
                  <span className="font-semibold text-white">Spain</span>
                </div>
                <span className="text-green-400">#1</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">🇩🇪</span>
                  <span className="font-semibold text-white">Germany</span>
                </div>
                <span className="text-green-400">#2</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">🇺🇸</span>
                  <span className="font-semibold text-white">USA</span>
                </div>
                <span className="text-green-400">#3</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold">Daily Followers Growth</h2>

              <div className="flex items-center gap-2">
                <select
                  value={chartRange}
                  onChange={(event) => setChartRange(event.target.value as ChartRange)}
                  className="h-10 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="6m">Last 6 months</option>
                  <option value="1y">Last year</option>
                  <option value="all">All time</option>
                </select>

                <button
                  type="button"
                  onClick={() => downloadCsv(dailyGrowth)}
                  className="h-10 rounded-xl border border-zinc-800 bg-black px-3 text-sm font-semibold text-green-400 transition hover:border-green-500 hover:text-green-300"
                >
                  Download
                </button>
              </div>
            </div>

            <div className="relative mt-6 h-[360px] rounded-2xl border border-zinc-800 bg-black p-5">
              {hoveredBar ? (
                <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-xl border border-green-500/30 bg-black px-4 py-2 text-xs shadow-xl">
                  <div className="font-semibold text-green-400">
                    {formatGrowth(hoveredBar.growth)}
                  </div>
                  <div className="text-zinc-400">
                    {formatNumber(hoveredBar.followers)} followers
                  </div>
                  <div className="text-zinc-500">{formatDate(hoveredBar.date)}</div>
                </div>
              ) : null}

              {dailyGrowth.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No follower history yet. Press Sync to create snapshots.
                </div>
              ) : (
                <div className="flex h-full items-end gap-1">
                  {dailyGrowth.map((item, index) => {
                    const height = Math.max(
                      6,
                      Math.round((Math.abs(item.growth) / maxGrowth) * 300),
                    );

                    return (
                      <div
                        key={`${item.dayKey || item.date}-${index}`}
                        onMouseEnter={() => setHoveredBar(item)}
                        onMouseLeave={() => setHoveredBar(null)}
                        title={`${formatDate(item.date)} - ${formatGrowth(item.growth)}`}
                        className="flex flex-1 cursor-pointer items-end"
                      >
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            item.growth >= 0
                              ? "bg-green-500 hover:bg-green-300"
                              : "bg-red-500 hover:bg-red-300"
                          }`}
                          style={{ height }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <button
              type="button"
              onClick={() => setTracksOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="text-2xl font-semibold">Tracks</h2>
              <span className="text-2xl font-semibold text-green-400">
                {tracksOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {tracksOpen ? (
              <>
                {tracksQuery.isLoading ? (
                  <div className="mt-5 rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-400">
                    Loading tracks...
                  </div>
                ) : tracksQuery.isError ? (
                  <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    Failed to load tracks.
                  </div>
                ) : tracks.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-500">
                    No tracks found.
                  </div>
                ) : (
                  <div className="mt-5 space-y-2">
                    {tracks.map((track, index) => (
                      <div
                        key={`${track.id}-${track.spotify_id}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black px-4 py-3"
                      >
                        <div className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-800">
                          {track.image_url ? (
                            <img
                              src={track.image_url}
                              alt={track.name}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          {track.spotify_url ? (
                            <a
                              href={track.spotify_url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-semibold text-white hover:text-green-400"
                            >
                              {index + 1}. {track.name}
                            </a>
                          ) : (
                            <div className="truncate text-sm font-semibold text-white">
                              {index + 1}. {track.name}
                            </div>
                          )}

                          <div className="mt-1 truncate text-xs text-zinc-500">
                            {track.artist_name || "Unknown Artist"}
                            {track.album_name ? ` - ${track.album_name}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}