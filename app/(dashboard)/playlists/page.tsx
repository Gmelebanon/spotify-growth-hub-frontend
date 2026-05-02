"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { getPlaylists, syncAllPlaylistsForAccount } from "@/lib/api/playlists";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type SortField =
  | "playlist"
  | "genre"
  | "account"
  | "followers"
  | "tracks"
  | "growth24h"
  | "growth7d"
  | "growth30d";

type SortOrder = "asc" | "desc";

type AccountRow = {
  id: number;
  display_name?: string;
};

type PlaylistRow = {
  id: number;
  account_id?: number;
  name: string;
  followers: number;
  tracks_count?: number;
  growth?: number;
  growth_24h?: number;
  growth_7d?: number;
  growth_30d?: number;
  genre?: string | null;
};

const ALL_ACCOUNTS_ID = -1;
const GENRES_STORAGE_KEY = "playlist-page-genres-v2";
const PLAYLIST_GENRES_STORAGE_KEY = "playlist-page-playlist-genres-v2";

function playlistGenreKey(playlist: PlaylistRow) {
  return `${playlist.account_id ?? "unknown"}-${playlist.id}`;
}

function getGrowth24h(playlist: PlaylistRow) {
  return playlist.growth_24h ?? playlist.growth ?? 0;
}

function getGrowth7d(playlist: PlaylistRow) {
  return playlist.growth_7d ?? 0;
}

function getGrowth30d(playlist: PlaylistRow) {
  return playlist.growth_30d ?? 0;
}

