"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { getPlaylists } from "@/lib/api/playlists";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type CodeColor =
  | "gray"
  | "yellow"
  | "green"
  | "blue"
  | "red"
  | "purple"
  | "orange";

type SortField =
  | "title"
  | "account"
  | "followers"
  | "ads"
  | "tracks"
  | "lastUpdate"
  | "today"
  | "today1"
  | "today2"
  | "today3"
  | "today4"
  | "growth7d"
  | "growth30d"
  | "country";

type SortOrder = "asc" | "desc";

type AccountRow = {
  id: number;
  display_name?: string;
  name?: string;
};

type PlaylistRow = {
  id: number | string;
  account_id?: number;
  spotify_id?: string | null;
  spotify_url?: string | null;
  playlist_url?: string | null;
  external_url?: string | null;
  url?: string | null;
  name: string;
  title?: string;
  followers?: number;
  tracks_count?: number;
  total_tracks?: number;
  growth?: number;
  growth_24h?: number;
  growth_7d?: number;
  growth_30d?: number;
  today?: number;
  today_growth?: number;
  growth_today?: number;
  today_minus_1?: number;
  today_minus_2?: number;
  today_minus_3?: number;
  today_minus_4?: number;
  day_1?: number;
  day_2?: number;
  day_3?: number;
  day_4?: number;
  followers_today?: number;
  followers_day_1?: number;
  followers_day_2?: number;
  followers_day_3?: number;
  followers_day_4?: number;
  category?: string | null;
  genre?: string | null;
  country?: string | null;
  ads_meta?: {
    category?: string | null;
    genre?: string | null;
    country?: string | null;
    master_playlist?: string | null;
    ads?: AdEntry[] | null;
    color?: CodeColor | null;
  } | null;
  daily_growth?: Array<{
    date: string;
    label?: string;
    growth?: number;
    followers?: number;
    followers_count?: number;
    count?: number;
    value?: number;
  }>;
  daily_history?: Array<{
    date: string;
    label?: string;
    followers?: number;
    followers_count?: number;
    count?: number;
    value?: number;
    growth?: number;
  }>;
  updated_at?: string | null;
  last_update?: string | null;
  last_update_date?: string | null;
  synced_at?: string | null;
  last_synced_at?: string | null;
};

type AdEntry = {
  date: string;
  color: CodeColor;
  stroke?: boolean;
};

type RowMeta = {
  color?: CodeColor;
  category: string;
  genre: string;
  country: string;
  master: string;
  ads: AdEntry[];
};

const ALL_ACCOUNTS_ID = -1;
const ADS_DATA_STORAGE_KEY = "ads-page-row-data-v17";
const ADS_CATEGORY_OPTIONS_STORAGE_KEY = "ads-page-category-options-v17";
const ADS_GENRE_OPTIONS_STORAGE_KEY = "ads-page-genre-options-v17";

const defaultCategoryOptions = [
  "Category",
  "Running",
  "Mood",
  "Workout",
  "Focus",
  "Chill",
];
const defaultGenreOptions = [
  "Genre",
  "Techno",
  "House",
  "Pop",
  "Hip-Hop",
  "Afro",
  "Latin",
];

const colorOptions: Array<{
  value: CodeColor;
  label: string;
  textClass: string;
  bg: string;
}> = [
  { value: "gray", label: "Gray", textClass: "text-zinc-400", bg: "#71717a" },
  {
    value: "yellow",
    label: "Yellow",
    textClass: "text-yellow-300",
    bg: "#fde047",
  },
  {
    value: "green",
    label: "Green",
    textClass: "text-green-400",
    bg: "#22c55e",
  },
  { value: "blue", label: "Blue", textClass: "text-blue-400", bg: "#60a5fa" },
  { value: "red", label: "Red", textClass: "text-red-400", bg: "#f87171" },
  {
    value: "purple",
    label: "Purple",
    textClass: "text-purple-400",
    bg: "#c084fc",
  },
  {
    value: "orange",
    label: "Orange",
    textClass: "text-orange-400",
    bg: "#fb923c",
  },
];

const countryOptions = [
  "Germany",
  "Lebanon",
  "France",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Brazil",
  "Italy",
  "Spain",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "UAE",
  "Saudi Arabia",
  "Egypt",
  "Turkey",
  "India",
  "Japan",
  "South Korea",
];

function playlistKey(p: PlaylistRow) {
  return `${p.account_id ?? "unknown"}-${p.id}`;
}

function getPlaylistId(p: PlaylistRow) {
  return String(p.spotify_id || p.id);
}

function getPlaylistUrl(p: PlaylistRow) {
  return (
    p.spotify_url ||
    p.playlist_url ||
    p.external_url ||
    p.url ||
    `https://open.spotify.com/playlist/${getPlaylistId(p)}`
  );
}

