"use client";

import Link from "next/link";
import { type ChangeEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { useActiveAccountStore } from "@/lib/store/activeAccount";

type CodeColor =
  | "gray"
  | "blue"
  | "pink"
  | "green"
  | "yellow"
  | "red"
  | "navy"
  | "purple"
  | "orange"
  | "cyan"
  | "burgundy";

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
  | "country"
  | "adDate";

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
  spotify_playlist_id?: string | null;
  spotify_url?: string | null;
  playlist_url?: string | null;
  external_url?: string | null;
  url?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  cover_url?: string | null;
  artwork_url?: string | null;
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
  updatedAt?: string | null;
  modified_at?: string | null;
  modifiedAt?: string | null;
  last_modified?: string | null;
  lastModified?: string | null;
  last_update?: string | null;
  last_update_date?: string | null;
  synced_at?: string | null;
  last_synced_at?: string | null;
  last_synced?: string | null;
  lastSyncedAt?: string | null;
  lastSynced?: string | null;
  [key: string]: unknown;
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

type AdsSettingsRow = {
  playlist_id?: string | number | null;
  spotify_id?: string | null;
  spotify_playlist_id?: string | null;
  playlist_name?: string | null;
  category?: string | null;
  genre?: string | null;
  country?: string | null;
  master_playlist?: string | null;
  ad_date?: string | null;
  ads?: AdEntry[] | null;
  color?: CodeColor | null;
  settings?: {
    ads?: AdEntry[];
    color?: CodeColor;
    category?: string;
    genre?: string;
    country?: string;
    master_playlist?: string;
  } | null;
};

type AdsFilterOptionRow = {
  id?: string;
  option_type?: string;
  value?: string;
};

const EMPTY_ACCOUNTS: AccountRow[] = [];
const ALL_ACCOUNTS_ID = -1;
const ADS_DATA_STORAGE_KEY = "ads-page-row-data-v17";
const ADS_CATEGORY_OPTIONS_STORAGE_KEY = "ads-page-category-options-v17";
const ADS_GENRE_OPTIONS_STORAGE_KEY = "ads-page-genre-options-v17";
const ADS_HIDDEN_ROWS_STORAGE_KEY = "ads-page-hidden-rows-v1";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

async function fetchPlaylistsWithHistory(
  accountId: number,
): Promise<PlaylistRow[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/accounts/${accountId}/playlists`,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Failed to load playlists for account ${accountId}`,
    );
  }

  const payload = await response.json();

  if (Array.isArray(payload)) return payload as PlaylistRow[];
  if (Array.isArray(payload?.items)) return payload.items as PlaylistRow[];
  if (Array.isArray(payload?.playlists))
    return payload.playlists as PlaylistRow[];

  return [];
}

const defaultCategoryOptions = [
  "Category",
  "Aesthetic",
  "Afro House",
  "Amapiano",
  "Beach",
  "Country",
  "Deep House",
  "Driving",
  "EDM",
  "Gospel",
  "Instrumental",
  "Kids",
  "Lounge",
  "Mashups",
  "Meditation",
  "Nature",
  "Orchestral",
  "Pop",
  "Remixes",
  "Riddim",
  "Romance",
  "Running",
  "Sad",
  "Sleep",
  "Spinning",
  "Studying",
  "Summer",
  "Techno",
  "UKG",
  "Viral",
  "Walking",
  "Wellness",
];

const defaultGenreOptions = [
  "Genre",
  "Afro House",
  "Amapiano",
  "Ambient",
  "Chill House",
  "Instrumentals",
  "Mashups",
  "Mixed",
  "Pop",
  "Reggae",
  "Soft Pop",
  "Techno",
  "UKG",
  "Viral Mixed",
  "World EDM",
];

function mergeDropdownOptions(
  defaults: string[],
  saved: string[] | null | undefined,
) {
  const merged: string[] = [];
  [...defaults, ...(saved ?? [])].forEach((item) => {
    const clean = String(item || "").trim();
    if (!clean) return;
    if (
      !merged.some((existing) => existing.toLowerCase() === clean.toLowerCase())
    ) {
      merged.push(clean);
    }
  });

  const placeholders = merged.filter((item) => item === "Category" || item === "Genre");
  const realOptions = merged
    .filter((item) => item !== "Category" && item !== "Genre")
    .sort((a, b) => a.localeCompare(b));

  return [...placeholders, ...realOptions];
}

const colorOptions: Array<{
  value: CodeColor;
  label: string;
  textClass: string;
  bg: string;
}> = [
  {
    value: "gray",
    label: "Gray - WORLDWIDE",
    textClass: "text-zinc-400",
    bg: "#71717a",
  },
  {
    value: "blue",
    label: "Blue - USA",
    textClass: "text-blue-400",
    bg: "#60a5fa",
  },
  {
    value: "pink",
    label: "Pink - UK",
    textClass: "text-pink-400",
    bg: "#f472b6",
  },
  {
    value: "green",
    label: "Green - BRAZIL",
    textClass: "text-green-400",
    bg: "#22c55e",
  },
  {
    value: "yellow",
    label: "Yellow - AUSTRALIA",
    textClass: "text-yellow-300",
    bg: "#fde047",
  },
  {
    value: "red",
    label: "Red - SPAIN",
    textClass: "text-red-400",
    bg: "#f87171",
  },
  {
    value: "navy",
    label: "Navy - FRANCE",
    textClass: "text-sky-300",
    bg: "#1e3a8a",
  },
  {
    value: "purple",
    label: "Purple - GERMANY",
    textClass: "text-purple-400",
    bg: "#c084fc",
  },
  {
    value: "orange",
    label: "Orange - NETHERLANDS",
    textClass: "text-orange-400",
    bg: "#fb923c",
  },
  {
    value: "cyan",
    label: "Cyan - ITALY",
    textClass: "text-cyan-300",
    bg: "#22d3ee",
  },
  {
    value: "burgundy",
    label: "Burgundy - PORTUGAL",
    textClass: "text-rose-300",
    bg: "#7f1d1d",
  },
];

const countryOptions = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
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
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
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
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
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

function getColorNameLabel(color: CodeColor) {
  const label = getColorOption(color).label;
  return label.includes(" - ") ? label.split(" - ")[0] : label;
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
  const record = playlist as PlaylistRow & Record<string, unknown>;
  const adsMeta = (record.ads_meta || {}) as Record<string, unknown>;

  const candidates = [
    record.last_synced_at,
    record.last_synced,
    record.lastSyncedAt,
    record.lastSynced,
    record.synced_at,
    record.updated_at,
    record.updatedAt,
    record.modified_at,
    record.modifiedAt,
    record.last_modified,
    record.lastModified,
    record.last_update,
    record.last_update_date,
    adsMeta.last_synced,
    adsMeta.last_synced_at,
    adsMeta.synced_at,
    adsMeta.updated_at,
  ];

  const valid = candidates.find((value) => {
    if (!value) return false;
    const date = new Date(String(value));
    return !Number.isNaN(date.getTime());
  });

  return valid ? String(valid) : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatAdDateDisplay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}/${month}`;
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

function AdsSelect({
  value,
  options,
  placeholder,
  onChange,
  widthClass = "w-[108px]",
  title,
  searchable = true,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  widthClass?: string;
  title?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedLabel = value || placeholder;
  const cleanOptions = useMemo(
    () =>
      uniqueValues(options.filter(Boolean)).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    [options],
  );
  const visibleOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return cleanOptions;
    return cleanOptions.filter((option) => option.toLowerCase().includes(query));
  }, [cleanOptions, searchValue]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: globalThis.MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && ref.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSearchValue("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${widthClass}`} title={title || selectedLabel}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black px-2 text-left text-xs font-semibold text-white outline-none transition focus:border-green-500 hover:border-green-500/70"
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <span className="shrink-0 text-green-400">▾</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[220px] rounded-lg border border-green-500/50 bg-black p-1 shadow-2xl shadow-black/50">
          {searchable ? (
            <input
              ref={inputRef}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder={`Type ${placeholder.toLowerCase()}...`}
              className="mb-1 h-8 w-full rounded-md border border-zinc-800 bg-black px-2 text-xs font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
            />
          ) : null}

          <div className="ads-green-scrollbar max-h-72 overflow-y-auto rounded-md bg-black py-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`block w-full truncate px-2 py-2 text-left text-xs font-semibold transition hover:bg-green-500/15 ${!value ? "bg-green-500/20 text-green-300" : "text-white"}`}
            >
              {placeholder}
            </button>
            {visibleOptions.length === 0 ? (
              <div className="px-2 py-3 text-xs font-semibold text-zinc-500">
                No matches
              </div>
            ) : (
              visibleOptions.map((option) => (
                <button
                  type="button"
                  key={`${placeholder}-${option}`}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`block w-full truncate px-2 py-2 text-left text-xs font-semibold transition hover:bg-green-500/15 ${value === option ? "bg-green-500/20 text-green-300" : "text-white"}`}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


function readPlaylistManagerName(item: Record<string, unknown>) {
  return String(
    item.name ??
      item.playlist_name ??
      item.playlistName ??
      item.title ??
      item.display_name ??
      "",
  ).trim();
}

function extractPlaylistManagerItemsFromState(
  state: Record<string, unknown> | null | undefined,
) {
  const output: Array<Record<string, unknown>> = [];

  const pushArray = (value: unknown) => {
    if (Array.isArray(value)) {
      output.push(...(value as Array<Record<string, unknown>>));
    }
  };

  pushArray(state?.savedPlaylists);
  pushArray(state?.syncedPlaylists);
  pushArray(state?.importedPlaylists);
  pushArray(state?.playlists);
  pushArray(state?.masterPlaylists);
  pushArray(state?.savedMasterPlaylists);
  pushArray(state?.synced_playlists);
  pushArray(state?.imported_playlists);

  return output;
}

function loadPlaylistManagerItemsFromLocalStorage() {
  if (typeof window === "undefined") return [] as Array<Record<string, unknown>>;

  const keys = [
    "nerd-engine-playlist-manager-state",
    "playlist-manager-state",
    "nerd-engine-master-playlists",
    "nerd-engine-saved-master-playlists",
    "nerd-engine-playlist-manager-master-playlists",
    "playlist-manager-master-playlists",
    "masterPlaylists",
    "savedMasterPlaylists",
  ];

  const items: Array<Record<string, unknown>> = [];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        items.push(...(parsed as Array<Record<string, unknown>>));
      } else if (parsed && typeof parsed === "object") {
        items.push(...extractPlaylistManagerItemsFromState(parsed as Record<string, unknown>));
      }
    } catch {
      // Ignore invalid local storage records.
    }
  }

  return items;
}

