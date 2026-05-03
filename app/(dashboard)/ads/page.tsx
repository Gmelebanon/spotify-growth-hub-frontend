"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { getPlaylists } from "@/lib/api/playlists";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type SortField =
  | "id"
  | "title"
  | "category"
  | "genre"
  | "account"
  | "followers"
  | "ads"
  | "tracks"
  | "lastUpdate"
  | "today"
  | "todayMinus1"
  | "todayMinus2"
  | "todayMinus3"
  | "todayMinus4"
  | "growth7d"
  | "growth30d"
  | "country";

type SortOrder = "asc" | "desc";

type AccountRow = {
  id: number;
  display_name?: string;
};

type PlaylistRow = {
  id: number | string;
  account_id?: number;
  name: string;
  followers: number;
  growth?: number;
  growth_24h?: number;
  growth_7d?: number;
  growth_30d?: number;
  tracks_count?: number;
  total_tracks?: number;
  category?: string | null;
  genre?: string | null;
  country?: string | null;
  updated_at?: string | null;
  last_update?: string | null;
  last_update_date?: string | null;
  today?: number | null;
  today_minus_1?: number | null;
  today_minus_2?: number | null;
  today_minus_3?: number | null;
  today_minus_4?: number | null;
  ads?: number | null;
  ads_count?: number | null;
  url?: string | null;
  playlist_url?: string | null;
  spotify_url?: string | null;
  external_url?: string | null;
  spotify_id?: string | null;
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

type AdEntry = {
  date: string;
  color: CodeColor;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const ALL_ACCOUNTS_ID = -1;
const ADS_DATA_STORAGE_KEY = "ads-page-data-v8";
const ADS_CATEGORY_OPTIONS_STORAGE_KEY = "ads-category-options-v1";
const ADS_GENRE_OPTIONS_STORAGE_KEY = "ads-genre-options-v1";

const colorOptions: Array<{
  value: CodeColor;
  label: string;
  textClass: string;
  bg: string;
}> = [
  { value: "gray", label: "Gray", textClass: "text-zinc-300", bg: "#d9d9d9" },
  {
    value: "lightBlue",
    label: "Light Blue",
    textClass: "text-sky-300",
    bg: "#d9ecff",
  },
  {
    value: "lavender",
    label: "Lavender",
    textClass: "text-violet-300",
    bg: "#d8cfee",
  },
  { value: "pink", label: "Pink", textClass: "text-rose-300", bg: "#f7c5c9" },
  {
    value: "lightGreen",
    label: "Light Green",
    textClass: "text-emerald-200",
    bg: "#dcefd1",
  },
  {
    value: "yellow",
    label: "Yellow",
    textClass: "text-yellow-300",
    bg: "#fff400",
  },
  { value: "cyan", label: "Cyan", textClass: "text-cyan-300", bg: "#19e7e7" },
  {
    value: "orange",
    label: "Orange",
    textClass: "text-orange-400",
    bg: "#ff9700",
  },
  { value: "teal", label: "Teal", textClass: "text-teal-300", bg: "#47b8bd" },
  {
    value: "green",
    label: "Green",
    textClass: "text-green-400",
    bg: "#00ef19",
  },
  { value: "blue", label: "Blue", textClass: "text-blue-400", bg: "#1557c8" },
];

const countryOptions = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Rwanda",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Tunisia",
  "Turkey",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

const defaultCategoryOptions = [
  "Category",
  "Running",
  "Workout",
  "Focus",
  "Chill",
  "Dance",
  "Pop",
  "Arabic",
  "Electronic",
  "Other",
];
const defaultGenreOptions = [
  "Genre",
  "Techno",
  "House",
  "Pop",
  "Hip-Hop",
  "Afro",
  "Ambient",
  "Arabic",
  "Dance",
  "Other",
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

function formatGrowth(value: number | undefined | null) {
  const safe = value ?? 0;
  return safe > 0 ? `+${safe}` : `${safe}`;
}

function GrowthCell({ value }: { value: number | undefined | null }) {
  const safe = value ?? 0;
  const colorClass =
    safe > 0 ? "text-green-400" : safe < 0 ? "text-red-400" : "text-zinc-400";

  return <span className={colorClass}>{formatGrowth(safe)}</span>;
}

function formatCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function formatDayMonth(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isWithinLastDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return target >= start;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
}

function formatFilterLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function formatAdDateDisplay(value: string) {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length === 3) {
    return `${Number(parts[1])}/${Number(parts[2])}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function truncateTitle(title: string) {
  return title.length > 26 ? `${title.slice(0, 26)}...` : title;
}

function getTrackCount(playlist: PlaylistRow) {
  return playlist.tracks_count ?? playlist.total_tracks ?? 0;
}

function getTodayValue(playlist: PlaylistRow, offset: 0 | 1 | 2 | 3 | 4) {
  if (offset === 0)
    return playlist.today ?? playlist.growth_24h ?? playlist.growth ?? 0;
  if (offset === 1) return playlist.today_minus_1 ?? 0;
  if (offset === 2) return playlist.today_minus_2 ?? 0;
  if (offset === 3) return playlist.today_minus_3 ?? 0;
  return playlist.today_minus_4 ?? 0;
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M8 8h11v11H8z" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function IdIcon() {
  return <span className="text-[11px] font-black tracking-tight">ID</span>;
}

function PlusIcon() {
  return <span className="text-lg leading-none">+</span>;
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </svg>
  );
}

async function saveAdsMetaToDatabase(
  playlistId: string | number,
  payload: unknown,
) {
  // This frontend call is ready for the backend endpoint.
  // Next backend step: create PATCH /api/playlists/{playlist_id}/ads-meta in FastAPI.
  try {
    await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/ads-meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Keep UI usable even before the backend endpoint exists.
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
  const [rowData, setRowData] = useState<
    Record<
      string,
      {
        color?: CodeColor;
        category: string;
        genre: string;
        country: string;
        master: string;
        ads: AdEntry[];
      }
    >
  >({});
  const [adModalKey, setAdModalKey] = useState<string | null>(null);
  const [modalAdIndex, setModalAdIndex] = useState<number | null>(null);
  const [modalDate, setModalDate] = useState("");
  const [modalColor, setModalColor] = useState<CodeColor>("gray");
  const [categoryOptions, setCategoryOptions] = useState(defaultCategoryOptions);
  const [genreOptions, setGenreOptions] = useState(defaultGenreOptions);
  const [optionModalType, setOptionModalType] = useState<"category" | "genre" | null>(null);
  const [newOptionName, setNewOptionName] = useState("");

  const accountsQuery = useQuery<AccountRow[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const accounts = accountsQuery.data ?? [];

  useEffect(() => {
    if (!activeAccountId && accounts.length > 0) {
      setActiveAccountId(ALL_ACCOUNTS_ID);
    }
  }, [activeAccountId, accounts, setActiveAccountId]);

  useEffect(() => {
    try {
      const savedData = window.localStorage.getItem(ADS_DATA_STORAGE_KEY);
      if (savedData) setRowData(JSON.parse(savedData));
    } catch {
      setRowData({});
    }
  }, []);

  useEffect(() => {
    try {
      const savedCategories = window.localStorage.getItem(ADS_CATEGORY_OPTIONS_STORAGE_KEY);
      const savedGenres = window.localStorage.getItem(ADS_GENRE_OPTIONS_STORAGE_KEY);

      if (savedCategories) setCategoryOptions(JSON.parse(savedCategories));
      if (savedGenres) setGenreOptions(JSON.parse(savedGenres));
    } catch {
      setCategoryOptions(defaultCategoryOptions);
      setGenreOptions(defaultGenreOptions);
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

  const getAccountName = (accountId?: number) => {
    if (!accountId) return "—";
    return (
      accounts.find((account) => account.id === accountId)?.display_name || "—"
    );
  };

  const getRowData = (playlist: PlaylistRow) => {
    const key = playlistKey(playlist);
    return (
      rowData[key] ?? {
        color: "gray" as CodeColor,
        category: playlist.category || "Category",
        genre: playlist.genre || "Genre",
        country: playlist.country || "",
        master: "",
        ads: [],
      }
    );
  };

  const availableCountryOptions = useMemo(
    () => uniqueValues(playlists.map((playlist) => getRowData(playlist).country)),
    [playlists, rowData],
  );

  const masterFilterOptions = useMemo(
    () => uniqueValues(playlists.map((playlist) => playlist.name)),
    [playlists],
  );

  const activeFilterCount = Object.values(filters).filter(
    (value) => value && value !== "all",
  ).length;

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: "",
      color: "",
      country: "",
      genre: "",
      lastUpdate: "all",
      master: "",
    });
  };

  const persistRowData = (next: typeof rowData) => {
    setRowData(next);
    window.localStorage.setItem(ADS_DATA_STORAGE_KEY, JSON.stringify(next));
  };

  const updateRowData = (
    playlist: PlaylistRow,
    patch: Partial<ReturnType<typeof getRowData>>,
  ) => {
    const key = playlistKey(playlist);
    const current = getRowData(playlist);
    const nextRow = { ...current, ...patch };
    const next = { ...rowData, [key]: nextRow };
    persistRowData(next);
    saveAdsMetaToDatabase(playlist.id, nextRow);
  };

  const copyText = async (value: string) => {
    await navigator.clipboard?.writeText(value);
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
    `cursor-pointer whitespace-nowrap px-2.5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] ${
      sortField === field ? "text-green-400" : "text-zinc-400"
    }`;

  const filtered = useMemo(() => {
    let data = playlists;

    if (search) {
      const term = search.toLowerCase();
      data = data.filter((p) => {
        const row = getRowData(p);
        return [
          p.id,
          p.name,
          row.category,
          row.genre,
          getAccountName(p.account_id),
          row.country,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    }

    if (filters.category) {
      data = data.filter((p) => getRowData(p).category === filters.category);
    }

    if (filters.color) {
      data = data.filter((p) => getRowData(p).color === filters.color);
    }

    if (filters.country) {
      data = data.filter((p) => getRowData(p).country === filters.country);
    }

    if (filters.genre) {
      data = data.filter((p) => getRowData(p).genre === filters.genre);
    }

    if (filters.master) {
      data = data.filter((p) => getRowData(p).master === filters.master);
    }

    if (filters.lastUpdate !== "all") {
      const days =
        filters.lastUpdate === "today"
          ? 1
          : filters.lastUpdate === "lastWeek"
            ? 7
            : filters.lastUpdate === "last15"
              ? 15
              : 30;

      data = data.filter((p) =>
        isWithinLastDays(p.updated_at ?? p.last_update ?? p.last_update_date, days),
      );
    }

    return [...data].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      const rowA = getRowData(a);
      const rowB = getRowData(b);

      if (sortField === "id") return (Number(a.id) - Number(b.id)) * dir;
      if (sortField === "title") return a.name.localeCompare(b.name) * dir;
      if (sortField === "category")
        return rowA.category.localeCompare(rowB.category) * dir;
      if (sortField === "genre")
        return rowA.genre.localeCompare(rowB.genre) * dir;
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
          formatDate(
            a.updated_at ?? a.last_update ?? a.last_update_date,
          ).localeCompare(
            formatDate(b.updated_at ?? b.last_update ?? b.last_update_date),
          ) * dir
        );
      if (sortField === "today")
        return (getTodayValue(a, 0) - getTodayValue(b, 0)) * dir;
      if (sortField === "todayMinus1")
        return (getTodayValue(a, 1) - getTodayValue(b, 1)) * dir;
      if (sortField === "todayMinus2")
        return (getTodayValue(a, 2) - getTodayValue(b, 2)) * dir;
      if (sortField === "todayMinus3")
        return (getTodayValue(a, 3) - getTodayValue(b, 3)) * dir;
      if (sortField === "todayMinus4")
        return (getTodayValue(a, 4) - getTodayValue(b, 4)) * dir;
      if (sortField === "growth7d")
        return ((a.growth_7d ?? 0) - (b.growth_7d ?? 0)) * dir;
      if (sortField === "growth30d")
        return ((a.growth_30d ?? 0) - (b.growth_30d ?? 0)) * dir;
      if (sortField === "country")
        return rowA.country.localeCompare(rowB.country) * dir;

      return 0;
    });
  }, [
    playlists,
    search,
    filters,
    rowData,
    sortField,
    sortOrder,
    accounts,
  ]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedRows[playlistKey(p)]);
  const hasSelectedRows = filtered.some((p) => selectedRows[playlistKey(p)]);

  const toggleSelectAll = () => {
    const next = { ...selectedRows };
    filtered.forEach((playlist) => {
      next[playlistKey(playlist)] = !allFilteredSelected;
    });
    setSelectedRows(next);
  };

  const openAdModal = (playlist: PlaylistRow, adIndex?: number) => {
    const current = getRowData(playlist);
    const existingAd =
      typeof adIndex === "number" ? current.ads[adIndex] : null;

    setAdModalKey(playlistKey(playlist));
    setModalAdIndex(typeof adIndex === "number" ? adIndex : null);
    setModalDate(existingAd?.date ?? todayISO());
    setModalColor(existingAd?.color ?? selectedAdColor);
  };

  const closeAdModal = () => {
    setAdModalKey(null);
    setModalAdIndex(null);
    setModalDate("");
    setModalColor(selectedAdColor);
  };

  const saveAdDate = () => {
    if (!adModalKey || !modalDate) return;
    const playlist = playlists.find((p) => playlistKey(p) === adModalKey);
    if (!playlist) return;

    const current = getRowData(playlist);
    let nextAds = [...current.ads];

    if (modalAdIndex !== null) {
      nextAds[modalAdIndex] = { date: modalDate, color: modalColor };
    } else {
      nextAds = [{ date: modalDate, color: modalColor }, ...nextAds].slice(
        0,
        12,
      );
    }

    updateRowData(playlist, { ads: nextAds });
    closeAdModal();
  };

  const deleteAdDate = () => {
    if (!adModalKey || modalAdIndex === null) return;
    const playlist = playlists.find((p) => playlistKey(p) === adModalKey);
    if (!playlist) return;

    const current = getRowData(playlist);
    const nextAds = current.ads.filter((_, index) => index !== modalAdIndex);
    updateRowData(playlist, { ads: nextAds });
    closeAdModal();
  };

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
      window.localStorage.setItem(ADS_CATEGORY_OPTIONS_STORAGE_KEY, JSON.stringify(nextOptions));
    } else {
      setGenreOptions(nextOptions);
      window.localStorage.setItem(ADS_GENRE_OPTIONS_STORAGE_KEY, JSON.stringify(nextOptions));
    }
  };

  const addDropdownOption = () => {
    if (!optionModalType) return;
    const cleaned = newOptionName.trim();
    if (!cleaned) return;

    const currentOptions = optionModalType === "category" ? categoryOptions : genreOptions;
    const exists = currentOptions.some((item) => item.toLowerCase() === cleaned.toLowerCase());
    if (exists) {
      setNewOptionName("");
      return;
    }

    saveOptions(optionModalType, [...currentOptions, cleaned]);
    setNewOptionName("");
  };

  const deleteDropdownOption = (option: string) => {
    if (!optionModalType) return;
    if (option === "Category" || option === "Genre") return;

    const currentOptions = optionModalType === "category" ? categoryOptions : genreOptions;
    saveOptions(optionModalType, currentOptions.filter((item) => item !== option));

    const nextRowData = { ...rowData };
    Object.keys(nextRowData).forEach((key) => {
      if (optionModalType === "category" && nextRowData[key].category === option) {
        nextRowData[key] = { ...nextRowData[key], category: "Category" };
      }
      if (optionModalType === "genre" && nextRowData[key].genre === option) {
        nextRowData[key] = { ...nextRowData[key], genre: "Genre" };
      }
    });
    persistRowData(nextRowData);
  };

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
      "Last Update",
      "Today",
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
        formatDate(playlist.updated_at ?? playlist.last_update ?? playlist.last_update_date),
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

    const escapeCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
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
    reader.onload = () => {
      console.log("Uploaded CSV:", reader.result);
      alert("CSV uploaded. Next step: map these rows to database fields.");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const maxAdColumns = Math.max(
    0,
    ...filtered.map((p) => getRowData(p).ads.length),
  );
  const adColumnCount = Math.min(Math.max(maxAdColumns, 0), 12);
  const gridTemplate = `46px 46px 46px 230px 120px 120px 124px 142px 52px 44px 62px 88px 48px 44px 44px 44px 44px 44px 48px 48px 112px 48px ${Array.from(
    { length: adColumnCount },
  )
    .map(() => "58px")
    .join(" ")}`;

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
            <select
              value={selectedAdColor}
              onChange={(e) => {
                const nextColor = e.target.value as CodeColor;
                setSelectedAdColor(nextColor);

                const selectedPlaylists = filtered.filter(
                  (playlist) => selectedRows[playlistKey(playlist)],
                );

                setRowData((prev) => {
                  const next = { ...prev };

                  selectedPlaylists.forEach((playlist) => {
                    const key = playlistKey(playlist);
                    const current =
                      prev[key] ?? {
                        color: "gray" as CodeColor,
                        category: playlist.category || "Category",
                        genre: playlist.genre || "Genre",
                        country: playlist.country || "",
                        master: "",
                        ads: [],
                      };

                    next[key] = { ...current, color: nextColor };
                    saveAdsMetaToDatabase(playlist.id, next[key]);
                  });

                  window.localStorage.setItem(
                    ADS_DATA_STORAGE_KEY,
                    JSON.stringify(next),
                  );

                  return next;
                });

                setSelectedRows({});
              }}
              className={`h-10 w-auto min-w-[88px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-green-500 ${getColorOption(selectedAdColor).textClass}`}
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
            placeholder="Search..."
            className="h-10 w-[220px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-green-500"
          />

          <div className="group relative z-30">
            <button
              type="button"
              className="flex h-10 w-[140px] items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none hover:border-green-500"
            >
              <span>{activeFilterCount ? `Filter (${activeFilterCount})` : "Filter"}</span>
              <span className="text-zinc-500">›</span>
            </button>

            <div className="absolute right-0 top-full hidden w-56 rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl group-hover:block">
              {[
                {
                  key: "category",
                  label: "Category",
                  options: categoryOptions.filter((item) => item !== "Category"),
                  value: filters.category,
                },
                {
                  key: "color",
                  label: "Color",
                  options: colorOptions.map((color) => color.label),
                  value: filters.color
                    ? getColorOption(filters.color as CodeColor).label
                    : "",
                },
                {
                  key: "country",
                  label: "Country",
                  options: availableCountryOptions,
                  value: filters.country,
                },
                {
                  key: "genre",
                  label: "Genre",
                  options: genreOptions.filter((item) => item !== "Genre"),
                  value: filters.genre,
                },
                {
                  key: "lastUpdate",
                  label: "Last Update",
                  options: ["Today", "Last Week", "Last 15 Days", "Last 30 Days"],
                  value: filters.lastUpdate,
                },
                {
                  key: "master",
                  label: "Master Playlist",
                  options: masterFilterOptions,
                  value: filters.master,
                },
              ].map((filterGroup) => (
                <div key={filterGroup.key} className="group/item relative">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900 hover:text-green-400"
                  >
                    <span>{filterGroup.label}</span>
                    <span className="text-zinc-500">›</span>
                  </button>

                  <div className="absolute left-full top-0 hidden max-h-72 w-56 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl group-hover/item:block">
                    <button
                      type="button"
                      onClick={() =>
                        updateFilter(
                          filterGroup.key as keyof typeof filters,
                          filterGroup.key === "lastUpdate" ? "all" : "",
                        )
                      }
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    >
                      All
                    </button>

                    {filterGroup.options.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-zinc-600">No options</div>
                    ) : (
                      filterGroup.options.map((option, index) => {
                        const colorMatch = colorOptions.find(
                          (color) => color.label === option,
                        );
                        const lastUpdateValue =
                          option === "Today"
                            ? "today"
                            : option === "Last Week"
                              ? "lastWeek"
                              : option === "Last 15 Days"
                                ? "last15"
                                : option === "Last 30 Days"
                                  ? "last30"
                                  : option;
                        const filterValue =
                          filterGroup.key === "color"
                            ? colorMatch?.value ?? ""
                            : lastUpdateValue;

                        return (
                          <button
                            key={`${filterGroup.key}-${option}-${index}`}
                            type="button"
                            onClick={() =>
                              updateFilter(
                                filterGroup.key as keyof typeof filters,
                                filterValue,
                              )
                            }
                            className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-900 ${
                              colorMatch ? colorMatch.textClass : "text-zinc-200"
                            }`}
                          >
                            {formatFilterLabel(option)}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}

              {activeFilterCount ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-1 w-full rounded-lg border-t border-zinc-800 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                >
                  Clear filters
                </button>
              ) : null}
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
                {acc.display_name}
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
              <div className="whitespace-nowrap px-2.5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                URL
              </div>
              <div
                className={headerClass("id")}
                onClick={() => toggleSort("id")}
              >
                ID {arrowFor("id")}
              </div>
              <div className="flex items-center px-2.5 py-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-green-500"
                  title={allFilteredSelected ? "Deselect all" : "Select all"}
                />
              </div>
              <div
                className={headerClass("title")}
                onClick={() => toggleSort("title")}
              >
                Title {arrowFor("title")}
              </div>
              <div className="flex items-center gap-1 px-2.5 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("category")}
                  className={`text-left text-[10px] font-semibold uppercase tracking-[0.06em] ${
                    sortField === "category" ? "text-green-400" : "text-zinc-400"
                  }`}
                >
                  Category {arrowFor("category")}
                </button>
                <button
                  type="button"
                  onClick={() => openOptionModal("category")}
                  className="text-sm leading-none text-green-400 hover:text-green-300"
                  title="Add or remove categories"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort("genre")}
                  className={`text-left text-[10px] font-semibold uppercase tracking-[0.06em] ${
                    sortField === "genre" ? "text-green-400" : "text-zinc-400"
                  }`}
                >
                  Genre {arrowFor("genre")}
                </button>
                <button
                  type="button"
                  onClick={() => openOptionModal("genre")}
                  className="text-sm leading-none text-green-400 hover:text-green-300"
                  title="Add or remove genres"
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
              <div className="whitespace-nowrap px-2.5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Master
              </div>
              <div
                className={headerClass("followers")}
                onClick={() => toggleSort("followers")}
              >
                FLW {arrowFor("followers")}
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
                # Tracks {arrowFor("tracks")}
              </div>
              <div
                className={headerClass("lastUpdate")}
                onClick={() => toggleSort("lastUpdate")}
              >
                Last Update {arrowFor("lastUpdate")}
              </div>
              <div
                className={headerClass("today")}
                onClick={() => toggleSort("today")}
              >
                Today {arrowFor("today")}
              </div>
              <div
                className={headerClass("todayMinus1")}
                onClick={() => toggleSort("todayMinus1")}
              >
                {formatDayMonth(1)} {arrowFor("todayMinus1")}
              </div>
              <div
                className={headerClass("todayMinus2")}
                onClick={() => toggleSort("todayMinus2")}
              >
                {formatDayMonth(2)} {arrowFor("todayMinus2")}
              </div>
              <div
                className={headerClass("todayMinus3")}
                onClick={() => toggleSort("todayMinus3")}
              >
                {formatDayMonth(3)} {arrowFor("todayMinus3")}
              </div>
              <div
                className={headerClass("todayMinus4")}
                onClick={() => toggleSort("todayMinus4")}
              >
                {formatDayMonth(4)} {arrowFor("todayMinus4")}
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
                className={`${headerClass("country")} px-1.5`}
                onClick={() => toggleSort("country")}
              >
                Country {arrowFor("country")}
              </div>
              <div className="whitespace-nowrap px-16 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Ad Date
              </div>
              {Array.from({ length: adColumnCount }).map((_, index) => (
                <div
                  key={`ad-header-${index}`}
                  className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400"
                >
                  Ad {index + 1}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="px-5 py-8 text-sm text-zinc-400">
                Loading playlists...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-8 text-sm text-zinc-400">
                No playlists found.
              </div>
            ) : (
              <div>
                {filtered.map((playlist, rowIndex) => {
                  const key = playlistKey(playlist);
                  const selected = !!selectedRows[key];
                  const data = getRowData(playlist);
                  const masterOptions = playlists
                    .filter((item) => item.id !== playlist.id)
                    .map((item) => item.name);

                  return (
                    <div
                      key={`${key}-${rowIndex}`}
                      className="grid items-center border-b border-zinc-900 py-3 text-sm text-zinc-200"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="px-2.5">
                        <button
                          type="button"
                          onClick={() => copyText(getPlaylistUrl(playlist))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:border-green-500 hover:text-green-400"
                          title="Copy playlist link"
                        >
                          <CopyIcon />
                        </button>
                      </div>

                      <div className="px-2.5">
                        <button
                          type="button"
                          onClick={() => copyText(getPlaylistId(playlist))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:border-green-500 hover:text-green-400"
                          title="Copy playlist ID"
                        >
                          <IdIcon />
                        </button>
                      </div>

                      <div className="px-2.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            setSelectedRows((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-green-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 px-2.5">
                        <Link
                          href={`/playlists/${playlist.id}?accountId=${playlist.account_id}`}
                          className={`truncate font-semibold hover:text-green-400 ${data.color && data.color !== "gray" ? getColorOption(data.color).textClass : "text-zinc-200"}`}
                          title={playlist.name}
                        >
                          {truncateTitle(playlist.name)}
                        </Link>
                        <button
                          type="button"
                          onClick={() => copyText(playlist.name)}
                          className="text-zinc-500 hover:text-green-400"
                          title="Copy full playlist title"
                        >
                          <CopyIcon />
                        </button>
                      </div>

                      <div className="px-2.5">
                        <select
                          value={data.category}
                          onChange={(e) =>
                            updateRowData(playlist, {
                              category: e.target.value,
                            })
                          }
                          className="h-9 w-full rounded-lg border border-zinc-800 bg-black px-2 text-xs outline-none focus:border-green-500"
                        >
                          {categoryOptions.map((item, index) => (
                            <option
                              key={`category-${item}-${index}`}
                              value={item}
                            >
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="px-2.5">
                        <select
                          value={data.genre}
                          onChange={(e) =>
                            updateRowData(playlist, { genre: e.target.value })
                          }
                          className="h-9 w-full rounded-lg border border-zinc-800 bg-black px-2 text-xs outline-none focus:border-green-500"
                        >
                          {genreOptions.map((item, index) => (
                            <option key={`genre-${item}-${index}`} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="truncate px-2.5 text-xs">
                        {getAccountName(playlist.account_id)}
                      </div>

                      <div className="px-2.5">
                        <select
                          value={data.master}
                          onChange={(e) =>
                            updateRowData(playlist, { master: e.target.value })
                          }
                          className="h-9 w-full rounded-lg border border-zinc-800 bg-black px-3 text-xs outline-none focus:border-green-500"
                        >
                          <option value="">Select master</option>
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

                      <div className="px-2.5">{playlist.followers ?? 0}</div>
                      <div className="px-2.5">{data.ads.length}</div>
                      <div className="px-2.5">{getTrackCount(playlist)}</div>
                      <div className="px-3 text-xs">
                        {formatDate(
                          playlist.updated_at ??
                            playlist.last_update ??
                            playlist.last_update_date,
                        )}
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={getTodayValue(playlist, 0)} />
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={getTodayValue(playlist, 1)} />
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={getTodayValue(playlist, 2)} />
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={getTodayValue(playlist, 3)} />
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={getTodayValue(playlist, 4)} />
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={playlist.growth_7d} />
                      </div>
                      <div className="px-1.5">
                        <GrowthCell value={playlist.growth_30d} />
                      </div>

                      <div className="px-1.5">
                        <div className="relative h-8 w-[104px] min-w-[104px]">
                          <select
                            value={data.country}
                            onChange={(e) =>
                              updateRowData(playlist, { country: e.target.value })
                            }
                            className="h-8 w-[104px] min-w-[104px] appearance-none truncate rounded-lg border border-zinc-800 bg-black py-0 pl-3 pr-7 text-xs text-white outline-none focus:border-green-500"
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
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">
                            ▾
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center px-23">
                        <button
                          type="button"
                          onClick={() => openAdModal(playlist)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-green-500/60 bg-black text-sm font-bold leading-none text-green-400 hover:border-green-400 hover:bg-zinc-900"
                          title="Add ad date"
                        >
                          +
                        </button>
                      </div>

                      {Array.from({ length: adColumnCount }).map((_, index) => {
                        const ad = data.ads[index];
                        const adColor = getColorOption(ad?.color);
                        return (
                          <div key={`${key}-ad-${index}`} className="px-1.5">
                            {ad ? (
                              <button
                                type="button"
                                onClick={() => openAdModal(playlist, index)}
                                className="flex h-8 w-[48px] items-center justify-center rounded-lg border border-white/10 px-1 text-xs font-bold text-black transition hover:scale-[1.02] hover:border-white/30"
                                style={{ backgroundColor: adColor.bg }}
                                title={ad.date}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Manage {optionModalType === "category" ? "Categories" : "Genres"}
              </h2>
              <button
                onClick={closeOptionModal}
                className="text-zinc-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-5 flex gap-2">
              <input
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addDropdownOption();
                }}
                placeholder={`Add new ${optionModalType}`}
                className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500"
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
              {(optionModalType === "category" ? categoryOptions : genreOptions).map((option, index) => {
                const isDefaultPlaceholder = option === "Category" || option === "Genre";
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

      {adModalKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {modalAdIndex === null ? "Add Ad Date" : "Edit Ad Date"}
              </h2>
              <button
                onClick={closeAdModal}
                className="text-zinc-400 hover:text-white"
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

              <div className="flex gap-3 pt-1">
                {modalAdIndex !== null ? (
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