function getColorOption(color: CodeColor | undefined) {
  return colorOptions.find((item) => item.value === color) ?? colorOptions[0];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDayMonth(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}


function getLastSyncedAt(playlist: PlaylistRow) {
  return (
    playlist.last_synced_at ??
    playlist.synced_at ??
    playlist.updated_at ??
    playlist.last_update ??
    playlist.last_update_date ??
    null
  );
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatAdDateDisplay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function truncateTitle(title: string) {
  return title.length > 26 ? `${title.slice(0, 26)}...` : title;
}

function formatGrowth(value: number | undefined | null) {
  const safe = Number(value ?? 0);
  return safe > 0 ? `+${safe}` : `${safe}`;
}

function GrowthCell({ value }: { value: number | undefined | null }) {
  const safe = Number(value ?? 0);
  const colorClass =
    safe <= 0 ? "text-red-400" : safe <= 3 ? "text-white" : "text-green-400";
  return <span className={colorClass}>{formatGrowth(safe)}</span>;
}

function getTrackCount(playlist: PlaylistRow) {
  return playlist.tracks_count ?? playlist.total_tracks ?? 0;
}

function getTodayValue(playlist: PlaylistRow, offset: 0 | 1 | 2 | 3 | 4) {
  const historyItem =
    playlist.daily_history?.[offset] ?? playlist.daily_growth?.[offset];

  const historyFollowers =
    readNumber(historyItem?.followers) ??
    readNumber(historyItem?.followers_count) ??
    readNumber(historyItem?.count) ??
    readNumber(historyItem?.value);

  if (historyFollowers !== null) return historyFollowers;

  const record = playlist as unknown as Record<string, unknown>;

  if (offset === 0) {
    return (
      readNumber(record.followers_today) ??
      readNumber(record.today_followers) ??
      readNumber(record.followers) ??
      readNumber(playlist.followers) ??
      readNumber(record.today) ??
      readNumber(record.today_growth) ??
      readNumber(record.growth_today) ??
      readNumber(record.growth_24h) ??
      readNumber(record.growth) ??
      0
    );
  }

  const keys = [
    `followers_day_${offset}`,
    `followers_today_minus_${offset}`,
    `today_minus_${offset}_followers`,
    `day_${offset}_followers`,
    `today_minus_${offset}`,
    `day_${offset}`,
  ];

  for (const key of keys) {
    const value = readNumber(record[key]);
    if (value !== null) return value;
  }

  const fallbackGrowth = readNumber(historyItem?.growth);
  if (fallbackGrowth !== null) return fallbackGrowth;

  return 0;
}

function isWithinLastDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return date >= start;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter(Boolean).map((value) => String(value))),
  ).sort();
}

function CopyIcon() {
  return <span className="text-[13px] leading-none">⧉</span>;
}

function IdIcon() {
  return <span className="text-[12px] font-black leading-none">ID</span>;
}

function DownloadIcon() {
  return <span className="text-[15px] leading-none">↓</span>;
}

function UploadIcon() {
  return <span className="text-[15px] leading-none">↑</span>;
}

async function saveAdsMetaToDatabase(
  playlistId: string | number,
  data: RowMeta,
) {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://spotify-growth-hub-backend.onrender.com";
  const payload = {
    category: data.category,
    genre: data.genre,
    country: data.country,
    master_playlist: data.master,
    ads: data.ads,
    color: data.color,
  };

  try {
    await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/ads-meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Autosave failed", error);
  }
}