function readPlaylistManagerId(item: Record<string, unknown>, fallbackName = "") {
  const value =
    item.id ??
    item.playlistId ??
    item.playlist_id ??
    item.spotify_playlist_id ??
    item.spotify_id ??
    item.target_master_playlist_id ??
    fallbackName;

  return String(value || fallbackName || "").trim();
}

function readPlaylistManagerTrackCount(item: Record<string, unknown>) {
  return (
    Number(
      item.tracks_count ??
        item.track_count ??
        item.total_tracks ??
        item.tracksTotal ??
        item.tracks,
    ) || 0
  );
}

function mergePlaylistManagerList(
  currentList: unknown,
  nextItem: Record<string, unknown>,
) {
  const list = Array.isArray(currentList)
    ? ([...(currentList as Array<Record<string, unknown>>)] as Array<Record<string, unknown>>)
    : [];

  const nextName = readPlaylistManagerName(nextItem).toLowerCase();
  const nextId = readPlaylistManagerId(nextItem).toLowerCase();

  const exists = list.some((item) => {
    const name = readPlaylistManagerName(item).toLowerCase();
    const id = readPlaylistManagerId(item).toLowerCase();
    return Boolean((nextName && name === nextName) || (nextId && id === nextId));
  });

  return exists ? list : [...list, nextItem];
}

function isAdsManagedPlaylistManagerItem(item: Record<string, unknown>) {
  const source = String(item.source ?? item.managedBy ?? item.managed_by ?? "").toLowerCase();
  return (
    source.includes("ads-master-dropdown") ||
    source.includes("ads") ||
    item.adsManaged === true ||
    item.ads_managed === true
  );
}

function removeAdsManagedPlaylistManagerItem(
  currentList: unknown,
  targetName: string,
) {
  const targetKey = targetName.trim().toLowerCase();
  if (!targetKey) return Array.isArray(currentList) ? currentList : [];

  const list = Array.isArray(currentList)
    ? ([...(currentList as Array<Record<string, unknown>>)] as Array<Record<string, unknown>>)
    : [];

  return list.filter((item) => {
    const name = readPlaylistManagerName(item).toLowerCase();
    const id = readPlaylistManagerId(item).toLowerCase();
    const matchesTarget = Boolean((name && name === targetKey) || (id && id === targetKey));

    if (!matchesTarget) return true;

    // Only remove playlists that Ads added automatically. Do not delete
    // playlists the user manually synced/imported in Playlist Manager.
    return !isAdsManagedPlaylistManagerItem(item);
  });
}

function persistPlaylistManagerStateLocally(nextState: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const stateKeys = [
    "nerd-engine-playlist-manager-state",
    "playlist-manager-state",
  ];

  const syncedPlaylists = Array.isArray(nextState.syncedPlaylists)
    ? nextState.syncedPlaylists
    : Array.isArray(nextState.synced_playlists)
      ? nextState.synced_playlists
      : [];
  const importedPlaylists = Array.isArray(nextState.importedPlaylists)
    ? nextState.importedPlaylists
    : Array.isArray(nextState.imported_playlists)
      ? nextState.imported_playlists
      : [];

  const arrayKeys: Array<[string, unknown]> = [
    ["nerd-engine-playlist-manager-synced-playlists", syncedPlaylists],
    ["playlist-manager-synced-playlists", syncedPlaylists],
    ["syncedPlaylists", syncedPlaylists],
    ["synced_playlists", syncedPlaylists],
    ["nerd-engine-playlist-manager-imported-playlists", importedPlaylists],
    ["playlist-manager-imported-playlists", importedPlaylists],
    ["importedPlaylists", importedPlaylists],
    ["imported_playlists", importedPlaylists],
  ];

  for (const key of stateKeys) {
    try {
      window.localStorage.setItem(key, JSON.stringify(nextState));
    } catch {
      // Keep database save as the source of truth if local storage fails.
    }
  }

  for (const [key, value] of arrayKeys) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep database save as the source of truth if local storage fails.
    }
  }
}

function getTrackCount(playlist: PlaylistRow | null | undefined) {
  return playlist?.tracks_count ?? playlist?.total_tracks ?? 0;
}

function adsFormatDayLabel(dayOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() - dayOffset);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function adsNormalizeHistoryLabel(value?: string | null) {
  if (!value) return "";

  const clean = String(value).trim();

  if (/^\d{1,2}\/\d{1,2}$/.test(clean)) return clean;

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getDate()}/${parsed.getMonth() + 1}`;
  }

  return clean;
}

function adsGetNumericValue(value: unknown) {
  if (typeof value === "number") return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function adsHistoryValue(
  item:
    | NonNullable<PlaylistRow["daily_growth"]>[number]
    | NonNullable<PlaylistRow["daily_history"]>[number]
    | undefined,
) {
  return (
    adsGetNumericValue(item?.growth) ??
    adsGetNumericValue(item?.value) ??
    adsGetNumericValue(item?.count) ??
    adsGetNumericValue(item?.followers) ??
    adsGetNumericValue(item?.followers_count) ??
    0
  );
}

function getDirectDailyStatValue(playlist: PlaylistRow, dayOffset: number) {
  const record = playlist as PlaylistRow & Record<string, unknown>;

  const candidatesByOffset: Record<number, unknown[]> = {
    0: [
      record.today,
      record.today_growth,
      record.growth_today,
      record.growth_24h,
      record.followers_today,
      record.day_0,
      record.today_0,
    ],
    1: [
      record.today_minus_1,
      record.day_1,
      record.followers_day_1,
      record.today_1,
    ],
    2: [
      record.today_minus_2,
      record.day_2,
      record.followers_day_2,
      record.today_2,
    ],
    3: [
      record.today_minus_3,
      record.day_3,
      record.followers_day_3,
      record.today_3,
    ],
    4: [
      record.today_minus_4,
      record.day_4,
      record.followers_day_4,
      record.today_4,
    ],
  };

  for (const value of candidatesByOffset[dayOffset] ?? []) {
    const numeric = adsGetNumericValue(value);
    if (numeric !== null) return numeric;
  }

  return null;
}

function getDailyStatValue(playlist: PlaylistRow, dayOffset: number) {
  const targetLabel = adsFormatDayLabel(dayOffset);
  let matchedValue: number | null = null;

  // The backend sends daily stat values directly. Match the exact date column
  // instead of subtracting follower snapshots or shifting by array index.
  const dailyGrowthRow = (playlist.daily_growth ?? []).find((item) => {
    const label = adsNormalizeHistoryLabel(item.date || item.label);
    return label === targetLabel;
  });

  if (dailyGrowthRow) {
    matchedValue = adsHistoryValue(dailyGrowthRow);
    if (matchedValue !== 0) return matchedValue;
  }

  const dailyHistoryRow = (playlist.daily_history ?? []).find((item) => {
    const label = adsNormalizeHistoryLabel(item.date || item.label);
    return label === targetLabel;
  });

  if (dailyHistoryRow) {
    matchedValue = adsHistoryValue(dailyHistoryRow);
    if (matchedValue !== 0) return matchedValue;
  }

  // Fallback to direct fields like today/today_minus_1 when daily arrays are
  // missing or stale.
  const directValue = getDirectDailyStatValue(playlist, dayOffset);
  if (directValue !== null && directValue !== 0) return directValue;

  if (matchedValue !== null) return matchedValue;
  if (directValue !== null) return directValue;

  return 0;
}

function getTodayValue(playlist: PlaylistRow, offset: 0 | 1 | 2 | 3 | 4) {
  return getDailyStatValue(playlist, offset);
}

function getFollowerGainSum(playlist: PlaylistRow, days: 7 | 30) {
  let total = 0;
  let hasDailyData = false;

  for (let offset = 0; offset < days; offset += 1) {
    const targetLabel = adsFormatDayLabel(offset);

    const hasGrowthRow = (playlist.daily_growth ?? []).some((item) => {
      const label = adsNormalizeHistoryLabel(item.date || item.label);
      return label === targetLabel;
    });

    const hasHistoryRow = (playlist.daily_history ?? []).some((item) => {
      const label = adsNormalizeHistoryLabel(item.date || item.label);
      return label === targetLabel;
    });

    const hasDirectValue = getDirectDailyStatValue(playlist, offset) !== null;

    if (hasGrowthRow || hasHistoryRow || hasDirectValue) {
      hasDailyData = true;
    }

    total += getDailyStatValue(playlist, offset);
  }

  // A real seven-day or thirty-day total can validly equal zero. Only use the
  // backend summary when no daily source exists at all.
  if (!hasDailyData) {
    const backendSummary =
      days === 7
        ? adsGetNumericValue(playlist.growth_7d)
        : adsGetNumericValue(playlist.growth_30d);

    if (backendSummary !== null) return backendSummary;
  }

  return total;
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

function parseTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseDateOnlyTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getLatestAdTimestamp(ads: AdEntry[]) {
  return ads.reduce((latest, ad) => {
    const stamp = parseDateOnlyTimestamp(ad.date);
    return Math.max(latest, stamp);
  }, 0);
}

function CopyIcon() {
  return <span className="text-[15px] font-black leading-none">⧉</span>;
}

function IdIcon() {
  return <span className="text-[12px] font-black leading-none">ID</span>;
}

function DownloadIcon() {
  return <span className="text-[15px] leading-none">↓</span>;
}

function UndoIcon() {
  return <span className="inline-block rotate-90 text-[16px] leading-none">↶</span>;
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.3" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M14.1 9.9A3 3 0 0 0 12 9" />
    </svg>
  );
}

function UploadIcon() {
  return <span className="text-[15px] leading-none">↑</span>;
}

function normalizeAdEntry(value: unknown): AdEntry | null {
  const entry = value as Partial<AdEntry> | null;
  if (!entry?.date) return null;

  return {
    date: String(entry.date),
    color: (entry.color as CodeColor) || "gray",
    stroke: Boolean(entry.stroke),
  };
}

function normalizeAdsArray(value: unknown): AdEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeAdEntry).filter(Boolean) as AdEntry[];
}

function normalizeAdsSettingsPayload(payload: unknown): AdsSettingsRow[] {
  if (Array.isArray(payload)) return payload as AdsSettingsRow[];
  const record = payload as {
    items?: unknown;
    rows?: unknown;
    data?: unknown;
  } | null;
  if (Array.isArray(record?.items)) return record.items as AdsSettingsRow[];
  if (Array.isArray(record?.rows)) return record.rows as AdsSettingsRow[];
  if (Array.isArray(record?.data)) return record.data as AdsSettingsRow[];
  return [];
}

function rowMetaFromSettingsRow(row: AdsSettingsRow): RowMeta {
  const settings = row.settings ?? {};
  const adsFromRow = normalizeAdsArray(row.ads);
  const adsFromSettings = normalizeAdsArray(settings.ads);
  const fallbackAdDate = row.ad_date
    ? [
        {
          date: String(row.ad_date).slice(0, 10),
          color: (row.color || settings.color || "gray") as CodeColor,
        },
      ]
    : [];

  return {
    color: row.color || settings.color || "gray",
    category: row.category || settings.category || "Category",
    genre: row.genre || settings.genre || "Genre",
    country: row.country || settings.country || "",
    master: row.master_playlist || settings.master_playlist || "",
    ads:
      adsFromRow.length > 0
        ? adsFromRow
        : adsFromSettings.length > 0
          ? adsFromSettings
          : fallbackAdDate,
  };
}

function isPlaceholderValue(value: string | undefined, placeholder: string) {
  return !value || value === placeholder;
}

function preferSavedMeta(local: RowMeta | undefined, saved: RowMeta): RowMeta {
  if (!local) return saved;

  return {
    color: local.color && local.color !== "gray" ? local.color : saved.color,
    category: isPlaceholderValue(local.category, "Category")
      ? saved.category
      : local.category,
    genre: isPlaceholderValue(local.genre, "Genre") ? saved.genre : local.genre,
    country: local.country || saved.country,
    master: local.master || saved.master,
    ads: local.ads?.length ? local.ads : saved.ads,
  };
}

async function fetchAdsFilterOptionsFromDatabase() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ads/filter-options`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items as AdsFilterOptionRow[];
  } catch {
    return [];
  }
}

