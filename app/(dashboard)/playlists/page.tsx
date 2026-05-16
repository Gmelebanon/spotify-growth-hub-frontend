"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { syncAllPlaylistsForAccount } from "@/lib/api/playlists";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type AccountRow = {
  id: number;
  display_name?: string | null;
  name?: string | null;
};

type DailyHistoryItem = {
  date: string;
  followers?: number | null;
  growth?: number | null;
};

type DailyGrowthItem = {
  date?: string;
  label?: string;
  growth?: number | null;
};

type PlaylistRow = {
  id: number | string;
  account_id?: number | null;
  name: string;
  followers?: number | null;
  saves?: number | null;
  tracks_count?: number | null;
  total_tracks?: number | null;
  track_count?: number | null;
  genre?: string | null;
  spotify_id?: string | null;
  spotify_url?: string | null;
  playlist_url?: string | null;
  external_url?: string | null;
  url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_update?: string | null;
  growth?: number | null;
  growth_24h?: number | null;
  growth_7d?: number | null;
  growth_30d?: number | null;
  today?: number | null;
  today_minus_1?: number | null;
  today_minus_2?: number | null;
  today_minus_3?: number | null;
  today_minus_4?: number | null;
  daily_history?: DailyHistoryItem[];
  daily_growth?: DailyGrowthItem[];
  [key: string]: unknown;
};

type CreatePlaylistPayload = {
  account_id: number;
  name: string;
  import_tracks_url?: string;
};

type CreatedPlaylistDetails = {
  name: string;
  accountName: string;
  tracks: number;
  id: string;
  link: string;
};

const ALL_ACCOUNTS_ID = -1;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://spotify-growth-hub-backend.onrender.com";
const ADS_DATA_STORAGE_KEY = "ads-page-row-data-v17";

async function fetchPlaylistsWithHistory(
  accountId: number,
): Promise<PlaylistRow[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/accounts/${accountId}/playlists?ts=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Failed to load playlists for account ${accountId}`,
    );
  }

  const payload = await response.json();
  const items = Array.isArray(payload)
    ? payload
    : payload.items || payload.playlists || [];

  return items as PlaylistRow[];
}

function playlistKey(playlist: PlaylistRow) {
  return `${playlist.account_id ?? "unknown"}-${playlist.id}`;
}

function getAccountName(accounts: AccountRow[], accountId?: number | null) {
  if (!accountId) return "—";
  const account = accounts.find((item) => item.id === accountId);
  return account?.display_name || account?.name || "—";
}

function truncatePlaylistTitle(title: string, maxLength = 35) {
  return title.length > maxLength ? `${title.slice(0, maxLength)}...` : title;
}

function getTrackCount(playlist: PlaylistRow) {
  return (
    playlist.tracks_count ?? playlist.total_tracks ?? playlist.track_count ?? 0
  );
}

function getPlaylistId(playlist: PlaylistRow) {
  return String(playlist.spotify_id || playlist.id);
}

function getPlaylistUrl(playlist: PlaylistRow) {
  return (
    playlist.spotify_url ||
    playlist.playlist_url ||
    playlist.external_url ||
    playlist.url ||
    `https://open.spotify.com/playlist/${getPlaylistId(playlist)}`
  );
}