function formatGrowth(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

export default function PlaylistsPage() {
  const queryClient = useQueryClient();

  const activeAccountId = useActiveAccountStore((s) => s.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((s) => s.setActiveAccountId);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("followers");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [genres, setGenres] = useState<string[]>(["Pop", "House", "Techno"]);
  const [playlistGenres, setPlaylistGenres] = useState<Record<string, string>>({});
  const [genreFilter, setGenreFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState<number>(ALL_ACCOUNTS_ID);

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
    try {
      const storedGenres = window.localStorage.getItem(GENRES_STORAGE_KEY);
      const storedPlaylistGenres = window.localStorage.getItem(PLAYLIST_GENRES_STORAGE_KEY);

      if (storedGenres) setGenres(JSON.parse(storedGenres));
      if (storedPlaylistGenres) setPlaylistGenres(JSON.parse(storedPlaylistGenres));
    } catch {
      setGenres(["Pop", "House", "Techno"]);
      setPlaylistGenres({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GENRES_STORAGE_KEY, JSON.stringify(genres));
  }, [genres]);

  useEffect(() => {
    window.localStorage.setItem(
      PLAYLIST_GENRES_STORAGE_KEY,
      JSON.stringify(playlistGenres),
    );
  }, [playlistGenres]);

  const singleAccountPlaylistsQuery = useQuery({
    queryKey: ["playlists", activeAccountId],
    queryFn: () => getPlaylists(activeAccountId as number),
    enabled: !!activeAccountId && activeAccountId !== ALL_ACCOUNTS_ID,
  });

  const allAccountPlaylistQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ["playlists", account.id],
      queryFn: () => getPlaylists(account.id),
      enabled: activeAccountId === ALL_ACCOUNTS_ID,
    })),
  });

  const playlistsData = useMemo(() => {
    if (activeAccountId === ALL_ACCOUNTS_ID) {
      return allAccountPlaylistQueries.flatMap((query, index) => {
        const account = accounts[index];

        return ((query.data ?? []) as PlaylistRow[]).map((playlist) => ({
          ...playlist,
          account_id: playlist.account_id ?? account?.id,
        }));
      });
    }

    return ((singleAccountPlaylistsQuery.data ?? []) as PlaylistRow[]).map(
      (playlist) => ({
        ...playlist,
        account_id: playlist.account_id ?? activeAccountId ?? undefined,
      }),
    );
  }, [
    activeAccountId,
    accounts,
    allAccountPlaylistQueries,
    singleAccountPlaylistsQuery.data,
  ]);

  const isLoading =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountPlaylistQueries.some((query) => query.isLoading)
      : singleAccountPlaylistsQuery.isLoading;

  const isError =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountPlaylistQueries.some((query) => query.isError)
      : singleAccountPlaylistsQuery.isError;

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      if (activeAccountId === ALL_ACCOUNTS_ID) {
        for (const account of accounts) {
  await syncAllPlaylistsForAccount(account.id, 500, 0);
}
        return;
      }

      await syncAllPlaylistsForAccount(activeAccountId as number, 500, 0);
    },
    onSuccess: async () => {
      if (activeAccountId === ALL_ACCOUNTS_ID) {
        await Promise.all(
          accounts.map((account) =>
            queryClient.invalidateQueries({
              queryKey: ["playlists", account.id],
            }),
          ),
        );
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ["playlists", activeAccountId],
      });
    },
  });

  const getAccountName = (accountId?: number) => {
    if (!accountId) return "—";
    return accounts.find((account) => account.id === accountId)?.display_name || "—";
  };

  const filtered = useMemo(() => {
    let data = playlistsData;

    if (search) {
      data = data.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (genreFilter !== "all") {
      data = data.filter((p) => playlistGenres[playlistGenreKey(p)] === genreFilter);
    }

    if (accountFilter !== ALL_ACCOUNTS_ID) {
      data = data.filter((p) => p.account_id === accountFilter);
    }

    return [...data].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;

      if (sortField === "playlist") {
        return a.name.localeCompare(b.name) * dir;
      }

      if (sortField === "genre") {
        const genreA = playlistGenres[playlistGenreKey(a)] || "";
        const genreB = playlistGenres[playlistGenreKey(b)] || "";
        return genreA.localeCompare(genreB) * dir;
      }

      if (sortField === "account") {
        return getAccountName(a.account_id).localeCompare(getAccountName(b.account_id)) * dir;
      }

      if (sortField === "followers") return (a.followers - b.followers) * dir;
      if (sortField === "tracks") return ((a.tracks_count ?? 0) - (b.tracks_count ?? 0)) * dir;
      if (sortField === "growth24h") return (getGrowth24h(a) - getGrowth24h(b)) * dir;
      if (sortField === "growth7d") return (getGrowth7d(a) - getGrowth7d(b)) * dir;
      if (sortField === "growth30d") return (getGrowth30d(a) - getGrowth30d(b)) * dir;

      return 0;
    });
  }, [
    playlistsData,
    search,
    sortField,
    sortOrder,
    playlistGenres,
    genreFilter,
    accountFilter,
    accounts,
  ]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortOrder("asc");
  };

  const arrowFor = (field: SortField) => {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const headerClass = (field: SortField) =>
  `cursor-pointer font-semibold ${
    sortField === field ? "text-green-400" : "text-zinc-400"
  }`;

  const handleAddGenre = (playlist: PlaylistRow) => {
    const name = window.prompt("Enter new genre name");
    if (!name) return;

    const cleaned = name.trim();
    if (!cleaned) return;

    const exists = genres.some(
      (genre) => genre.toLowerCase() === cleaned.toLowerCase(),
    );

    if (!exists) {
      setGenres([...genres, cleaned]);
    }

    setPlaylistGenres({
      ...playlistGenres,
      [playlistGenreKey(playlist)]: cleaned,
    });
  };

  const handleGenreChange = async (p: PlaylistRow, value: string) => {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  let finalGenre = value;

  if (value === "__add__") {
    const name = window.prompt("Enter genre");
    if (!name) return;

    finalGenre = name.trim();
    if (!finalGenre) return;

    const exists = genres.some(
      (genre) => genre.toLowerCase() === finalGenre.toLowerCase(),
    );

    if (!exists) {
      setGenres([...genres, finalGenre]);
    }
  }

  setPlaylistGenres({
    ...playlistGenres,
    [playlistGenreKey(p)]: finalGenre,
  });

  await fetch(`${API_BASE_URL}/api/playlists/${p.id}/genre`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      genre: finalGenre || null,
    }),
  });
};

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Playlists</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Browse, switch accounts, sync data, and open details.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="mb-2 block text-xs text-zinc-400">ACTIVE ACCOUNT</label>
            <select
              value={activeAccountId ?? ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                setActiveAccountId(value);
                setAccountFilter(value);
              }}
              className="h-11 w-[220px] rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-white"
            >
              <option value={ALL_ACCOUNTS_ID}>All Accounts</option>

              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.display_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => syncAllMutation.mutate()}
            disabled={!activeAccountId || syncAllMutation.isPending}
            className="h-11 rounded-xl bg-green-600 px-5 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncAllMutation.isPending ? "Syncing..." : "Sync All"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-xl font-semibold">Library</h2>

          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search playlist..."
              className="h-10 w-[260px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white"
            />

            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="h-10 w-[160px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white"
            >
              <option value="all">All Genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>

          
          </div>
        </div>

        <div className="grid grid-cols-[minmax(240px,1fr)_130px_140px_100px_100px_100px_110px_100px] border-b border-zinc-800 px-5 py-3 text-xs">
  <div className={headerClass("playlist")} onClick={() => toggleSort("playlist")}>
    Playlist A&gt;Z {arrowFor("playlist")}
  </div>

  <div className={headerClass("genre")} onClick={() => toggleSort("genre")}>
    Genre {arrowFor("genre")}
  </div>

  <div className={headerClass("account")} onClick={() => toggleSort("account")}>
    Account {arrowFor("account")}
  </div>

  <div className={headerClass("growth24h")} onClick={() => toggleSort("growth24h")}>
    24 H {arrowFor("growth24h")}
  </div>

  <div className={headerClass("growth7d")} onClick={() => toggleSort("growth7d")}>
    7 D {arrowFor("growth7d")}
  </div>

  <div className={headerClass("growth30d")} onClick={() => toggleSort("growth30d")}>
    30 D {arrowFor("growth30d")}
  </div>

  <div className={headerClass("followers")} onClick={() => toggleSort("followers")}>
    Followers {arrowFor("followers")}
  </div>

  <div className={headerClass("tracks")} onClick={() => toggleSort("tracks")}>
    Tracks {arrowFor("tracks")}
  </div>
