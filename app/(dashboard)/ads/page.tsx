"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { getPlaylists } from "@/lib/api/playlists";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type SortField = "playlist" | "account" | "followers" | "growth7d" | "code";
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
  growth_7d?: number;
};

type CodeColor =
  | "gray"
  | "lightBlue"
  | "lavender"
  | "pink"
  | "lightGreen"
  | "yellow"
  | "cyan"
  | "orange"
  | "teal"
  | "green"
  | "blue";

const ALL_ACCOUNTS_ID = -1;
const ADS_DATES_STORAGE_KEY = "ads-page-dates-v4";
const ADS_CODES_STORAGE_KEY = "ads-page-color-codes-v4";

const colorOptions: Array<{
  value: CodeColor;
  label: string;
  textClass: string;
  bg: string;
}> = [
  { value: "gray", label: "Gray", textClass: "text-zinc-300", bg: "#d9d9d9" },
  { value: "lightBlue", label: "Light Blue", textClass: "text-sky-300", bg: "#d9ecff" },
  { value: "lavender", label: "Lavender", textClass: "text-violet-300", bg: "#d8cfee" },
  { value: "pink", label: "Pink", textClass: "text-rose-300", bg: "#f7c5c9" },
  { value: "lightGreen", label: "Light Green", textClass: "text-emerald-200", bg: "#dcefd1" },
  { value: "yellow", label: "Yellow", textClass: "text-yellow-300", bg: "#fff400" },
  { value: "cyan", label: "Cyan", textClass: "text-cyan-300", bg: "#19e7e7" },
  { value: "orange", label: "Orange", textClass: "text-orange-400", bg: "#ff9700" },
  { value: "teal", label: "Teal", textClass: "text-teal-300", bg: "#47b8bd" },
  { value: "green", label: "Green", textClass: "text-green-400", bg: "#00ef19" },
  { value: "blue", label: "Blue", textClass: "text-blue-400", bg: "#1557c8" },
];

function playlistKey(p: PlaylistRow) {
  return String(p.id);
}

function getColorOption(color: CodeColor | undefined) {
  return colorOptions.find((item) => item.value === color) ?? colorOptions[0];
}

function formatGrowth(value: number | undefined | null) {
  const safe = value ?? 0;
  return safe > 0 ? `+${safe}` : `${safe}`;
}