function formatDayLabel(dayOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function normalizeHistoryLabel(value?: string | null) {
  if (!value) return "";

  const clean = String(value).trim();

  // Already returned by backend as "5/5".
  if (/^\d{1,2}\/\d{1,2}$/.test(clean)) return clean;

  // ISO date like 2026-05-05 or full ISO datetime.
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getDate()}/${parsed.getMonth() + 1}`;
  }

  return clean;
}

function getDateKeyFromOffset(dayOffset: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - dayOffset);
  return date.toISOString().slice(0, 10);
}

function normalizeHistoryDateKey(value?: string | null) {
  if (!value) return "";

  const clean = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10);
  }

  const labelMatch = clean.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (labelMatch) {
    const currentYear = new Date().getFullYear();
    const month = Number(labelMatch[2]);
    const day = Number(labelMatch[1]);
    return `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function getNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function getFollowerCountForDay(playlist: PlaylistRow, dayOffset: number) {
  const targetKey = getDateKeyFromOffset(dayOffset);

  if (dayOffset === 0) {
    const currentFollowers = getNumericValue(playlist.followers);
    if (currentFollowers !== null) return currentFollowers;
  }

  const fromHistory = playlist.daily_history?.find(
    (item) => normalizeHistoryDateKey(item.date) === targetKey,
  );
  const historyFollowers = getNumericValue(fromHistory?.followers);
  if (historyFollowers !== null) return historyFollowers;

  return null;
}

function getDirectGrowthForDay(playlist: PlaylistRow, dayOffset: number) {
  const label = formatDayLabel(dayOffset);
  const targetKey = getDateKeyFromOffset(dayOffset);

  const fromHistory = playlist.daily_history?.find(
    (item) => normalizeHistoryDateKey(item.date) === targetKey,
  );
  const historyGrowth = getNumericValue(fromHistory?.growth);
  if (historyGrowth !== null) return historyGrowth;

  const fromDailyGrowth = playlist.daily_growth?.find(
    (item) =>
      normalizeHistoryLabel(item.label) === label ||
      normalizeHistoryLabel(item.date) === label ||
      normalizeHistoryDateKey(item.label) === targetKey ||
      normalizeHistoryDateKey(item.date) === targetKey,
  );
  const dailyGrowth = getNumericValue(fromDailyGrowth?.growth);
  if (dailyGrowth !== null) return dailyGrowth;

  return null;
}

function getGrowthValue(playlist: PlaylistRow, dayOffset: number) {
  const followersToday = getFollowerCountForDay(playlist, dayOffset);
  const followersPreviousDay = getFollowerCountForDay(playlist, dayOffset + 1);

  // Correct daily stat logic:
  // each date should show the change from the previous date, not the total
  // follower count for that date.
  if (followersToday !== null && followersPreviousDay !== null) {
    return followersToday - followersPreviousDay;
  }

  const directGrowth = getDirectGrowthForDay(playlist, dayOffset);
  if (directGrowth !== null) return directGrowth;

  // Final fallback for older API fields.
  const possibleKeys = [
    dayOffset === 0 ? "today" : `today_minus_${dayOffset}`,
    dayOffset === 0 ? "growth_24h" : `growth_day_${dayOffset}`,
    dayOffset === 0 ? "growth" : `day_${dayOffset}`,
    `growth_minus_${dayOffset}`,
    `followers_growth_${dayOffset}`,
  ].filter(Boolean) as string[];

  for (const key of possibleKeys) {
    const value = getNumericValue(playlist[key]);
    if (value !== null) return value;
  }

  return 0;
}

function formatGrowth(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function growthColor(value: number) {
  if (value <= 0) return "text-red-400";
  if (value <= 3) return "text-white";
  return "text-green-400";
}

function safeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export default function PlaylistsPage() {
  const queryClient = useQueryClient();
  const activeAccountId = useActiveAccountStore(
    (state) => state.activeAccountId,
  );
  const setActiveAccountId = useActiveAccountStore(
    (state) => state.setActiveAccountId,
  );

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number>(ALL_ACCOUNTS_ID);
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sortField, setSortField] = useState("playlist");
  const [adsGenres, setAdsGenres] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAccountId, setCreateAccountId] = useState<number | "">("");
  const [createName, setCreateName] = useState("");
  const [importTracksUrl, setImportTracksUrl] = useState("");
  const [createdPlaylist, setCreatedPlaylist] =
    useState<CreatedPlaylistDetails | null>(null);

  const dayColumns = useMemo(
    () => Array.from({ length: 30 }, (_, index) => index),
    [],
  );

  const accountsQuery = useQuery<AccountRow[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const accounts = accountsQuery.data ?? [];

  useEffect(() => {
    if (!activeAccountId && accounts.length > 0) {
      setActiveAccountId(accounts[0].id);
    }
  }, [activeAccountId, accounts, setActiveAccountId]);

  useEffect(() => {
    if (accounts.length > 0 && createAccountId === "") {
      setCreateAccountId(accounts[0].id);
    }
  }, [accounts, createAccountId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ADS_DATA_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as Record<string, { genre?: string }>;
      const nextGenres: Record<string, string> = {};

      Object.entries(parsed).forEach(([key, value]) => {
        if (value?.genre && value.genre !== "Genre") {
          nextGenres[key] = value.genre;
        }
      });

      setAdsGenres(nextGenres);
    } catch {
      setAdsGenres({});
    }
  }, []);

  const playlistQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ["playlists", account.id],
      queryFn: () => fetchPlaylistsWithHistory(account.id),
      enabled: accounts.length > 0,
    })),
  });

  const playlists = useMemo(() => {
    return playlistQueries.flatMap((query, index) => {
      const account = accounts[index];
      return ((query.data ?? []) as PlaylistRow[]).map((playlist) => ({
        ...playlist,
        account_id: playlist.account_id ?? account?.id,
      }));
    });
  }, [accounts, playlistQueries]);

  const isLoading =
    accountsQuery.isLoading || playlistQueries.some((query) => query.isLoading);
  const isError =
    accountsQuery.isError || playlistQueries.some((query) => query.isError);

  const getGenre = (playlist: PlaylistRow) => {
    return adsGenres[playlistKey(playlist)] || playlist.genre || "—";
  };

  const genreOptions = useMemo(() => {
    return Array.from(
      new Set(
        playlists
          .map((playlist) => getGenre(playlist))
          .filter((genre) => genre && genre !== "—"),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [playlists, adsGenres]);

  const filtered = useMemo(() => {
    let data = playlists;

    if (accountFilter !== ALL_ACCOUNTS_ID) {
      data = data.filter((playlist) => playlist.account_id === accountFilter);
    }

    if (genreFilter !== "all") {
      data = data.filter((playlist) => getGenre(playlist) === genreFilter);
    }

    const cleanSearch = search.trim().toLowerCase();
    if (cleanSearch) {
      data = data.filter((playlist) =>
        playlist.name.toLowerCase().includes(cleanSearch),
      );
    }

    return [...data].sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1;

      if (sortField === "genre") {
        return getGenre(a).localeCompare(getGenre(b)) * direction;
      }

      if (sortField === "account") {
        return (
          getAccountName(accounts, a.account_id).localeCompare(
            getAccountName(accounts, b.account_id),
          ) * direction
        );
      }

      if (sortField === "followers") {
        return ((a.followers ?? 0) - (b.followers ?? 0)) * direction;
      }

      if (sortField.startsWith("day-")) {
        const day = Number(sortField.replace("day-", ""));
        return (getGrowthValue(a, day) - getGrowthValue(b, day)) * direction;
      }

      return a.name.localeCompare(b.name) * direction;
    });
  }, [
    accountFilter,
    genreFilter,
    playlists,
    search,
    sortOrder,
    sortField,
    adsGenres,
    accounts,
  ]);

  const createPlaylistMutation = useMutation({
    mutationFn: async (payload: CreatePlaylistPayload) => {
      const response = await fetch(`${API_BASE_URL}/api/playlists/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create playlist");
      }

      return response.json();
    },
    onSuccess: async (data: any) => {
      const accountName = getAccountName(accounts, Number(createAccountId));
      const details: CreatedPlaylistDetails = {
        name: data?.name || createName,
        accountName,
        tracks: data?.tracks_count ?? data?.track_count ?? data?.tracks ?? 0,
        id: String(data?.spotify_id || data?.id || "—"),
        link:
          data?.spotify_url ||
          data?.playlist_url ||
          data?.external_url ||
          data?.url ||
          (data?.spotify_id
            ? `https://open.spotify.com/playlist/${data.spotify_id}`
            : "—"),
      };

      setCreatedPlaylist(details);
      setShowCreateModal(false);
      setCreateName("");
      setImportTracksUrl("");

      await Promise.all(
        accounts.map((account) =>
          queryClient.invalidateQueries({
            queryKey: ["playlists", account.id],
          }),
        ),
      );
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      if (accountFilter === ALL_ACCOUNTS_ID) {
        for (const account of accounts) {
          await syncAllPlaylistsForAccount(account.id, 500, 0);
        }
        return;
      }

      await syncAllPlaylistsForAccount(accountFilter, 500, 0);
    },
    onSuccess: async () => {
      await Promise.all(
        accounts.map((account) =>
          queryClient.invalidateQueries({
            queryKey: ["playlists", account.id],
          }),
        ),
      );
    },
  });

  const handleCreatePlaylist = () => {
    if (!createAccountId || !createName.trim()) return;

    createPlaylistMutation.mutate({
      account_id: Number(createAccountId),
      name: createName.trim(),
      import_tracks_url: importTracksUrl.trim() || undefined,
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortOrder("asc");
  };

  const sortIndicator = (field: string) => {
    if (sortField !== field) return "↕";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const downloadCsv = () => {
    const headers = [
      "Playlist",
      "Genre",
      "Account",
      "Followers",
      ...dayColumns.map((day) => formatDayLabel(day)),
    ];

    const rows = filtered.map((playlist) => [
      playlist.name,
      getGenre(playlist),
      getAccountName(accounts, playlist.account_id),
      playlist.followers ?? 0,
      ...dayColumns.map((day) => getGrowthValue(playlist, day)),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(safeCsv).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playlists-30-day-growth.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen overflow-hidden bg-black px-6 py-8 text-white">
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Playlists</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Monitor playlist genres, accounts, followers, and 30-day growth.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search playlist..."
            className="h-10 w-[240px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
          />

          <select
            value={genreFilter}
            onChange={(event) => setGenreFilter(event.target.value)}
            className="h-10 w-[160px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
          >
            <option value="all">All Genres</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>

          <select
            value={accountFilter}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const value = Number(event.target.value);
              setAccountFilter(value);
              setActiveAccountId(value === ALL_ACCOUNTS_ID ? 0 : value);
            }}
            className="h-10 w-[180px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
          >
            <option value={ALL_ACCOUNTS_ID}>All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.display_name ||
                  account.name ||
                  `Account ${account.id}`}
              </option>
            ))}
          </select>

          <Link
            href="/playlists/create"
            className="flex h-10 items-center rounded-xl border border-green-500 bg-black px-5 text-sm font-bold text-green-400 transition hover:bg-green-500/10"
          >
            Create
          </Link>

          <button
            type="button"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending || accounts.length === 0}
            className="h-10 rounded-xl bg-green-500 px-4 text-sm font-bold text-white transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncAllMutation.isPending ? "Syncing..." : "Sync All"}
          </button>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="max-h-[calc(100vh-165px)] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-black [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-500">
          <div className="w-full min-w-0">
            <div className="sticky top-0 z-20 grid grid-cols-[minmax(220px,2fr)_80px_110px_65px_repeat(30,minmax(22px,1fr))] border-b border-zinc-800 bg-zinc-950 px-3 py-3 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
              <button
                type="button"
                onClick={() => handleSort("playlist")}
                className="text-left text-green-400 hover:text-green-300"
              >
                Playlist A&gt;Z {sortIndicator("playlist")}
              </button>
              <button
                type="button"
                onClick={() => handleSort("genre")}
                className="text-left hover:text-green-400"
              >
                Genre {sortIndicator("genre")}
              </button>
              <button
                type="button"
                onClick={() => handleSort("account")}
                className="text-left hover:text-green-400"
              >
                Account {sortIndicator("account")}
              </button>
              <button
                type="button"
                onClick={() => handleSort("followers")}
                className="text-left hover:text-green-400"
              >
                Followers {sortIndicator("followers")}
              </button>
              {dayColumns.map((day) => (
                <button
                  type="button"
                  key={`header-day-${day}`}
                  onClick={() => handleSort(`day-${day}`)}
                  className="text-center hover:text-green-400"
                >
                  {formatDayLabel(day)} {sortIndicator(`day-${day}`)}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="px-4 py-10 text-sm text-zinc-500">
                Loading playlists...
              </div>
            ) : isError ? (
              <div className="px-4 py-10 text-sm text-red-400">
                Failed to load playlists. Make sure the backend is running.
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10 text-sm text-zinc-500">
                No playlists found.
              </div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {filtered.map((playlist, index) => (
                  <div
                    key={`${playlist.account_id ?? "account"}-${playlist.id}-${index}`}
                    className="grid grid-cols-[minmax(220px,2fr)_80px_110px_65px_repeat(30,minmax(22px,1fr))] items-center px-3 py-3 text-[11px] transition hover:bg-zinc-900/70"
                  >
                    <Link
                      href={`/playlists/${playlist.id}`}
                      className="truncate pr-3 font-semibold text-white hover:text-green-400"
                      title={playlist.name}
                    >
                      {truncatePlaylistTitle(playlist.name, 35)}
                    </Link>

                    <div className="truncate pr-3 text-zinc-300">
                      {getGenre(playlist)}
                    </div>
                    <div className="truncate pr-3 text-zinc-300">
                      {getAccountName(accounts, playlist.account_id)}
                    </div>
                    <div className="font-semibold text-white">
                      {playlist.followers ?? 0}
                    </div>

                    {dayColumns.map((day) => {
                      const value = getGrowthValue(playlist, day);
                      return (
                        <div
                          key={`${playlist.account_id ?? "account"}-${playlist.id}-growth-${day}`}
                          className={`text-center font-semibold ${growthColor(value)}`}
                        >
                          {formatGrowth(value)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Playlist</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Create a playlist in the selected Spotify account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-2xl font-bold text-red-500 hover:text-red-400"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Account
                </span>
                <select
                  value={createAccountId}
                  onChange={(event) =>
                    setCreateAccountId(Number(event.target.value))
                  }
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.display_name ||
                        account.name ||
                        `Account ${account.id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Playlist Name
                </span>
                <input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Enter playlist name"
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Import Tracks Optional
                </span>
                <input
                  value={importTracksUrl}
                  onChange={(event) => setImportTracksUrl(event.target.value)}
                  placeholder="Paste Spotify playlist link to copy tracks from"
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
                />
              </label>

              {createPlaylistMutation.error instanceof Error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {createPlaylistMutation.error.message}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreatePlaylist}
                disabled={
                  !createAccountId ||
                  !createName.trim() ||
                  createPlaylistMutation.isPending
                }
                className="h-11 w-full rounded-xl bg-green-500 text-sm font-bold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createPlaylistMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createdPlaylist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={() => setCreatedPlaylist(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Playlist Created</h2>
              <button
                type="button"
                onClick={() => setCreatedPlaylist(null)}
                className="text-2xl font-bold text-red-500 hover:text-red-400"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Name</span>
                <span className="text-right font-semibold">
                  {createdPlaylist.name}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Account Name</span>
                <span className="font-semibold">
                  {createdPlaylist.accountName}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-zinc-800 pb-2">
                <span className="text-zinc-500"># Tracks</span>
                <span className="font-semibold">{createdPlaylist.tracks}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">ID</span>
                <span className="max-w-[300px] truncate font-semibold">
                  {createdPlaylist.id}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Link</span>
                {createdPlaylist.link && createdPlaylist.link !== "—" ? (
                  <a
                    href={createdPlaylist.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-[300px] truncate font-semibold text-green-400 hover:underline"
                  >
                    {createdPlaylist.link}
                  </a>
                ) : (
                  <span className="font-semibold">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