</div>

        {isLoading ? (
          <div className="px-5 py-8 text-sm text-zinc-400">Loading playlists...</div>
        ) : isError ? (
          <div className="px-5 py-8 text-sm text-red-400">
            Failed to load playlists.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-sm text-zinc-400">
            No playlists found.
          </div>
        ) : (
          <div>
            {filtered.map((p) => (
              <div
                key={`${p.account_id}-${p.id}`}
                className="grid grid-cols-[minmax(240px,1fr)_130px_140px_100px_100px_100px_110px_100px] border-b border-zinc-900 px-5 py-4 text-sm"
              >
                <Link
                  href={`/playlists/${p.id}`}
                  className="truncate text-white hover:text-green-400"
                >
                  {p.name}
                </Link>

                <div>
                  <select
                    value={playlistGenres[playlistGenreKey(p)] || ""}
                    onChange={(e) => handleGenreChange(p, e.target.value)}
                    className="h-8 w-[110px] rounded-lg border border-zinc-800 bg-black px-2 text-xs text-white outline-none focus:border-green-500"
                  >
                    <option value="">Select</option>

                    {genres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}

                    <option value="__add__">+ Add Genre</option>
                  </select>
                </div>

                <div className="truncate text-xs text-zinc-400">
                  {getAccountName(p.account_id)}
                </div>

                <div className="text-green-400">{formatGrowth(getGrowth24h(p))}</div>
                <div className="text-green-400">{formatGrowth(getGrowth7d(p))}</div>
                <div className="text-green-400">{formatGrowth(getGrowth30d(p))}</div>
                <div>{p.followers}</div>
                <div>{p.tracks_count ?? 0}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}