export default function AdsPage() {
  const activeAccountId = useActiveAccountStore((s) => s.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((s) => s.setActiveAccountId);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("growth7d");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedAdColor, setSelectedAdColor] = useState<CodeColor>("gray");
  const [filters, setFilters] = useState({
    category: "",
    color: "",
    country: "",
    genre: "",
    lastUpdate: "all",
    master: "",
  });
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<
    number | null
  >(null);
  const [rowData, setRowData] = useState<Record<string, RowMeta>>({});
  const [adModalKey, setAdModalKey] = useState<string | null>(null);
  const [bulkAdModalOpen, setBulkAdModalOpen] = useState(false);
  const [modalAdIndex, setModalAdIndex] = useState<number | null>(null);
  const [modalDate, setModalDate] = useState("");
  const [modalColor, setModalColor] = useState<CodeColor>("gray");
  const [modalStroke, setModalStroke] = useState(false);
  const [selectedAds, setSelectedAds] = useState<Record<string, boolean>>({});
  const [lastSelectedAdKey, setLastSelectedAdKey] = useState<string | null>(
    null,
  );
  const [categoryOptions, setCategoryOptions] = useState(
    defaultCategoryOptions,
  );
  const [genreOptions, setGenreOptions] = useState(defaultGenreOptions);
  const [optionModalType, setOptionModalType] = useState<
    "category" | "genre" | null
  >(null);
  const [newOptionName, setNewOptionName] = useState("");

  const accountsQuery = useQuery<AccountRow[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });
  const accounts = accountsQuery.data ?? [];

  useEffect(() => {
    if (!activeAccountId && accounts.length > 0)
      setActiveAccountId(ALL_ACCOUNTS_ID);
  }, [activeAccountId, accounts, setActiveAccountId]);

  useEffect(() => {
    try {
      const savedData = window.localStorage.getItem(ADS_DATA_STORAGE_KEY);
      const savedCategories = window.localStorage.getItem(
        ADS_CATEGORY_OPTIONS_STORAGE_KEY,
      );
      const savedGenres = window.localStorage.getItem(
        ADS_GENRE_OPTIONS_STORAGE_KEY,
      );
      if (savedData) setRowData(JSON.parse(savedData));
      if (savedCategories) setCategoryOptions(JSON.parse(savedCategories));
      if (savedGenres) setGenreOptions(JSON.parse(savedGenres));
    } catch {
      setRowData({});
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
    return ((singleAccountQuery.data ?? []) as PlaylistRow[]).map(
      (playlist) => ({
        ...playlist,
        account_id: playlist.account_id ?? activeAccountId ?? undefined,
      }),
    );
  }, [activeAccountId, accounts, allAccountQueries, singleAccountQuery.data]);

  const isLoading =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountQueries.some((query) => query.isLoading)
      : singleAccountQuery.isLoading;
  const isError =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountQueries.some((query) => query.isError)
      : singleAccountQuery.isError;

  const getAccountName = (accountId?: number) => {
    if (!accountId) return "—";
    return (
      accounts.find((account) => account.id === accountId)?.display_name ||
      accounts.find((account) => account.id === accountId)?.name ||
      "—"
    );
  };

  const getDefaultRowData = (playlist: PlaylistRow): RowMeta => ({
    color: playlist.ads_meta?.color || "gray",
    category: playlist.ads_meta?.category || playlist.category || "Category",
    genre: playlist.ads_meta?.genre || playlist.genre || "Genre",
    country: playlist.ads_meta?.country || playlist.country || "",
    master: playlist.ads_meta?.master_playlist || "",
    ads: Array.isArray(playlist.ads_meta?.ads) ? playlist.ads_meta?.ads || [] : [],
  });

  const getRowData = (playlist: PlaylistRow) =>
    rowData[playlistKey(playlist)] ?? getDefaultRowData(playlist);

  const persistRowData = (nextData: Record<string, RowMeta>) => {
    setRowData(nextData);
    window.localStorage.setItem(ADS_DATA_STORAGE_KEY, JSON.stringify(nextData));
  };

  const updateRowData = (playlist: PlaylistRow, updates: Partial<RowMeta>) => {
    const key = playlistKey(playlist);
    const next = {
      ...rowData,
      [key]: {
        ...getDefaultRowData(playlist),
        ...rowData[key],
        ...updates,
      },
    };
    persistRowData(next);
    saveAdsMetaToDatabase(playlist.id, next[key]);
  };

  const masterOptions = useMemo(
    () =>
      uniqueValues(playlists.map((playlist) => playlist.name)),
    [playlists],
  );
  const listedCountries = useMemo(
    () =>
      uniqueValues(playlists.map((playlist) => getRowData(playlist).country)),
    [playlists, rowData],
  );

  const filtered = useMemo(() => {
    let data = playlists;
    if (search)
      data = data.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      );
    if (filters.category)
      data = data.filter((p) => getRowData(p).category === filters.category);
    if (filters.color)
      data = data.filter((p) => getRowData(p).color === filters.color);
    if (filters.country)
      data = data.filter((p) => getRowData(p).country === filters.country);
    if (filters.genre)
      data = data.filter((p) => getRowData(p).genre === filters.genre);
    if (filters.master)
      data = data.filter((p) => getRowData(p).master === filters.master);
    if (filters.lastUpdate !== "all") {
      const days =
        filters.lastUpdate === "today"
          ? 1
          : filters.lastUpdate === "week"
            ? 7
            : filters.lastUpdate === "15"
              ? 15
              : 30;
      data = data.filter((p) =>
        isWithinLastDays(
          getLastSyncedAt(p),
          days,
        ),
      );
    }

    return [...data].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      const rowA = getRowData(a);
      const rowB = getRowData(b);
      if (sortField === "title") return a.name.localeCompare(b.name) * dir;
      if (sortField === "account")
        return (
          getAccountName(a.account_id).localeCompare(
            getAccountName(b.account_id),
          ) * dir
        );
      if (sortField === "followers")
        return ((a.followers ?? 0) - (b.followers ?? 0)) * dir;
      if (sortField === "ads") return (rowA.ads.length - rowB.ads.length) * dir;
      if (sortField === "tracks")
        return (getTrackCount(a) - getTrackCount(b)) * dir;
      if (sortField === "lastUpdate")
        return (
          formatDate(getLastSyncedAt(a)).localeCompare(
          formatDate(getLastSyncedAt(b)),
        ) * dir
        );
      if (sortField === "today")
        return (getTodayValue(a, 0) - getTodayValue(b, 0)) * dir;
      if (sortField === "today1")
        return (getTodayValue(a, 1) - getTodayValue(b, 1)) * dir;
      if (sortField === "today2")
        return (getTodayValue(a, 2) - getTodayValue(b, 2)) * dir;
      if (sortField === "today3")
        return (getTodayValue(a, 3) - getTodayValue(b, 3)) * dir;
      if (sortField === "today4")
        return (getTodayValue(a, 4) - getTodayValue(b, 4)) * dir;
      if (sortField === "growth7d")
        return ((a.growth_7d ?? 0) - (b.growth_7d ?? 0)) * dir;
      if (sortField === "growth30d")
        return ((a.growth_30d ?? 0) - (b.growth_30d ?? 0)) * dir;
      if (sortField === "country")
        return rowA.country.localeCompare(rowB.country) * dir;
      return 0;
    });
  }, [playlists, search, filters, sortField, sortOrder, rowData, accounts]);

  const selectedRowKeys = useMemo(
    () => filtered.map(playlistKey).filter((key) => selectedRows[key]),
    [filtered, selectedRows],
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedRows[playlistKey(p)]);
  const hasSelectedRows = selectedRowKeys.length > 0;
  const selectedAdKeys = Object.keys(selectedAds).filter(
    (key) => selectedAds[key],
  );

  const maxAdColumns = Math.min(
    Math.max(0, ...filtered.map((p) => getRowData(p).ads.length)),
    12,
  );
  const adColumnCount = Math.max(maxAdColumns, 1);

  const visibleAdItems = useMemo(() => {
    const items: Array<{
      key: string;
      playlist: PlaylistRow;
      adIndex: number;
    }> = [];
    filtered.forEach((playlist) => {
      const rowKey = playlistKey(playlist);
      getRowData(playlist).ads.forEach((_, adIndex) => {
        items.push({ key: `${rowKey}::${adIndex}`, playlist, adIndex });
      });
    });
    return items;
  }, [filtered, rowData]);

  const gridTemplate = `46px 46px 46px 230px 122px 122px 124px 142px 54px 46px 64px 88px 48px 44px 44px 44px 44px 44px 48px 48px 118px 48px ${Array.from(
    { length: adColumnCount },
  )
    .map(() => "64px")
    .join(" ")}`;

  const toggleSort = (field: SortField) => {
    if (sortField === field)
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const arrowFor = (field: SortField) =>
    sortField === field ? (sortOrder === "asc" ? "↑" : "↓") : "";
  const headerClass = (field: SortField) =>
    `whitespace-nowrap px-2 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] ${sortField === field ? "text-green-400" : "text-zinc-400"} cursor-pointer`;

  const toggleSelectAll = () => {
    const next = { ...selectedRows };
    filtered.forEach((playlist) => {
      next[playlistKey(playlist)] = !allFilteredSelected;
    });
    setSelectedRows(next);
    setLastSelectedRowIndex(null);
  };

  const handleRowCheckboxClick = (
    playlist: PlaylistRow,
    index: number,
    event: React.MouseEvent<HTMLInputElement>,
  ) => {
    const key = playlistKey(playlist);
    if (event.shiftKey && lastSelectedRowIndex !== null) {
      const start = Math.min(lastSelectedRowIndex, index);
      const end = Math.max(lastSelectedRowIndex, index);
      const shouldSelect = !selectedRows[key];
      const next = { ...selectedRows };
      filtered.slice(start, end + 1).forEach((row) => {
        next[playlistKey(row)] = shouldSelect;
      });
      setSelectedRows(next);
      return;
    }

    setSelectedRows((prev) => ({ ...prev, [key]: !prev[key] }));
    setLastSelectedRowIndex(index);
  };

  const applyTitleColorToSelected = (color: CodeColor) => {
    setSelectedAdColor(color);
    const selectedPlaylists = filtered.filter(
      (playlist) => selectedRows[playlistKey(playlist)],
    );
    const next = { ...rowData };
    selectedPlaylists.forEach((playlist) => {
      const key = playlistKey(playlist);
      next[key] = { ...getDefaultRowData(playlist), ...next[key], color };
      saveAdsMetaToDatabase(playlist.id, next[key]);
    });
    persistRowData(next);
    setSelectedRows({});
    setLastSelectedRowIndex(null);
  };

  const openAdModal = (playlist: PlaylistRow, adIndex?: number) => {
    const current = getRowData(playlist);
    const existingAd =
      typeof adIndex === "number" ? current.ads[adIndex] : null;
    setBulkAdModalOpen(false);
    setAdModalKey(playlistKey(playlist));
    setModalAdIndex(typeof adIndex === "number" ? adIndex : null);
    setModalDate(existingAd?.date ?? todayISO());
    setModalColor(existingAd?.color ?? selectedAdColor);
    setModalStroke(existingAd?.stroke ?? false);
  };

  const openBulkAdModal = () => {
    setAdModalKey(null);
    setModalAdIndex(null);
    setBulkAdModalOpen(true);
    setModalDate(todayISO());
    setModalColor(selectedAdColor);
    setModalStroke(false);
  };

  const closeAdModal = () => {
    setAdModalKey(null);
    setBulkAdModalOpen(false);
    setModalAdIndex(null);
    setModalDate("");
    setModalColor(selectedAdColor);
    setModalStroke(false);
  };

  const saveAdDate = () => {
    if (!modalDate) return;
    const next = { ...rowData };

    if (bulkAdModalOpen) {
      filtered.forEach((playlist) => {
        const key = playlistKey(playlist);
        if (!selectedRows[key]) return;
        const current = { ...getDefaultRowData(playlist), ...next[key] };
        next[key] = {
          ...current,
          ads: [{ date: modalDate, color: modalColor, stroke: modalStroke }, ...current.ads].slice(
            0,
            12,
          ),
        };
        saveAdsMetaToDatabase(playlist.id, next[key]);
      });
      persistRowData(next);
      setSelectedRows({});
      closeAdModal();
      return;
    }

    if (!adModalKey) return;
    const playlist = playlists.find((p) => playlistKey(p) === adModalKey);
    if (!playlist) return;
    const current = { ...getDefaultRowData(playlist), ...next[adModalKey] };
    const nextAds = [...current.ads];
    if (modalAdIndex !== null)
      nextAds[modalAdIndex] = { date: modalDate, color: modalColor, stroke: modalStroke };
    else nextAds.unshift({ date: modalDate, color: modalColor, stroke: modalStroke });
    next[adModalKey] = { ...current, ads: nextAds.slice(0, 12) };
    persistRowData(next);
    saveAdsMetaToDatabase(playlist.id, next[adModalKey]);
    closeAdModal();
  };

  const deleteAdDate = () => {
    if (!adModalKey || modalAdIndex === null) return;
    const playlist = playlists.find((p) => playlistKey(p) === adModalKey);
    if (!playlist) return;
    const current = getRowData(playlist);
    updateRowData(playlist, {
      ads: current.ads.filter((_, index) => index !== modalAdIndex),
    });
    closeAdModal();
  };

  const toggleAdSelection = (
    playlist: PlaylistRow,
    adIndex: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const key = `${playlistKey(playlist)}::${adIndex}`;
    if (event.shiftKey && lastSelectedAdKey) {
      const start = visibleAdItems.findIndex(
        (item) => item.key === lastSelectedAdKey,
      );
      const end = visibleAdItems.findIndex((item) => item.key === key);
      if (start !== -1 && end !== -1) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        const next = { ...selectedAds };
        visibleAdItems.slice(min, max + 1).forEach((item) => {
          next[item.key] = true;
        });
        setSelectedAds(next);
        return;
      }
    }

    setSelectedAds((prev) => ({ ...prev, [key]: !prev[key] }));
    setLastSelectedAdKey(key);
  };

  const deleteSelectedAds = () => {
    if (selectedAdKeys.length === 0) return;
    const selectedSet = new Set(selectedAdKeys);
    const next = { ...rowData };

    filtered.forEach((playlist) => {
      const key = playlistKey(playlist);
      const current = getRowData(playlist);
      const ads = current.ads.filter(
        (_, index) => !selectedSet.has(`${key}::${index}`),
      );
      if (ads.length !== current.ads.length) {
        next[key] = { ...current, ads };
        saveAdsMetaToDatabase(playlist.id, next[key]);
      }
    });

    persistRowData(next);
    setSelectedAds({});
    setLastSelectedAdKey(null);
  };

  const updateSelectedAdColors = (color: CodeColor) => {
    if (selectedAdKeys.length === 0) return;
    const selectedSet = new Set(selectedAdKeys);
    const next = { ...rowData };

    filtered.forEach((playlist) => {
      const key = playlistKey(playlist);
      const current = getRowData(playlist);
      let changed = false;
      const ads = current.ads.map((ad, index) => {
        if (!selectedSet.has(`${key}::${index}`)) return ad;
        changed = true;
        return { ...ad, color };
      });
      if (changed) {
        next[key] = { ...current, ads };
        saveAdsMetaToDatabase(playlist.id, next[key]);
      }
    });

    persistRowData(next);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAdModal();
        setOptionModalType(null);
      }
      if (event.key === "Delete" && selectedAdKeys.length > 0) {
        deleteSelectedAds();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAdKeys, filtered, rowData]);

  const openOptionModal = (type: "category" | "genre") => {
    setOptionModalType(type);
    setNewOptionName("");
  };

  const closeOptionModal = () => {
    setOptionModalType(null);
    setNewOptionName("");
  };

  const saveOptions = (type: "category" | "genre", nextOptions: string[]) => {
    if (type === "category") {
      setCategoryOptions(nextOptions);
      window.localStorage.setItem(
        ADS_CATEGORY_OPTIONS_STORAGE_KEY,
        JSON.stringify(nextOptions),
      );
    } else {
      setGenreOptions(nextOptions);
      window.localStorage.setItem(
        ADS_GENRE_OPTIONS_STORAGE_KEY,
        JSON.stringify(nextOptions),
      );
    }
  };

  const addDropdownOption = () => {
    if (!optionModalType) return;
    const cleaned = newOptionName.trim();
    if (!cleaned) return;
    const currentOptions =
      optionModalType === "category" ? categoryOptions : genreOptions;
    if (
      !currentOptions.some(
        (item) => item.toLowerCase() === cleaned.toLowerCase(),
      )
    )
      saveOptions(optionModalType, [...currentOptions, cleaned]);
    setNewOptionName("");
  };

  const deleteDropdownOption = (option: string) => {
    if (!optionModalType) return;
    if (option === "Category" || option === "Genre") return;
    const currentOptions =
      optionModalType === "category" ? categoryOptions : genreOptions;
    saveOptions(
      optionModalType,
      currentOptions.filter((item) => item !== option),
    );
  };

  const clearFilters = () =>
    setFilters({
      category: "",
      color: "",
      country: "",
      genre: "",
      lastUpdate: "all",
      master: "",
    });

  const downloadCSV = () => {
    const headers = [
      "URL",
      "ID",
      "Title",
      "Category",
      "Genre",
      "Account",
      "Master",
      "Followers",
      "Ads",
      "Tracks",
      "Last Synced",
      formatDayMonth(0),
      formatDayMonth(1),
      formatDayMonth(2),
      formatDayMonth(3),
      formatDayMonth(4),
      "7D",
      "30D",
      "Country",
      "Ad Dates",
    ];
    const rows = filtered.map((playlist) => {
      const data = getRowData(playlist);
      return [
        getPlaylistUrl(playlist),
        getPlaylistId(playlist),
        playlist.name,
        data.category,
        data.genre,
        getAccountName(playlist.account_id),
        data.master,
        playlist.followers ?? 0,
        data.ads.length,
        getTrackCount(playlist),
        formatDate(
          getLastSyncedAt(playlist),
        ),
        getTodayValue(playlist, 0),
        getTodayValue(playlist, 1),
        getTodayValue(playlist, 2),
        getTodayValue(playlist, 3),
        getTodayValue(playlist, 4),
        playlist.growth_7d ?? 0,
        playlist.growth_30d ?? 0,
        data.country,
        data.ads.map((ad) => `${ad.date}:${ad.color}`).join(" | "),
      ];
    });
    const escapeCell = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ads-table-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadCSV = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      alert("CSV uploaded. Next step: map imported rows to database fields.");
    reader.readAsText(file);
    event.target.value = "";
  };

  const filterGroups = [
    {
      label: "Category",
      options: categoryOptions.filter((item) => item !== "Category"),
      value: filters.category,
      set: (value: string) =>
        setFilters((prev) => ({ ...prev, category: value })),
    },
    {
      label: "Color",
      options: colorOptions.map((color) => color.label),
      value: filters.color,
      set: (value: string) =>
        setFilters((prev) => ({
          ...prev,
          color:
            colorOptions.find((color) => color.label === value)?.value || "",
        })),
    },
    {
      label: "Country",
      options: listedCountries,
      value: filters.country,
      set: (value: string) =>
        setFilters((prev) => ({ ...prev, country: value })),
    },
    {
      label: "Genre",
      options: genreOptions.filter((item) => item !== "Genre"),
      value: filters.genre,
      set: (value: string) => setFilters((prev) => ({ ...prev, genre: value })),
    },
    {
      label: "Last Synced",
      options: ["Today", "Last Week", "Last 15 Days", "Last 30 Days"],
      value: filters.lastUpdate,
      set: (value: string) =>
        setFilters((prev) => ({
          ...prev,
          lastUpdate:
            value === "Today"
              ? "today"
              : value === "Last Week"
                ? "week"
                : value === "Last 15 Days"
                  ? "15"
                  : "30",
        })),
    },
    {
      label: "Master Playlist",
      options: masterOptions,
      value: filters.master,
      set: (value: string) =>
        setFilters((prev) => ({ ...prev, master: value })),
    },
  ];

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 overflow-hidden bg-black px-5 py-5 text-white lg:px-6">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Ads</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track ad dates and monitor playlist growth over time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          {hasSelectedRows ? (
            <>
              <select
                value={selectedAdColor}
                onChange={(e) =>
                  applyTitleColorToSelected(e.target.value as CodeColor)
                }
                className={`h-10 w-auto min-w-[82px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-green-500 ${getColorOption(selectedAdColor).textClass}`}
                title="Color selected titles"
              >
                {colorOptions.map((color) => (
                  <option
                    key={color.value}
                    value={color.value}
                    className={color.textClass}
                  >
                    {color.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openBulkAdModal}
                className="h-10 rounded-xl bg-green-500 px-4 text-sm font-semibold text-black hover:bg-green-400"
              >
                + Ad Dates
              </button>
            </>
          ) : null}

          {selectedAdKeys.length > 0 ? (
            <>
              <select
                value={selectedAdColor}
                onChange={(e) => {
                  const color = e.target.value as CodeColor;
                  setSelectedAdColor(color);
                  updateSelectedAdColors(color);
                }}
                className={`h-10 w-auto min-w-[92px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-green-500 ${getColorOption(selectedAdColor).textClass}`}
                title="Change selected ad card color"
              >
                {colorOptions.map((color) => (
                  <option
                    key={`selected-ad-color-${color.value}`}
                    value={color.value}
                    className={color.textClass}
                  >
                    {color.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setSelectedAds({});
                  setLastSelectedAdKey(null);
                }}
                className="h-10 rounded-xl border border-zinc-700 px-4 text-sm font-semibold text-zinc-300 hover:border-green-500 hover:text-green-400"
              >
                Deselect
              </button>
              <button
                type="button"
                onClick={deleteSelectedAds}
                className="h-10 rounded-xl border border-red-500/50 px-4 text-sm font-semibold text-red-400 hover:bg-red-500/10"
              >
                Delete Selected Ads
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={downloadCSV}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-green-500 hover:text-green-400"
            title="Download table CSV"
          >
            <DownloadIcon />
          </button>
          <label
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-green-500 hover:text-green-400"
            title="Upload CSV"
          >
            <UploadIcon />
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUploadCSV}
            />
          </label>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlist..."
            className="h-11 w-[260px] rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
          />

          <div className="group relative">
            <button
              type="button"
              className="h-9 rounded-lg border border-zinc-800 bg-black px-4 text-xs font-semibold text-white"
            >
              Filter
            </button>
            <div className="invisible absolute right-0 top-full z-[9999] w-56 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
              {filterGroups.map((group) => (
                <div
                  key={group.label}
                  className="group/item relative rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  <div className="flex items-center justify-between">
                    <span>{group.label}</span>
                    <span>›</span>
                  </div>
                  <div className="invisible absolute right-full top-0 z-[10000] mr-2 max-h-72 w-56 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2 opacity-0 shadow-[0_20px_60px_rgba(0,0,0,0.9)] group-hover/item:visible group-hover/item:opacity-100">
                    <button
                      type="button"
                      onClick={() => group.set("")}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-900"
                    >
                      All
                    </button>
                    {group.options.map((option, optionIndex) => (
                      <button
                        key={`${group.label}-${option}-${optionIndex}`}
                        type="button"
                        onClick={() => group.set(option)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 w-full rounded-lg border-t border-zinc-800 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
              >
                Clear filters
              </button>
              </div>
            </div>
          </div>

          <select
            value={activeAccountId ?? ALL_ACCOUNTS_ID}
            onChange={(e) => setActiveAccountId(Number(e.target.value))}
            className="h-10 w-[190px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-green-500"
          >
            <option value={ALL_ACCOUNTS_ID}>All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.display_name || acc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="h-[calc(100vh-155px)] w-full max-w-full overflow-auto overscroll-contain pb-3 [scrollbar-color:#22c55e_#18181b] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-corner]:bg-zinc-950 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-500">
          <div className="min-w-max">
            <div
              className="sticky top-0 z-10 grid border-b border-zinc-800 bg-zinc-950/95 backdrop-blur"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="px-2 py-3 text-[10px] font-semibold uppercase text-zinc-400">
                URL
              </div>
              <div className="px-2 py-3 text-[10px] font-semibold uppercase text-zinc-400">
                ID
              </div>
              <div className="flex items-center px-2 py-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                />
              </div>
              <div
                className={headerClass("title")}
                onClick={() => toggleSort("title")}
              >
                Title {arrowFor("title")}
              </div>
              <div className="flex items-center gap-1 px-2 py-3 text-[10px] font-semibold uppercase text-zinc-400">
                Category{" "}
                <button
                  type="button"
                  onClick={() => openOptionModal("category")}
                  className="text-[12px] font-black leading-none text-green-400 hover:text-green-300"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 px-2 py-3 text-[10px] font-semibold uppercase text-zinc-400">
                Genre{" "}
                <button
                  type="button"
                  onClick={() => openOptionModal("genre")}
                  className="text-[12px] font-black leading-none text-green-400 hover:text-green-300"
                >
                  +
                </button>
              </div>
              <div
                className={headerClass("account")}
                onClick={() => toggleSort("account")}
              >
                Account {arrowFor("account")}
              </div>
              <div className="px-1 py-3 text-[10px] font-semibold uppercase text-zinc-400">
                Master
              </div>
              <div
                className={headerClass("followers")}
                onClick={() => toggleSort("followers")}
              >
                SAVES {arrowFor("followers")}
              </div>
              <div
                className={headerClass("ads")}
                onClick={() => toggleSort("ads")}
              >
                Ads {arrowFor("ads")}
              </div>
              <div
                className={headerClass("tracks")}
                onClick={() => toggleSort("tracks")}
              >
                Tracks {arrowFor("tracks")}
              </div>
              <div
                className={headerClass("lastUpdate")}
                onClick={() => toggleSort("lastUpdate")}
              >
                Last Synced {arrowFor("lastUpdate")}
              </div>
              <div
                className={headerClass("today")}
                onClick={() => toggleSort("today")}
              >
                {formatDayMonth(0)} {arrowFor("today")}
              </div>
              <div
                className={headerClass("today1")}
                onClick={() => toggleSort("today1")}
              >
                {formatDayMonth(1)} {arrowFor("today1")}
              </div>
              <div
                className={headerClass("today2")}
                onClick={() => toggleSort("today2")}
              >
                {formatDayMonth(2)} {arrowFor("today2")}
              </div>
              <div
                className={headerClass("today3")}
                onClick={() => toggleSort("today3")}
              >
                {formatDayMonth(3)} {arrowFor("today3")}
              </div>
              <div
                className={headerClass("today4")}
                onClick={() => toggleSort("today4")}
              >
                {formatDayMonth(4)} {arrowFor("today4")}
              </div>
              <div
                className={headerClass("growth7d")}
                onClick={() => toggleSort("growth7d")}
              >
                7D {arrowFor("growth7d")}
              </div>
              <div
                className={headerClass("growth30d")}
                onClick={() => toggleSort("growth30d")}
              >
                30D {arrowFor("growth30d")}
              </div>
              <div
                className={headerClass("country")}
                onClick={() => toggleSort("country")}
              >
                Country {arrowFor("country")}
              </div>
              <div className="px-2 py-3 text-center text-[10px] font-semibold uppercase text-zinc-400">
                Ad Date
              </div>
              {Array.from({ length: adColumnCount }).map((_, index) => (
                <div
                  key={`ad-header-${index}`}
                  className="px-2 py-3 text-[10px] font-semibold uppercase text-zinc-400"
                >
                  Ad {index + 1}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="px-5 py-8 text-sm text-zinc-400">
                Loading playlists...
              </div>
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
                {filtered.map((playlist, rowIndex) => {
                  const key = playlistKey(playlist);
                  const data = getRowData(playlist);
                  const titleColor = getColorOption(data.color).textClass;
                  return (
                    <div
                      key={key}
                      className="grid min-h-[46px] items-center border-b border-zinc-900 py-2 text-xs text-zinc-200 hover:bg-zinc-900/40"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="px-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              getPlaylistUrl(playlist),
                            )
                          }
                          className="text-zinc-400 hover:text-green-400"
                          title="Copy playlist link"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                      <div className="px-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              getPlaylistId(playlist),
                            )
                          }
                          className="text-zinc-400 hover:text-green-400"
                          title="Copy playlist ID"
                        >
                          <IdIcon />
                        </button>
                      </div>
                      <div className="px-2">
                        <input
                          type="checkbox"
                          checked={!!selectedRows[key]}
                          onClick={(event) =>
                            handleRowCheckboxClick(playlist, rowIndex, event)
                          }
                          readOnly
                        />
                      </div>
                      <div className="flex items-center gap-2 px-2">
                        <Link
                          href={`/playlists/${playlist.id}`}
                          className={`truncate font-medium hover:text-green-400 ${titleColor}`}
                          title={playlist.name}
                        >
                          {truncateTitle(playlist.name)}
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(playlist.name)
                          }
                          className="text-zinc-500 hover:text-green-400"
                          title="Copy full playlist name"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                      <div className="px-2">
                        <select
                          value={data.category}
                          onChange={(e) =>
                            updateRowData(playlist, {
                              category: e.target.value,
                            })
                          }
                          className="h-8 w-[108px] rounded-lg border border-zinc-800 bg-black px-2 text-xs text-white outline-none focus:border-green-500"
                        >
                          {categoryOptions.map((option) => (
                            <option
                              key={`${key}-category-${option}`}
                              value={option}
                            >
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="px-2">
                        <select
                          value={data.genre}
                          onChange={(e) =>
                            updateRowData(playlist, { genre: e.target.value })
                          }
                          className="h-8 w-[108px] rounded-lg border border-zinc-800 bg-black px-2 text-xs text-white outline-none focus:border-green-500"
                        >
                          {genreOptions.map((option) => (
                            <option
                              key={`${key}-genre-${option}`}
                              value={option}
                            >
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="truncate px-2 text-zinc-400">
                        {getAccountName(playlist.account_id)}
                      </div>
                      <div className="px-2">
                        <select
                          value={data.master}
                          onChange={(e) =>
                            updateRowData(playlist, { master: e.target.value })
                          }
                          className="h-8 w-[126px] rounded-lg border border-zinc-800 bg-black px-2 text-xs text-white outline-none focus:border-green-500"
                        >
                          <option value="">Master</option>
                          {masterOptions.map((name, index) => (
                            <option
                              key={`master-${playlist.id}-${index}-${name}`}
                              value={name}
                            >
                              {truncateTitle(name)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="px-2">{playlist.followers ?? 0}</div>
                      <div className="px-2">{data.ads.length}</div>
                      <div className="px-2">{getTrackCount(playlist)}</div>
                      <div className="px-2 text-[11px]">
                        {formatDate(
                          getLastSyncedAt(playlist),
                        )}
                      </div>
                      <div className="px-1">
                        <GrowthCell value={getTodayValue(playlist, 0)} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={getTodayValue(playlist, 1)} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={getTodayValue(playlist, 2)} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={getTodayValue(playlist, 3)} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={getTodayValue(playlist, 4)} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={playlist.growth_7d} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={playlist.growth_30d} />
                      </div>
                      <div className="px-.5">
                        <select
                          value={data.country}
                          onChange={(e) =>
                            updateRowData(playlist, { country: e.target.value })
                          }
                          className="h-8 w-[80px] rounded-lg border border-zinc-800 bg-black px-2 text-xs text-white outline-none focus:border-green-500"
                          title={data.country || "Country"}
                        >
                          <option value="">Country</option>
                          {countryOptions.map((country, index) => (
                            <option
                              key={`country-${country}-${index}`}
                              value={country}
                            >
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-center px-2">
                        <button
                          type="button"
                          onClick={() => openAdModal(playlist)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-500/70 bg-black text-base font-black leading-none text-green-400 hover:bg-green-500 hover:text-black"
                          title="Add ad date"
                        >
                          +
                        </button>
                      </div>
                      {Array.from({ length: adColumnCount }).map((_, index) => {
                        const ad = data.ads[index];
                        const adColor = getColorOption(ad?.color);
                        const adKey = `${key}::${index}`;
                        const isSelectedAd = !!selectedAds[adKey];
                        return (
                          <div key={`${key}-ad-${index}`} className="flex justify-center px-1">
                            {ad ? (
                              <button
                                type="button"
                                onClick={(event) =>
                                  toggleAdSelection(playlist, index, event)
                                }
                                onDoubleClick={() =>
                                  openAdModal(playlist, index)
                                }
                                className={`flex h-8 w-[48px] items-center justify-center rounded-lg border-2 px-1 text-xs font-bold text-black transition hover:scale-[1.02] ${ad.stroke ? "line-through decoration-2" : ""} ${isSelectedAd ? "border-red-500 ring-2 ring-red-500/40" : "border-transparent hover:border-white/30"}`}
                                style={{ backgroundColor: adColor.bg }}
                                title="Click to select. Double click to edit."
                              >
                                {formatAdDateDisplay(ad.date)}
                              </button>
                            ) : (
                              <span className="text-zinc-700">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {optionModalType ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={closeOptionModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Manage{" "}
                {optionModalType === "category" ? "Categories" : "Genres"}
              </h2>
              <button
                type="button"
                onClick={closeOptionModal}
                className="text-3xl font-black leading-none text-red-500 hover:text-red-400"
              >
                ×
              </button>
            </div>
            <div className="mb-5 flex gap-2">
              <input
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                placeholder={`New ${optionModalType}`}
                className="h-11 flex-1 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
              />
              <button
                type="button"
                onClick={addDropdownOption}
                className="h-11 rounded-xl bg-green-500 px-4 text-sm font-semibold text-black hover:bg-green-400"
              >
                Add
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {(optionModalType === "category"
                ? categoryOptions
                : genreOptions
              ).map((option, index) => {
                const isDefaultPlaceholder =
                  option === "Category" || option === "Genre";
                return (
                  <div
                    key={`${optionModalType}-${option}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black px-3 py-2"
                  >
                    <span className="text-sm text-zinc-200">{option}</span>
                    <button
                      type="button"
                      disabled={isDefaultPlaceholder}
                      onClick={() => deleteDropdownOption(option)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-zinc-700 disabled:hover:bg-transparent"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {adModalKey || bulkAdModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={closeAdModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {bulkAdModalOpen
                  ? "Add Ad Dates"
                  : modalAdIndex === null
                    ? "Add Ad Date"
                    : "Edit Ad Date"}
              </h2>
              <button
                type="button"
                onClick={closeAdModal}
                className="text-3xl font-black leading-none text-red-500 hover:text-red-400"
              >
                ×
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.08em] text-zinc-500">
                  Date
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.08em] text-zinc-500">
                  Color Code
                </label>
                <select
                  value={modalColor}
                  onChange={(e) => setModalColor(e.target.value as CodeColor)}
                  className={`h-11 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm outline-none focus:border-green-500 ${getColorOption(modalColor).textClass}`}
                >
                  {colorOptions.map((color) => (
                    <option
                      key={color.value}
                      value={color.value}
                      className={color.textClass}
                    >
                      {color.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={modalStroke}
                  onChange={(e) => setModalStroke(e.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />
                Add stroke over date
              </label>
              <div className="flex gap-3 pt-1">
                {modalAdIndex !== null && !bulkAdModalOpen ? (
                  <button
                    type="button"
                    onClick={deleteAdDate}
                    className="h-10 flex-1 rounded-xl border border-red-500/40 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={saveAdDate}
                  className="h-10 flex-1 rounded-xl bg-green-500 text-sm font-semibold text-black hover:bg-green-400"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