export default function AdsPage() {
  const activeAccountId = useActiveAccountStore((s) => s.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((s) => s.setActiveAccountId);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("growth7d");
const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [colorFilter, setColorFilter] = useState<"all" | CodeColor>("all");
  const [adsDates, setAdsDates] = useState<Record<string, string[]>>({});
  const [colorCodes, setColorCodes] = useState<Record<string, CodeColor>>({});
  const [openColorKey, setOpenColorKey] = useState<string | null>(null);

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
      const savedDates = window.localStorage.getItem(ADS_DATES_STORAGE_KEY);
      const savedCodes = window.localStorage.getItem(ADS_CODES_STORAGE_KEY);

      if (savedDates) setAdsDates(JSON.parse(savedDates));
      if (savedCodes) setColorCodes(JSON.parse(savedCodes));
    } catch {
      setAdsDates({});
      setColorCodes({});
    }
  }, []);

  const singleAccountQuery = useQuery({
    queryKey: ["ads-playlists", activeAccountId],
    queryFn: () => getPlaylists(activeAccountId as number),
    enabled: !!activeAccountId && activeAccountId !== ALL_ACCOUNTS_ID,
  });

  const allAccountQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ["ads-playlists", account.id],
      queryFn: () => getPlaylists(account.id),
      enabled: activeAccountId === ALL_ACCOUNTS_ID,
    })),
  });

  const playlists = useMemo(() => {
    if (activeAccountId === ALL_ACCOUNTS_ID) {
      return allAccountQueries.flatMap((query, index) => {
        const account = accounts[index];

        return ((query.data ?? []) as PlaylistRow[]).map((playlist) => ({
          ...playlist,
          account_id: playlist.account_id ?? account?.id,
        }));
      });
    }

    return ((singleAccountQuery.data ?? []) as PlaylistRow[]).map((playlist) => ({
      ...playlist,
      account_id: playlist.account_id ?? activeAccountId ?? undefined,
    }));
  }, [activeAccountId, accounts, allAccountQueries, singleAccountQuery.data]);

  const isLoading =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountQueries.some((query) => query.isLoading)
      : singleAccountQuery.isLoading;

  const getAccountName = (accountId?: number) => {
    if (!accountId) return "—";
    return accounts.find((account) => account.id === accountId)?.display_name || "—";
  };

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

  const filtered = useMemo(() => {
    let data = playlists;

    if (search) {
      data = data.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    }

    if (colorFilter !== "all") {
      data = data.filter((p) => (colorCodes[playlistKey(p)] || "gray") === colorFilter);
    }

    return [...data].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;

      if (sortField === "playlist") return a.name.localeCompare(b.name) * dir;

      if (sortField === "account") {
        return getAccountName(a.account_id).localeCompare(getAccountName(b.account_id)) * dir;
      }

      if (sortField === "followers") {
        return ((a.followers ?? 0) - (b.followers ?? 0)) * dir;
      }

      if (sortField === "growth7d") {
        return ((a.growth_7d ?? 0) - (b.growth_7d ?? 0)) * dir;
      }

      if (sortField === "code") {
        return (
          (colorCodes[playlistKey(a)] || "gray").localeCompare(
            colorCodes[playlistKey(b)] || "gray",
          ) * dir
        );
      }

      return 0;
    });
  }, [playlists, search, colorFilter, colorCodes, sortField, sortOrder, accounts]);

  const updateDate = (playlist: PlaylistRow, index: number, value: string) => {
    const key = playlistKey(playlist);
    const current = adsDates[key] ?? Array(5).fill("");
    const next = [...current];

    while (next.length < 5) next.push("");

    next[index] = value;

    const updatedDates = {
      ...adsDates,
      [key]: next.slice(0, 5),
    };

    setAdsDates(updatedDates);
    window.localStorage.setItem(ADS_DATES_STORAGE_KEY, JSON.stringify(updatedDates));
  };

  const updateColor = (playlist: PlaylistRow, value: CodeColor) => {
    const updatedCodes = {
      ...colorCodes,
      [playlistKey(playlist)]: value,
    };

    setColorCodes(updatedCodes);
    window.localStorage.setItem(ADS_CODES_STORAGE_KEY, JSON.stringify(updatedCodes));
    setOpenColorKey(null);
  };

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Ads</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Track ad dates and monitor playlist growth over time.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs text-zinc-400">ACTIVE ACCOUNT</label>
          <select
            value={activeAccountId ?? ""}
            onChange={(e) => setActiveAccountId(Number(e.target.value))}
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
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="flex flex-col gap-4 border-b border-zinc-800 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-xl font-semibold">Playlist Library</h2>

          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search playlist..."
              className="h-10 w-[260px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white"
            />

            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value as "all" | CodeColor)}
              className="h-10 w-[160px] rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white"
            >
              <option value="all">All Color Codes</option>
              {colorOptions.map((color) => (
                <option key={color.value} value={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[70px_minmax(190px,0.75fr)_minmax(420px,1.2fr)_56px_140px_90px_110px] border-b border-zinc-800 px-5 py-3 text-xs">
          <div className={headerClass("code")} onClick={() => toggleSort("code")}>
            Code {arrowFor("code")}
          </div>

          <div className={headerClass("playlist")} onClick={() => toggleSort("playlist")}>
            Playlist A&gt;Z {arrowFor("playlist")}
          </div>

          <div className="pl-1 font-semibold text-zinc-400">Ads Dates</div>

          <div />

          <div className={headerClass("account")} onClick={() => toggleSort("account")}>
            Account {arrowFor("account")}
          </div>

          <div className={headerClass("growth7d")} onClick={() => toggleSort("growth7d")}>
            7 D {arrowFor("growth7d")}
          </div>

          <div className={headerClass("followers")} onClick={() => toggleSort("followers")}>
            Followers {arrowFor("followers")}
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 text-sm text-zinc-400">Loading playlists...</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-sm text-zinc-400">No playlists found.</div>
        ) : (
          <div>
            {filtered.map((playlist) => {
              const key = playlistKey(playlist);
              const selectedColor = colorCodes[key] || "gray";
              const color = getColorOption(selectedColor);
              const dates = [...(adsDates[key] ?? Array(5).fill(""))];

              while (dates.length < 5) dates.push("");

              return (
                <div
                  key={key}
                  className={`grid grid-cols-[70px_minmax(190px,0.75fr)_minmax(420px,1.2fr)_56px_140px_90px_110px] items-center border-b border-zinc-900 px-5 py-4 text-sm ${color.textClass}`}
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenColorKey(openColorKey === key ? null : key)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-black"
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: color.bg }}
                      />
                    </button>

                    {openColorKey === key ? (
                      <div className="absolute left-0 top-10 z-20 overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-2xl">
                        {colorOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateColor(playlist, option.value)}
                            className="block h-7 w-10 border-b border-black/20 last:border-b-0"
                            style={{ backgroundColor: option.bg }}
                            title={option.label}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <Link
  href={`/playlists/${playlist.id}?accountId=${playlist.account_id}`}
  className={`truncate font-semibold hover:text-green-400 ${color.textClass}`}
>
  {playlist.name.length > 74
    ? `${playlist.name.slice(0, 74)}...`
    : playlist.name}
</Link>
<div className="grid grid-cols-5 gap-1.5 pr-3">
  {Array.from({ length: 5 }).map((_, index) => (
    <input
      key={`${key}-date-${index}`}
      type="date"
      value={dates[index] || ""}
      onMouseDown={(e) => {
        e.preventDefault();

        const input = e.currentTarget;

        try {
          input.showPicker?.();
        } catch {
          input.focus();
        }
      }}
      onChange={(e) => updateDate(playlist, index, e.target.value)}
      className={`h-9 w-[118px] cursor-pointer rounded-lg border border-zinc-800 bg-black px-2 text-[12px] font-semibold outline-none focus:border-green-500 ${color.textClass} [&::-webkit-datetime-edit]:text-current`}
    />
  ))}
</div>

<div></div>

                  <div className={`truncate text-xs ${color.textClass}`}>
                    {getAccountName(playlist.account_id)}
                  </div>

                  <div className={color.textClass}>{formatGrowth(playlist.growth_7d)}</div>
                  <div className={color.textClass}>{playlist.followers ?? 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}