async function saveAdsFilterOptionToDatabase(
  optionType: "category" | "genre",
  value: string,
) {
  try {
    await fetch(`${API_BASE_URL}/api/ads/filter-options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option_type: optionType,
        value,
      }),
    });
  } catch {
    // Keep local option even if backend save fails.
  }
}

async function deleteAdsFilterOptionFromDatabase(
  optionType: "category" | "genre",
  value: string,
) {
  try {
    const rows = await fetchAdsFilterOptionsFromDatabase();
    const match = rows.find(
      (item) =>
        item.option_type === optionType &&
        String(item.value || "").toLowerCase() === value.toLowerCase(),
    );
    if (!match?.id) return;

    await fetch(`${API_BASE_URL}/api/ads/filter-options/${match.id}`, {
      method: "DELETE",
    });
  } catch {
    // Keep local delete responsive even if backend delete fails.
  }
}

async function fetchAdsSettingsFromDatabase() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ads/settings`);
    if (!response.ok) return [];
    return normalizeAdsSettingsPayload(await response.json());
  } catch {
    return [];
  }
}

async function saveAdsSettingsToDatabase(
  playlistId: string | number,
  playlistName: string,
  data: RowMeta,
) {
  const latestAd = data.ads?.[0] ?? null;

  const response = await fetch(`${API_BASE_URL}/api/ads/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playlist_id: String(playlistId),
      playlist_name: playlistName,
      category: data.category,
      genre: data.genre,
      country: data.country,
      master_playlist: data.master,
      ad_date: latestAd?.date ?? null,
      color: data.color ?? "gray",
      ads: data.ads,
      settings: {
        category: data.category,
        genre: data.genre,
        country: data.country,
        master_playlist: data.master,
        color: data.color ?? "gray",
        ads: data.ads,
      },
    }),
  });

  if (!response.ok) {
    // The playlists ads-meta route (saveAdsMetaToDatabase) is still the
    // main fallback, so don't block on this one — but the caller needs to
    // know it failed rather than silently treating it as saved.
    throw new Error(`ads-settings save failed (${response.status})`);
  }
}

async function saveAdsMetaToDatabase(
  playlistId: string | number,
  data: RowMeta,
  playlistName = "",
) {
  const payload = {
    category: data.category,
    genre: data.genre,
    country: data.country,
    master_playlist: data.master,
    ads: data.ads,
    color: data.color,
  };

  // These two writes hit different backend tables (`ads_meta`, embedded as a
  // fallback on the playlists list response, and `ads_playlist_settings`,
  // which is what hydrates rowData on load). ads-meta is the primary write;
  // ads-settings is best-effort, so a settings-only failure is logged but
  // doesn't fail the whole save.
  //
  // Both throw on a non-2xx response (not just a network failure) — a fetch
  // promise resolves normally even for a 429/500, so without this check a
  // rate-limited or failed save looked identical to a successful one.
  const [metaResult, settingsResult] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/api/playlists/${playlistId}/ads-meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`ads-meta save failed (${response.status})`);
      }
    }),
    saveAdsSettingsToDatabase(playlistId, playlistName, data),
  ]);

  if (settingsResult.status === "rejected") {
    console.error("Playlist ads-settings autosave failed", settingsResult.reason);
  }

  if (metaResult.status === "rejected") {
    console.error("Playlist ads-meta autosave failed", metaResult.reason);
    throw metaResult.reason instanceof Error
      ? metaResult.reason
      : new Error(String(metaResult.reason));
  }
}

export default function AdsPage() {
  const queryClient = useQueryClient();
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
  const [visibleRowLimit, setVisibleRowLimit] = useState(120);
  const [rowPage, setRowPage] = useState(1);
  const [showAllRows, setShowAllRows] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Record<string, boolean>>({});
  const [hiddenMode, setHiddenMode] = useState<"visible" | "hidden" | "all">("visible");
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<
    number | null
  >(null);
  const [rowData, setRowData] = useState<Record<string, RowMeta>>({});
  const [undoStack, setUndoStack] = useState<Record<string, RowMeta>[]>([]);
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
  const [hasMounted, setHasMounted] = useState(false);
  const [accountsFilterOpen, setAccountsFilterOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const accountsQuery = useQuery<AccountRow[]>({
    queryKey: ["accounts"],
    queryFn: getAccounts,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS;

  useEffect(() => {
    if (!activeAccountId && accounts.length > 0)
      setActiveAccountId(ALL_ACCOUNTS_ID);
  }, [activeAccountId, accounts, setActiveAccountId]);

  useEffect(() => {
    const nextCountry = new URLSearchParams(window.location.search)
      .get("country")
      ?.trim();

    if (!nextCountry) return;

    setFilters((current) => {
      if (current.country === nextCountry) return current;
      return { ...current, country: nextCountry };
    });
    setHiddenMode("visible");
    setRowPage(1);
    setShowAllRows(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    try {
      const savedData = window.localStorage.getItem(ADS_DATA_STORAGE_KEY);
      const savedCategories = window.localStorage.getItem(
        ADS_CATEGORY_OPTIONS_STORAGE_KEY,
      );
      const savedGenres = window.localStorage.getItem(
        ADS_GENRE_OPTIONS_STORAGE_KEY,
      );
      if (savedData) setRowData(JSON.parse(savedData));
      const savedHiddenRows = window.localStorage.getItem(ADS_HIDDEN_ROWS_STORAGE_KEY);
      if (savedHiddenRows) setHiddenRows(JSON.parse(savedHiddenRows));
      setCategoryOptions(
        mergeDropdownOptions(
          defaultCategoryOptions,
          savedCategories ? JSON.parse(savedCategories) : [],
        ),
      );
      setGenreOptions(
        mergeDropdownOptions(
          defaultGenreOptions,
          savedGenres ? JSON.parse(savedGenres) : [],
        ),
      );
    } catch {
      setRowData({});
      setCategoryOptions(defaultCategoryOptions);
      setGenreOptions(defaultGenreOptions);
    }

    fetchAdsFilterOptionsFromDatabase().then((items) => {
      if (cancelled) return;

      const savedCategories = items
        .filter((item) => item.option_type === "category")
        .map((item) => String(item.value || "").trim())
        .filter(Boolean);
      const savedGenres = items
        .filter((item) => item.option_type === "genre")
        .map((item) => String(item.value || "").trim())
        .filter(Boolean);

      setCategoryOptions((current) => {
        const next = mergeDropdownOptions(defaultCategoryOptions, [
          ...current,
          ...savedCategories,
        ]);
        window.localStorage.setItem(
          ADS_CATEGORY_OPTIONS_STORAGE_KEY,
          JSON.stringify(next),
        );
        return next;
      });

      setGenreOptions((current) => {
        const next = mergeDropdownOptions(defaultGenreOptions, [
          ...current,
          ...savedGenres,
        ]);
        window.localStorage.setItem(
          ADS_GENRE_OPTIONS_STORAGE_KEY,
          JSON.stringify(next),
        );
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const singleAccountQuery = useQuery({
    queryKey: ["ads-playlists", activeAccountId],
    queryFn: () => fetchPlaylistsWithHistory(activeAccountId as number),
    enabled: !!activeAccountId && activeAccountId !== ALL_ACCOUNTS_ID,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const allAccountQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ["ads-playlists", account.id],
      queryFn: () => fetchPlaylistsWithHistory(account.id),
      enabled: activeAccountId === ALL_ACCOUNTS_ID,
      staleTime: 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    })),
  });

  const playlistManagerStateQuery = useQuery({
    queryKey: ["playlist-manager-state-for-ads"],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/playlist-manager-state?user_key=global`,
        { cache: "no-store" },
      );

      if (!response.ok) return null;

      const payload = await response.json();
      return payload?.state ?? null;
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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

  // `playlists` above is rebuilt (new array reference) on effectively every
  // render because `allAccountQueries` (from useQueries) isn't referentially
  // stable. Effects and memos that only care about *which* playlists are
  // loaded — not the array identity — should key off this instead, or they
  // will re-run (and re-fetch) on every render.
  const playlistsSyncKey = useMemo(
    () => playlists.map((playlist) => playlistKey(playlist)).join("|"),
    [playlists],
  );

  useEffect(() => {
    if (playlists.length === 0) return;

    let cancelled = false;

    async function loadSavedAdsSettings() {
      const rows = await fetchAdsSettingsFromDatabase();
      if (cancelled || rows.length === 0) return;

      setRowData((current) => {
        const next = { ...current };
        const rowsByPlaylistId = new Map(
          rows
            .filter((row) => row.playlist_id || row.spotify_id)
            .map((row) => [String(row.playlist_id || row.spotify_id), row]),
        );

        playlists.forEach((playlist) => {
          const key = playlistKey(playlist);
          const possibleIds = [
            String(playlist.id),
            String(playlist.spotify_id || ""),
            String(playlist.spotify_playlist_id || ""),
            getPlaylistId(playlist),
          ].filter(Boolean);
          const savedRow = possibleIds
            .map((id) => rowsByPlaylistId.get(id))
            .find(Boolean);

          const savedFromPlaylist = getDefaultRowData(playlist);
          const savedFromSettings = savedRow
            ? rowMetaFromSettingsRow(savedRow)
            : null;
          const savedMeta = savedFromSettings
            ? preferSavedMeta(savedFromPlaylist, savedFromSettings)
            : savedFromPlaylist;

          next[key] = preferSavedMeta(next[key], savedMeta);
        });

        window.localStorage.setItem(ADS_DATA_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }

    loadSavedAdsSettings();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistsSyncKey]);

  const playlistManagerSyncMap = useMemo(() => {
    const state = playlistManagerStateQuery.data as Record<string, unknown> | null | undefined;

    const map = new Map<string, string>();

    const collectSyncedItems = (value: unknown): Array<Record<string, unknown>> => {
      if (!value) return [];

      if (Array.isArray(value)) {
        return value.flatMap((item) => collectSyncedItems(item));
      }

      if (typeof value !== "object") return [];

      const record = value as Record<string, unknown>;
      const hasSyncDate = Boolean(
        record.lastSyncedAt ??
          record.last_synced_at ??
          record.syncedAt ??
          record.synced_at ??
          record.lastSynced ??
          record.last_synced,
      );

      const hasPlaylistId = Boolean(
        record.playlistId ??
          record.playlist_id ??
          record.spotify_id ??
          record.spotify_playlist_id ??
          record.id,
      );

      const nested = Object.values(record).flatMap((item) =>
        Array.isArray(item) || (item && typeof item === "object")
          ? collectSyncedItems(item)
          : [],
      );

      return hasSyncDate && hasPlaylistId ? [record, ...nested] : nested;
    };

    for (const item of collectSyncedItems(state)) {
      const lastSyncedAt =
        (item.lastSyncedAt as string | undefined) ??
        (item.last_synced_at as string | undefined) ??
        (item.syncedAt as string | undefined) ??
        (item.synced_at as string | undefined) ??
        (item.lastSynced as string | undefined) ??
        (item.last_synced as string | undefined) ??
        null;

      if (!lastSyncedAt) continue;

      const accountId = item.accountId ?? item.account_id;
      const playlistId =
        item.playlistId ??
        item.playlist_id ??
        item.spotify_id ??
        item.spotify_playlist_id ??
        item.id;

      if (accountId && playlistId) {
        map.set(`${accountId}-${playlistId}`, lastSyncedAt);
      }

      if (playlistId) {
        map.set(String(playlistId), lastSyncedAt);
      }
    }

    return map;
  }, [playlistManagerStateQuery.data]);

  const getPlaylistManagerLastSynced = (playlist: PlaylistRow) => {
    const possibleKeys = [
      `${playlist.account_id ?? ""}-${playlist.id}`,
      `${playlist.account_id ?? ""}-${playlist.spotify_id ?? ""}`,
      `${playlist.account_id ?? ""}-${playlist.spotify_playlist_id ?? ""}`,
      String(playlist.id ?? ""),
      String(playlist.spotify_id ?? ""),
      String(playlist.spotify_playlist_id ?? ""),
    ].filter((item) => item && item !== "-");

    for (const key of possibleKeys) {
      const value = playlistManagerSyncMap.get(key);
      if (value) return value;
    }

    return getLastSyncedAt(playlist);
  };

  const hasPlaylistRows = playlists.length > 0;
  const isAnyPlaylistQueryLoading =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountQueries.some((query) => query.isLoading)
      : singleAccountQuery.isLoading;
  const isAnyPlaylistQueryFetching =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountQueries.some((query) => query.isFetching)
      : singleAccountQuery.isFetching;
  const isLoading = isAnyPlaylistQueryLoading && !hasPlaylistRows;
  const isUpdatingPlaylistStats = isAnyPlaylistQueryFetching && hasPlaylistRows;
  const isError =
    activeAccountId === ALL_ACCOUNTS_ID
      ? allAccountQueries.every((query) => query.isError)
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
    ads: Array.isArray(playlist.ads_meta?.ads)
      ? playlist.ads_meta?.ads || []
      : [],
  });

  const getRowData = (playlist: PlaylistRow) =>
    rowData[playlistKey(playlist)] ?? getDefaultRowData(playlist);

  const persistRowData = (nextData: Record<string, RowMeta>) => {
    setUndoStack((current) => [rowData, ...current].slice(0, 20));
    setRowData(nextData);
    window.localStorage.setItem(ADS_DATA_STORAGE_KEY, JSON.stringify(nextData));
  };

  const undoLastChange = () => {
    setUndoStack((current) => {
      const [previous, ...rest] = current;
      if (!previous) return current;

      const beforeUndo = rowData;

      setRowData(previous);
      window.localStorage.setItem(ADS_DATA_STORAGE_KEY, JSON.stringify(previous));
      setSelectedAds({});
      setLastSelectedAdKey(null);
      setSelectedRows({});
      setLastSelectedRowIndex(null);

      // Every other edit in this file (add/edit/delete ad date, color, etc.)
      // writes through to the backend via saveAdsMetaToDatabase in addition
      // to updating local state. Undo has to do the same for whichever rows
      // actually changed, or the reverted value only lives in this browser
      // tab/localStorage — the next sync from the DB (or a reload) brings
      // the un-undone value right back.
      const changedKeys = new Set([
        ...Object.keys(beforeUndo),
        ...Object.keys(previous),
      ]);

      changedKeys.forEach((key) => {
        if (
          JSON.stringify(beforeUndo[key]) === JSON.stringify(previous[key])
        ) {
          return;
        }

        const playlist = playlists.find((p) => playlistKey(p) === key);
        if (!playlist) return;

        const revertedMeta = previous[key] ?? getDefaultRowData(playlist);
        saveAdsMetaToDatabase(playlist.id, revertedMeta, playlist.name);
      });

      return rest;
    });
  };

  const savePlaylistManagerState = async (nextState: Record<string, unknown>) => {
    persistPlaylistManagerStateLocally(nextState);

    // Backend contract (app/api/routes/playlist_manager_state.py):
    //   POST /api/playlist-manager-state
    //   body: { user_key: string, state: dict }
    // No query params, no PUT/PATCH support, no "state_json" field.
    const response = await fetch(`${API_BASE_URL}/api/playlist-manager-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_key: "global", state: nextState }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      // eslint-disable-next-line no-console
      console.error("[PlaylistManager save] failed", response.status, responseText);
      throw new Error(responseText || `Playlist manager save failed (${response.status})`);
    }

    return true;
  };


  // Playlist Manager's real state shape (from its own page.tsx) is:
  //   savedMasterPlaylists: { id, playlistId, accountId, name, imageUrl, tracks, createdAt }[]
  //   syncedPlaylists: { id, masterPlaylistId, playlistId, accountId, name, imageUrl,
  //                       spotifyUrl, spotifyId, checked, lastSyncedAt }[]
  // A synced (child) playlist is linked to its master via masterPlaylistId matching
  // a savedMasterPlaylists entry's id — that link was completely missing before,
  // which is why changing Master here was saving/re-touching a playlist that
  // happened to share the master's name instead of linking the actual child row.
  const findOrCreateMasterPlaylistEntry = (
    currentState: Record<string, unknown>,
    masterName: string,
  ) => {
    const nameKey = masterName.trim().toLowerCase();
    const list = Array.isArray(currentState.savedMasterPlaylists)
      ? [...(currentState.savedMasterPlaylists as Record<string, unknown>[])]
      : [];

    const existing = list.find(
      (item) => String(item?.name || "").trim().toLowerCase() === nameKey,
    );

    if (existing) {
      return { id: String(existing.id), list };
    }

    // Seed metadata from a real playlist sharing this name, if one exists —
    // otherwise this is a brand new master group with no linked playlist yet.
    const matchedPlaylist = playlists.find(
      (playlist) => playlist.name.trim().toLowerCase() === nameKey,
    ) as PlaylistRow | undefined;

    const newId = `master-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newEntry: Record<string, unknown> = {
      id: newId,
      playlistId: matchedPlaylist?.id ?? 0,
      accountId: matchedPlaylist?.account_id ?? 0,
      name: masterName.trim(),
      imageUrl: matchedPlaylist?.image_url ?? null,
      tracks: matchedPlaylist ? getTrackCount(matchedPlaylist) : undefined,
      createdAt: new Date().toISOString(),
    };

    return { id: newId, list: [...list, newEntry] };
  };

  // One-time catch-up for Master values that were set via the dropdown
  // before ensureMasterPlaylistInManager actually linked things correctly.
  // Does everything in-memory against a single fetched state and writes
  // once at the end, instead of looping the per-playlist save (which would
  // mean two network round trips per playlist and risk the same rate
  // limiting we hit with Sync All / bulk Ad Dates).
  const backfillAllMasterPlaylistsToManager = async () => {
    if (activeAccountId !== ALL_ACCOUNTS_ID) {
      alert(
        "Switch the account filter to \"All Accounts\" first, so this can see every playlist across every account before backfilling.",
      );
      return;
    }

    const confirmed = window.confirm(
      "This scans every playlist's currently-saved Master value and links it " +
        "in Playlist Manager. Existing links are left as-is; only playlists " +
        "with a Master that isn't linked yet are added. Continue?",
    );
    if (!confirmed) return;

    const currentState =
      ((playlistManagerStateQuery.data as Record<string, unknown> | null | undefined) ?? {}) || {};

    let workingSavedMasterPlaylists = Array.isArray(currentState.savedMasterPlaylists)
      ? [...(currentState.savedMasterPlaylists as Record<string, unknown>[])]
      : [];
    let workingSyncedPlaylists = Array.isArray(currentState.syncedPlaylists)
      ? [...(currentState.syncedPlaylists as Record<string, unknown>[])]
      : [];

    let linkedCount = 0;
    let createdMasterCount = 0;

    for (const playlist of playlists) {
      const key = playlistKey(playlist);
      const masterName = String(rowData[key]?.master || "").trim();
      if (!masterName) continue;

      const nameKey = masterName.toLowerCase();
      let masterEntry = workingSavedMasterPlaylists.find(
        (item) => String(item?.name || "").trim().toLowerCase() === nameKey,
      );

      if (!masterEntry) {
        const matchedMasterPlaylist = playlists.find(
          (p) => p.name.trim().toLowerCase() === nameKey,
        );
        masterEntry = {
          id: `master-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          playlistId: matchedMasterPlaylist?.id ?? 0,
          accountId: matchedMasterPlaylist?.account_id ?? 0,
          name: masterName,
          imageUrl: matchedMasterPlaylist?.image_url ?? null,
          tracks: matchedMasterPlaylist ? getTrackCount(matchedMasterPlaylist) : undefined,
          createdAt: new Date().toISOString(),
        };
        workingSavedMasterPlaylists = [...workingSavedMasterPlaylists, masterEntry];
        createdMasterCount += 1;
      }

      const childAccountId = playlist.account_id ?? 0;
      const existingIndex = workingSyncedPlaylists.findIndex(
        (item) =>
          Number(item?.playlistId) === Number(playlist.id) &&
          Number(item?.accountId) === Number(childAccountId),
      );

      // Already linked to this exact master — nothing to do for this row.
      if (existingIndex >= 0 && workingSyncedPlaylists[existingIndex].masterPlaylistId === masterEntry.id) {
        continue;
      }

      const childSpotifyId = playlist.spotify_id || playlist.spotify_playlist_id || null;
      const childSpotifyUrl =
        playlist.playlist_url || playlist.spotify_url || playlist.external_url || null;
      const childLastSynced = getPlaylistManagerLastSynced(playlist) || new Date().toISOString();

      const nextSyncedItem: Record<string, unknown> = {
        id:
          existingIndex >= 0
            ? workingSyncedPlaylists[existingIndex].id
            : `synced-${playlist.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        masterPlaylistId: masterEntry.id,
        playlistId: playlist.id,
        accountId: childAccountId,
        name: playlist.name,
        imageUrl: playlist.image_url ?? null,
        spotifyUrl: childSpotifyUrl,
        spotifyId: childSpotifyId,
        checked: existingIndex >= 0 ? (workingSyncedPlaylists[existingIndex].checked ?? true) : true,
        lastSyncedAt: childLastSynced,
      };

      workingSyncedPlaylists =
        existingIndex >= 0
          ? workingSyncedPlaylists.map((item, index) => (index === existingIndex ? nextSyncedItem : item))
          : [...workingSyncedPlaylists, nextSyncedItem];

      linkedCount += 1;
    }

    if (linkedCount === 0) {
      alert("Nothing to backfill — every playlist with a Master set is already linked.");
      return;
    }

    const nextState = {
      ...currentState,
      savedMasterPlaylists: workingSavedMasterPlaylists,
      syncedPlaylists: workingSyncedPlaylists,
    };

    try {
      await savePlaylistManagerState(nextState);
      await playlistManagerStateQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["playlist-manager-state-for-ads"] });
      alert(
        `Backfill complete: ${linkedCount} playlist(s) linked, ${createdMasterCount} new master group(s) created.`,
      );
    } catch (error) {
      console.error("Backfill failed", error);
      alert(
        "Backfill failed to save: " + (error instanceof Error ? error.message : String(error)),
      );
    }
  };

  const ensureMasterPlaylistInManager = async (masterName: string, childPlaylist: PlaylistRow) => {
    const selectedName = masterName.trim();
    if (!selectedName) return;

    const currentState =
      ((playlistManagerStateQuery.data as Record<string, unknown> | null | undefined) ?? {}) || {};

    const { id: masterId, list: nextSavedMasterPlaylists } = findOrCreateMasterPlaylistEntry(
      currentState,
      selectedName,
    );

    const childAccountId = childPlaylist.account_id ?? 0;
    const existingSynced = Array.isArray(currentState.syncedPlaylists)
      ? [...(currentState.syncedPlaylists as Record<string, unknown>[])]
      : [];

    const existingIndex = existingSynced.findIndex(
      (item) =>
        Number(item?.playlistId) === Number(childPlaylist.id) &&
        Number(item?.accountId) === Number(childAccountId),
    );

    const childSpotifyId =
      childPlaylist.spotify_id || childPlaylist.spotify_playlist_id || null;
    const childSpotifyUrl =
      childPlaylist.playlist_url ||
      childPlaylist.spotify_url ||
      childPlaylist.external_url ||
      null;
    const childLastSynced = getPlaylistManagerLastSynced(childPlaylist) || new Date().toISOString();

    const nextSyncedItem: Record<string, unknown> = {
      id:
        existingIndex >= 0
          ? existingSynced[existingIndex].id
          : `synced-${childPlaylist.id}-${Date.now()}`,
      masterPlaylistId: masterId,
      playlistId: childPlaylist.id,
      accountId: childAccountId,
      name: childPlaylist.name,
      imageUrl: childPlaylist.image_url ?? null,
      spotifyUrl: childSpotifyUrl,
      spotifyId: childSpotifyId,
      checked: existingIndex >= 0 ? (existingSynced[existingIndex].checked ?? true) : true,
      lastSyncedAt: childLastSynced,
    };

    const nextSyncedPlaylists =
      existingIndex >= 0
        ? existingSynced.map((item, index) => (index === existingIndex ? nextSyncedItem : item))
        : [...existingSynced, nextSyncedItem];

    const nextState = {
      ...currentState,
      savedMasterPlaylists: nextSavedMasterPlaylists,
      syncedPlaylists: nextSyncedPlaylists,
    };

    await savePlaylistManagerState(nextState);
    await playlistManagerStateQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ["playlist-manager-state-for-ads"] });
  };

  const fetchLatestPlaylistManagerState = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/playlist-manager-state?user_key=global`,
        { cache: "no-store" },
      );

      if (!response.ok) return null;

      const payload = await response.json();
      return (payload?.state ?? null) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  };

  const removeOldMasterPlaylistFromManager = async (oldMasterName: string, childPlaylist: PlaylistRow) => {
    const oldName = oldMasterName.trim();
    if (!oldName) return;

    const latestState = await fetchLatestPlaylistManagerState();
    const currentState =
      latestState ??
      ((playlistManagerStateQuery.data as Record<string, unknown> | null | undefined) ?? {}) ??
      {};

    const nameKey = oldName.toLowerCase();
    const savedMasterPlaylists = Array.isArray(currentState.savedMasterPlaylists)
      ? (currentState.savedMasterPlaylists as Record<string, unknown>[])
      : [];
    const oldMasterEntry = savedMasterPlaylists.find(
      (item) => String(item?.name || "").trim().toLowerCase() === nameKey,
    );

    // No master group by that name exists (or it was never actually linked) —
    // nothing to unlink.
    if (!oldMasterEntry) return;

    const childAccountId = childPlaylist.account_id ?? 0;
    const existingSynced = Array.isArray(currentState.syncedPlaylists)
      ? (currentState.syncedPlaylists as Record<string, unknown>[])
      : [];

    // Only remove *this* child's link to the old master — other playlists
    // still under that master group are untouched, and the master group
    // itself is never deleted here.
    const nextSyncedPlaylists = existingSynced.filter((item) => {
      const isThisChild =
        Number(item?.playlistId) === Number(childPlaylist.id) &&
        Number(item?.accountId) === Number(childAccountId);
      const isLinkedToOldMaster = item?.masterPlaylistId === oldMasterEntry.id;
      return !(isThisChild && isLinkedToOldMaster);
    });

    const nextState = {
      ...currentState,
      syncedPlaylists: nextSyncedPlaylists,
    };

    await savePlaylistManagerState(nextState);
    await playlistManagerStateQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ["playlist-manager-state-for-ads"] });
  };

  const updateRowData = (playlist: PlaylistRow, updates: Partial<RowMeta>) => {
    const key = playlistKey(playlist);
    const previousRowData = {
      ...getDefaultRowData(playlist),
      ...rowData[key],
    };
    const previousMaster = String(previousRowData.master || "").trim();
    const nextMaster = Object.prototype.hasOwnProperty.call(updates, "master")
      ? String(updates.master || "").trim()
      : previousMaster;

    const next = {
      ...rowData,
      [key]: {
        ...previousRowData,
        ...updates,
      },
    };
    persistRowData(next);
    saveAdsSettingsToDatabase(playlist.id, playlist.name, next[key]);
    saveAdsMetaToDatabase(playlist.id, next[key], playlist.name);

    if (Object.prototype.hasOwnProperty.call(updates, "master")) {
      Promise.resolve()
        .then(async () => {
          if (nextMaster) {
            await ensureMasterPlaylistInManager(nextMaster, playlist);
          }

          if (previousMaster && previousMaster.toLowerCase() !== nextMaster.toLowerCase()) {
            await removeOldMasterPlaylistFromManager(previousMaster, playlist);
          }
        })
        .catch((error) => {
          console.error("Could not sync master playlist change to Playlist Manager", error);
        });
    }
  };

  const masterOptions = useMemo(() => {
    const state = playlistManagerStateQuery.data as Record<string, unknown> | null | undefined;

    const savedItems: Array<Record<string, unknown>> = [];
    const pushSavedArray = (value: unknown) => {
      if (Array.isArray(value)) {
        savedItems.push(...(value as Array<Record<string, unknown>>));
      }
    };

    // Only show playlists that were intentionally saved in Playlist Manager.
    // Do not include synced/imported/all playlist arrays here, otherwise the
    // Master dropdown becomes a full playlist list again.
    pushSavedArray(state?.savedPlaylists);
    pushSavedArray(state?.saved_playlists);
    pushSavedArray(state?.savedMasterPlaylists);
    pushSavedArray(state?.saved_master_playlists);
    pushSavedArray(state?.masterPlaylists);
    pushSavedArray(state?.master_playlists);

    const localSavedItems = loadPlaylistManagerItemsFromLocalStorage().filter((item) => {
      const source = String(item.source ?? item.type ?? item.kind ?? "").toLowerCase();
      return (
        source.includes("saved") ||
        source.includes("master") ||
        Boolean(item.saved) ||
        Boolean(item.isSaved) ||
        Boolean(item.is_saved)
      );
    });

    const names = [...savedItems, ...localSavedItems]
      .map(readPlaylistManagerName)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return uniqueValues(names);
  }, [playlistManagerStateQuery.data]);
  const listedCountries = useMemo(
    () =>
      uniqueValues(playlists.map((playlist) => getRowData(playlist).country)),
    [playlists, rowData],
  );

  const filtered = useMemo(() => {
    let data = playlists;

    if (hiddenMode === "visible") {
      data = data.filter((p) => !hiddenRows[playlistKey(p)]);
    } else if (hiddenMode === "hidden") {
      data = data.filter((p) => !!hiddenRows[playlistKey(p)]);
    }

    if (search) {
      const query = search.toLowerCase();
      data = data.filter((p) =>
        [
          p.name,
          getAccountName(p.account_id),
          getRowData(p).category,
          getRowData(p).genre,
          getRowData(p).country,
          getRowData(p).master,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }
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
      data = data.filter((p) => isWithinLastDays(getPlaylistManagerLastSynced(p), days));
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
          parseTimestamp(getPlaylistManagerLastSynced(a)) -
          parseTimestamp(getPlaylistManagerLastSynced(b))
        ) * dir;
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
        return (getFollowerGainSum(a, 7) - getFollowerGainSum(b, 7)) * dir;
      if (sortField === "growth30d")
        return (getFollowerGainSum(a, 30) - getFollowerGainSum(b, 30)) * dir;
      if (sortField === "country")
        return rowA.country.localeCompare(rowB.country) * dir;
      if (sortField === "adDate")
        return (getLatestAdTimestamp(rowA.ads) - getLatestAdTimestamp(rowB.ads)) * dir;
      return 0;
    });
  }, [
    playlists,
    search,
    filters,
    sortField,
    sortOrder,
    rowData,
    accounts,
    hiddenRows,
    hiddenMode,
  ]);

  const rowsPerPage = 120;
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  useEffect(() => {
    setVisibleRowLimit(rowsPerPage);
    setRowPage(1);
    setShowAllRows(false);
  }, [search, filters, sortField, sortOrder, activeAccountId, hiddenMode]);

  useEffect(() => {
    setRowPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const visibleRows = useMemo(() => {
    if (showAllRows) return filtered;
    const start = (rowPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, rowPage, showAllRows]);

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
    Math.max(0, ...visibleRows.map((p) => getRowData(p).ads.length)),
    12,
  );
  const adColumnCount = Math.max(maxAdColumns, 1);

  const visibleAdItems = useMemo(() => {
    const items: Array<{
      key: string;
      playlist: PlaylistRow;
      adIndex: number;
    }> = [];
    visibleRows.forEach((playlist) => {
      const rowKey = playlistKey(playlist);
      getRowData(playlist).ads.forEach((_, adIndex) => {
        items.push({ key: `${rowKey}::${adIndex}`, playlist, adIndex });
      });
    });
    return items;
  }, [visibleRows, rowData]);

  const gridTemplate = `46px 42px 42px 230px 92px 64px 48px 48px 124px 124px 92px 132px 46px 64px 88px 48px 44px 44px 44px 44px 46px 68px ${Array.from(
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
    const shouldSelect = !allFilteredSelected;
    const next = { ...selectedRows };

    filtered.forEach((playlist) => {
      next[playlistKey(playlist)] = shouldSelect;
    });

    if (shouldSelect && filtered.length > 0) {
      setSelectedAdColor(getRowData(filtered[0]).color || "gray");
    }

    setSelectedRows(next);
    setLastSelectedRowIndex(null);
  };

  const handleRowCheckboxClick = (
    playlist: PlaylistRow,
    index: number,
    event: MouseEvent<HTMLInputElement>,
  ) => {
    const key = playlistKey(playlist);
    const isCurrentlySelected = !!selectedRows[key];

    if (event.shiftKey && lastSelectedRowIndex !== null) {
      const start = Math.min(lastSelectedRowIndex, index);
      const end = Math.max(lastSelectedRowIndex, index);
      const shouldSelect = !isCurrentlySelected;
      const next = { ...selectedRows };

      filtered.slice(start, end + 1).forEach((row) => {
        next[playlistKey(row)] = shouldSelect;
      });

      if (shouldSelect && selectedRowKeys.length === 0) {
        setSelectedAdColor(getRowData(playlist).color || "gray");
      }

      setSelectedRows(next);
      return;
    }

    if (!isCurrentlySelected && selectedRowKeys.length === 0) {
      setSelectedAdColor(getRowData(playlist).color || "gray");
    }

    setSelectedRows((prev) => ({ ...prev, [key]: !prev[key] }));
    setLastSelectedRowIndex(index);
  };

  const persistHiddenRows = (nextHiddenRows: Record<string, boolean>) => {
    setHiddenRows(nextHiddenRows);
    window.localStorage.setItem(
      ADS_HIDDEN_ROWS_STORAGE_KEY,
      JSON.stringify(nextHiddenRows),
    );
  };

  const hideSelectedRows = () => {
    if (!hasSelectedRows) return;
    const next = { ...hiddenRows };
    selectedRowKeys.forEach((key) => {
      next[key] = true;
    });
    persistHiddenRows(next);
    setSelectedRows({});
    setLastSelectedRowIndex(null);
  };

  const unhideSelectedRows = () => {
    if (!hasSelectedRows) return;
    const next = { ...hiddenRows };
    selectedRowKeys.forEach((key) => {
      delete next[key];
    });
    persistHiddenRows(next);
    setSelectedRows({});
    setLastSelectedRowIndex(null);
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
      saveAdsMetaToDatabase(playlist.id, next[key], playlist.name);
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

  const saveAdDate = async () => {
  if (!modalDate) return;

  const next = { ...rowData };

  if (bulkAdModalOpen) {
    const targets: { playlist: PlaylistRow; key: string }[] = [];

    filtered.forEach((playlist) => {
      const key = playlistKey(playlist);
      if (!selectedRows[key]) return;

      const current = {
        ...getDefaultRowData(playlist),
        ...next[key],
      };

      next[key] = {
        ...current,
        ads: [
          {
            date: modalDate,
            color: modalColor,
            stroke: modalStroke,
          },
          ...current.ads,
        ].slice(0, 12),
      };

      targets.push({ playlist, key });
    });

    persistRowData(next);

    // Save one at a time rather than firing every request at once — the
    // backend rate-limits bursts of simultaneous requests (visible as 429s
    // in the network tab), and since fetch() doesn't reject on an HTTP
    // error status, those rate-limited saves were previously indistinguishable
    // from successful ones. Going sequential avoids triggering the limit in
    // the first place.
    const failedPlaylists: string[] = [];
    for (const { playlist, key } of targets) {
      try {
        await saveAdsMetaToDatabase(playlist.id, next[key], playlist.name);
      } catch (error) {
        console.error(`Failed to save ad date for "${playlist.name}"`, error);
        failedPlaylists.push(playlist.name);
      }
    }

    closeAdModal();
    setSelectedRows({});

    if (failedPlaylists.length > 0) {
      alert(
        `Ad date saved, but ${failedPlaylists.length} playlist(s) failed to save to the server — you may need to try them again:\n\n${failedPlaylists.join("\n")}`,
      );
    }

    return;
  }

  if (!adModalKey) return;

  const playlist = playlists.find(
    (p) => playlistKey(p) === adModalKey
  );

  if (!playlist) return;

  const current = {
    ...getDefaultRowData(playlist),
    ...next[adModalKey],
  };

  const nextAds = [...current.ads];

  if (modalAdIndex !== null) {
    nextAds[modalAdIndex] = {
      date: modalDate,
      color: modalColor,
      stroke: modalStroke,
    };
  } else {
    nextAds.unshift({
      date: modalDate,
      color: modalColor,
      stroke: modalStroke,
    });
  }

  next[adModalKey] = {
    ...current,
    ads: nextAds.slice(0, 12),
  };

  persistRowData(next);

  await saveAdsMetaToDatabase(
    playlist.id,
    next[adModalKey],
    playlist.name
  );

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
    event: MouseEvent<HTMLButtonElement>,
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
        saveAdsMetaToDatabase(playlist.id, next[key], playlist.name);
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
        saveAdsMetaToDatabase(playlist.id, next[key], playlist.name);
      }
    });

    persistRowData(next);
    setSelectedAds({});
    setLastSelectedAdKey(null);
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
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z"
      ) {
        const target = event.target as HTMLElement | null;
        const isTextInput =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);

        // Let native undo happen inside text fields; only hijack Ctrl/Cmd+Z
        // for the table when focus isn't in an editable field.
        if (!isTextInput && undoStack.length > 0) {
          event.preventDefault();
          undoLastChange();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAdKeys, filtered, rowData, undoStack, playlists]);

  // Clicking anywhere outside an ad-date pill / row checkbox / the
  // selection toolbar clears whichever selection is active. Elements that
  // need to manage the selection themselves (the pills, the checkboxes,
  // the toolbar buttons) are marked with data-ad-pill / data-row-checkbox /
  // data-selection-toolbar so this doesn't fight with their own handlers.
  // Anything inside an open modal already stops this event from bubbling
  // (see the modal's onMouseDown={(e) => e.stopPropagation()}), so
  // interacting with a modal never wipes a selection it still needs.
  useEffect(() => {
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const isInsideSelectable = target?.closest(
        '[data-ad-pill="true"], [data-row-checkbox="true"], [data-selection-toolbar="true"]',
      );
      if (isInsideSelectable) return;

      setSelectedAds((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setLastSelectedAdKey(null);
      setSelectedRows((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setLastSelectedRowIndex(null);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const openOptionModal = (type: "category" | "genre") => {
    setOptionModalType(type);
    setNewOptionName("");
  };

  const closeOptionModal = () => {
    setOptionModalType(null);
    setNewOptionName("");
  };

  const saveOptions = (type: "category" | "genre", nextOptions: string[]) => {
    const normalized = mergeDropdownOptions(
      type === "category" ? defaultCategoryOptions : defaultGenreOptions,
      nextOptions,
    );

    if (type === "category") {
      setCategoryOptions(normalized);
      window.localStorage.setItem(
        ADS_CATEGORY_OPTIONS_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } else {
      setGenreOptions(normalized);
      window.localStorage.setItem(
        ADS_GENRE_OPTIONS_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    }
  };

  const addDropdownOption = () => {
    if (!optionModalType) return;
    const cleaned = newOptionName.trim();
    if (!cleaned) return;
    const currentOptions =
      optionModalType === "category" ? categoryOptions : genreOptions;
    const exists = currentOptions.some(
      (item) => item.toLowerCase() === cleaned.toLowerCase(),
    );

    if (!exists) {
      saveOptions(optionModalType, [...currentOptions, cleaned]);
      void saveAdsFilterOptionToDatabase(optionModalType, cleaned);
    }

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
    void deleteAdsFilterOptionFromDatabase(optionModalType, option);
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
    setHiddenMode("visible");
    setRowPage(1);
    setShowAllRows(false);
  };

  const downloadCSV = () => {
    const headers = [
      "URL",
      "ID",
      "Title",
      "Account",
      "Saves",
      "7D",
      "30D",
      "Category",
      "Genre",
      "Country",
      "Master",
      "Ads",
      "Tracks",
      "Last Synced",
      formatDayMonth(0),
      formatDayMonth(1),
      formatDayMonth(2),
      formatDayMonth(3),
      formatDayMonth(4),
      "Ad Dates",
    ];
    const rows = filtered.map((playlist) => {
      const data = getRowData(playlist);
      return [
        getPlaylistUrl(playlist),
        getPlaylistId(playlist),
        playlist.name,
        getAccountName(playlist.account_id),
        playlist.followers ?? 0,
        getFollowerGainSum(playlist, 7),
        getFollowerGainSum(playlist, 30),
        data.category,
        data.genre,
        data.country,
        data.master,
        data.ads.length,
        getTrackCount(playlist),
        formatDate(getPlaylistManagerLastSynced(playlist)),
        getTodayValue(playlist, 0),
        getTodayValue(playlist, 1),
        getTodayValue(playlist, 2),
        getTodayValue(playlist, 3),
        getTodayValue(playlist, 4),
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
            value === "" || value === "All"
              ? "all"
              : value === "Today"
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

  if (!hasMounted) {
    return (
      <div className="min-h-screen w-full bg-black px-5 py-5 text-white lg:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Playlists</h1>
        <p className="mt-1 text-sm text-zinc-500">Track ad dates and monitor playlist growth over time.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 overflow-hidden bg-black px-5 py-5 text-white lg:px-6">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Playlists</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track ad dates and monitor playlist growth over time.
          </p>
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
          data-selection-toolbar="true"
        >
          {hasSelectedRows ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedRows({});
                  setLastSelectedRowIndex(null);
                }}
                className="h-10 rounded-xl border border-zinc-700 bg-black px-4 text-sm font-semibold text-white hover:border-green-500 hover:text-green-400"
              >
                Deselect ({selectedRowKeys.length})
              </button>
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
                    {getColorNameLabel(color.value)}
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
              <button
                type="button"
                onClick={hideSelectedRows}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:border-red-500 hover:text-red-400"
                title="Hide selected playlists"
                aria-label="Hide selected playlists"
              >
                <EyeOffIcon />
              </button>
              <button
                type="button"
                onClick={unhideSelectedRows}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 hover:border-green-500 hover:text-green-400"
                title="Unhide selected playlists"
                aria-label="Unhide selected playlists"
              >
                <EyeIcon />
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
          <button
            type="button"
            onClick={undoLastChange}
            disabled={undoStack.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:text-zinc-300"
            title="Undo last ads table edit"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={backfillAllMasterPlaylistsToManager}
            className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300 hover:border-green-500 hover:text-green-400"
            title="Link every playlist's already-saved Master value into Playlist Manager (one-time catch-up)"
          >
            Backfill Masters
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlist..."
            className="h-11 w-[260px] rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
          />


          <div className="group relative">
            <button
              type="button"
              className="h-11 rounded-xl border border-zinc-800 bg-black px-4 text-xs font-semibold text-white hover:border-green-500"
            >
              Filter
            </button>
            <div className="invisible absolute right-0 top-full z-[9999] w-52 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
                <div className="mb-2 border-b border-zinc-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setAccountsFilterOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Accounts
                      </span>
                      <span className="truncate text-xs font-semibold text-green-400">
                        {activeAccountId === ALL_ACCOUNTS_ID
                          ? "All Accounts"
                          : accounts.find((account) => account.id === activeAccountId)
                              ?.display_name ||
                            accounts.find((account) => account.id === activeAccountId)
                              ?.name ||
                            "All Accounts"}
                      </span>
                    </span>
                    <span className="shrink-0 text-zinc-500">
                      {accountsFilterOpen ? "−" : "+"}
                    </span>
                  </button>

                  {accountsFilterOpen ? (
                    <div className="ads-green-scrollbar mt-1 max-h-48 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAccountId(ALL_ACCOUNTS_ID);
                          setAccountsFilterOpen(false);
                        }}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                          activeAccountId === ALL_ACCOUNTS_ID
                            ? "bg-green-500/10 font-bold text-green-400"
                            : "text-zinc-300"
                        } hover:bg-zinc-900 hover:text-white`}
                      >
                        All Accounts
                      </button>
                      {accounts.map((account) => (
                        <button
                          key={`filter-account-${account.id}`}
                          type="button"
                          onClick={() => {
                            setActiveAccountId(account.id);
                            setAccountsFilterOpen(false);
                          }}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                            activeAccountId === account.id
                              ? "bg-green-500/10 font-bold text-green-400"
                              : "text-zinc-300"
                          } hover:bg-zinc-900 hover:text-white`}
                        >
                          {account.display_name || account.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mb-2 border-b border-zinc-800 pb-2">
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Rows</p>
                  {[
                    { label: "Visible Rows", value: "visible" as const },
                    { label: `Hidden Rows (${Object.keys(hiddenRows).length})`, value: "hidden" as const },
                    { label: "All Rows", value: "all" as const },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setHiddenMode(option.value)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${hiddenMode === option.value ? "bg-green-500/10 font-bold text-green-400" : "text-zinc-300"} hover:bg-zinc-900 hover:text-white`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {filterGroups.map((group) => (
                  <div
                    key={group.label}
                    className={`group/item relative rounded-lg px-3 py-2 text-sm ${group.value && group.value !== "all" ? "bg-green-500/10 font-bold text-green-400" : "text-zinc-300"} hover:bg-zinc-900 hover:text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{group.label}</span>
                      <span>›</span>
                    </div>
                    <div className="invisible absolute right-full top-0 z-[10000] w-[232px] pr-2 opacity-0 group-hover/item:visible group-hover/item:opacity-100">
                      <div className="ads-green-scrollbar max-h-72 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
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
                            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${group.value === option ? "bg-green-500/10 font-bold text-green-400" : "text-zinc-200"} hover:bg-zinc-900`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
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

          <div className="flex w-full basis-full justify-end pr-1">
            <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-500">
              <button
                type="button"
                onClick={() => { setShowAllRows(false); setRowPage((current) => Math.max(1, current - 1)); }}
                disabled={showAllRows || rowPage <= 1}
                className="rounded-md border border-zinc-800 px-2 py-1 hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ←
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                const page = index + 1;
                return (
                  <button
                    key={`ads-page-${page}`}
                    type="button"
                    onClick={() => { setShowAllRows(false); setRowPage(page); }}
                    className={`rounded-md border px-2 py-1 ${!showAllRows && rowPage === page ? "border-green-500 bg-green-500/10 font-bold text-green-400" : "border-zinc-800 text-zinc-500 hover:border-green-500 hover:text-green-400"}`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setShowAllRows(false); setRowPage((current) => Math.min(totalPages, current + 1)); }}
                disabled={showAllRows || rowPage >= totalPages}
                className="rounded-md border border-zinc-800 px-2 py-1 hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => setShowAllRows(true)}
                className={`rounded-md border px-2 py-1 ${showAllRows ? "border-green-500 bg-green-500/10 font-bold text-green-400" : "border-zinc-800 text-zinc-500 hover:border-green-500 hover:text-green-400"}`}
              >
                All
              </button>
              <span className="ml-1 whitespace-nowrap">
                {showAllRows ? filtered.length : `${Math.min(filtered.length, (rowPage - 1) * rowsPerPage + 1)}-${Math.min(filtered.length, rowPage * rowsPerPage)}`} / {filtered.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <div className="h-[calc(100vh-155px)] w-full max-w-full overflow-auto overscroll-contain pb-3 [scrollbar-color:#22c55e_#18181b] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-corner]:bg-zinc-950 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-500">
          <div className="min-w-max">
            <div
              className="sticky top-0 z-10 grid min-h-[50px] items-center border-b border-zinc-800 bg-zinc-950/95 backdrop-blur"
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
                  data-row-checkbox="true"
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
              <div
                className={headerClass("account")}
                onClick={() => toggleSort("account")}
              >
                Account {arrowFor("account")}
              </div>
              <div
                className={headerClass("followers")}
                onClick={() => toggleSort("followers")}
              >
                Saves {arrowFor("followers")}
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
                className={headerClass("country")}
                onClick={() => toggleSort("country")}
              >
                Country {arrowFor("country")}
              </div>
              <div className="px-1 py-3 text-[10px] font-semibold uppercase text-zinc-400">
                Master
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
              <div className="px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                URL
              </div>
              <div
                className={`${headerClass("adDate")} text-center`}
                onClick={() => toggleSort("adDate")}
              >
                Ad Date {arrowFor("adDate")}
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
                {isUpdatingPlaylistStats ? (
                  <div className="border-b border-zinc-900 px-5 py-3 text-xs text-zinc-400">
                    Updating playlist stats...
                  </div>
                ) : null}
                {visibleRows.map((playlist, rowIndex) => {
                  const key = playlistKey(playlist);
                  const data = getRowData(playlist);
                  const titleColor = getColorOption(data.color).textClass;
                  return (
                    <div
                      key={key}
                      className="grid min-h-[46px] items-center border-b border-zinc-900 py-2 text-xs text-zinc-200 hover:bg-zinc-900/40"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="flex items-center justify-center px-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              getPlaylistUrl(playlist),
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center text-zinc-300 hover:text-green-400"
                          title="Copy playlist URL"
                          aria-label="Copy playlist URL"
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
                          data-row-checkbox="true"
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
                      <div className="truncate px-2 text-zinc-400">
                        {getAccountName(playlist.account_id)}
                      </div>
                      <div className="px-2">{playlist.followers ?? 0}</div>
                      <div className="px-1">
                        <GrowthCell value={getFollowerGainSum(playlist, 7)} />
                      </div>
                      <div className="px-1">
                        <GrowthCell value={getFollowerGainSum(playlist, 30)} />
                      </div>
                      <div className="px-2">
                        <AdsSelect
                          value={data.category}
                          placeholder="Category"
                          options={categoryOptions.filter((option) => option !== "Category")}
                          onChange={(value) =>
                            updateRowData(playlist, {
                              category: value || "Category",
                            })
                          }
                          widthClass="w-[108px]"
                        />
                      </div>
                      <div className="px-2">
                        <AdsSelect
                          value={data.genre}
                          placeholder="Genre"
                          options={genreOptions.filter((option) => option !== "Genre")}
                          onChange={(value) =>
                            updateRowData(playlist, { genre: value || "Genre" })
                          }
                          widthClass="w-[108px]"
                        />
                      </div>
                      <div className="px-1">
                        <AdsSelect
                          value={data.country}
                          placeholder="Country"
                          options={countryOptions}
                          onChange={(value) =>
                            updateRowData(playlist, { country: value })
                          }
                          widthClass="w-[80px]"
                          title={data.country || "Country"}
                        />
                      </div>
                      <div className="px-2">
                        <AdsSelect
                          value={data.master}
                          placeholder="Master"
                          options={masterOptions}
                          onChange={(value) =>
                            updateRowData(playlist, { master: value })
                          }
                          widthClass="w-[120px]"
                        />
                      </div>
                      <div className="px-2">{data.ads.length}</div>
                      <div className="px-2">{getTrackCount(playlist)}</div>
                      <div className="px-2 text-[11px]">
                        {formatDate(getPlaylistManagerLastSynced(playlist))}
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
                      <div className="flex items-center justify-center px-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              getPlaylistUrl(playlist),
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center text-zinc-300 hover:text-green-400"
                          title="Copy playlist URL"
                          aria-label="Copy playlist URL"
                        >
                          <CopyIcon />
                        </button>
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
                          <div
                            key={`${key}-ad-${index}`}
                            className="flex justify-center px-1"
                          >
                            {ad ? (
                              <button
                                type="button"
                                data-ad-pill="true"
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

      <style jsx global>{`
        .ads-green-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #22c55e #000000;
        }

        .ads-green-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .ads-green-scrollbar::-webkit-scrollbar-track {
          background: #000000;
          border-radius: 9999px;
        }

        .ads-green-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #22c55e 0%, #10b981 100%);
          border: 2px solid #000000;
          border-radius: 9999px;
        }
      `}</style>

      {optionModalType ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={closeOptionModal}
        >
          <div
            data-selection-toolbar="true"
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
            data-selection-toolbar="true"
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveAdDate();
              }
            }}
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
