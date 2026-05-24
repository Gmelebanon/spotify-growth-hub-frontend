"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAccounts,
  syncAllAccountPlaylists,
  type SpotifyAccount,
  type SyncAllAccountsResponse,
} from "@/lib/api/accounts";
import { ApiError } from "@/lib/api/client";

type StatusTone = "emerald" | "amber" | "red" | "zinc";

type PlaylistHistoryItem = {
  date?: string | null;
  label?: string | null;
  growth?: number | string | null;
  followers?: number | string | null;
  followers_count?: number | string | null;
  count?: number | string | null;
  value?: number | string | null;
};

type PlaylistRow = {
  id: number | string;
  account_id?: number | string | null;
  name?: string | null;
  title?: string | null;
  followers?: number | string | null;
  tracks_count?: number | string | null;
  total_tracks?: number | string | null;
  spotify_id?: string | null;
  spotify_playlist_id?: string | null;
  playlist_id?: string | number | null;
  spotify_url?: string | null;
  playlist_url?: string | null;
  external_url?: string | null;
  url?: string | null;
  daily_growth?: PlaylistHistoryItem[] | null;
  daily_history?: PlaylistHistoryItem[] | null;
  updated_at?: string | null;
  last_synced_at?: string | null;
  last_synced?: string | null;
  synced_at?: string | null;
  country?: string | null;
  ads_meta?: {
    country?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type ReleaseRow = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  releaseDate?: string | null;
  release_date?: string | null;
  spotifyUrl?: string | null;
  spotify_url?: string | null;
  image?: string | null;
  totalTracks?: number | string | null;
  total_tracks?: number | string | null;
};

type ArtistRow = {
  id?: string | null;
  artistId?: string | null;
  name?: string | null;
  followers?: number | string | null;
  followers7Days?: number | string | null;
  latestRelease?: ReleaseRow | null;
  latest_release?: ReleaseRow | null;
  recentReleases?: ReleaseRow[] | null;
  recent_releases?: ReleaseRow[] | null;
};

type SettingsAccount = {
  id?: number | string | null;
  name?: string | null;
  lastSynced?: string | null;
  status?: string | null;
  freshness?: string | null;
};

type SettingsSummary = {
  success?: boolean;
  platformHealth?: number;
  connectedAccounts?: number;
  expiredAccounts?: number;
  syncSuccessRate?: number;
  lastSync?: string | null;
  lastSyncFreshness?: string | null;
  lastDataPush?: string | null;
  lastDataPushFreshness?: string | null;
  accounts?: SettingsAccount[];
};

type AdsSettingsRow = {
  playlist_id?: string | number | null;
  playlist_name?: string | null;
  country?: string | null;
  settings?: {
    country?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type ArtistSyncMetadataResult = {
  success: boolean;
  synced: number;
  failed: number;
  total: number;
};

type SyncState = {
  loading: boolean;
  progress: number;
  error: string | null;
  result: SyncAllAccountsResponse | null;
  artistSync: ArtistSyncMetadataResult | null;
  completedAt: string | null;
};

type GrowthCardProps = {
  label: string;
  name: string;
  href?: string;
  value: number;
  helper?: string;
  tone?: StatusTone;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://spotify-growth-hub-backend.onrender.com";

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return fallback;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatSigned(value: number) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${formatInteger(rounded)}` : formatInteger(rounded);
}

function shortenText(value: string, maxLength = 40) {
  const clean = String(value || "").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function formatDateOnly(value?: string | null) {
  if (!value) return "Not synced yet";

  const clean = String(value).slice(0, 10);
  const date = new Date(`${clean}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Not synced yet";

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Not synced yet";

  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  const time = date.getTime();

  if (Number.isNaN(time)) return "Not synced yet";

  const diffMs = Date.now() - time;
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return "just now";
  if (absMs < hour) return `${Math.round(absMs / minute)}m ago`;
  if (absMs < day) return `${Math.round(absMs / hour)}h ago`;

  return `${Math.round(absMs / day)}d ago`;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function normalizeHistoryLabel(value?: string | null) {
  if (!value) return "";

  const clean = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);

  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) return getLocalDateKey(parsed);

  if (/^\d{1,2}\/\d{1,2}$/.test(clean)) {
    const [day, month] = clean.split("/").map((part) => Number(part));
    const year = new Date().getFullYear();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return clean;
}

function toOptionalNumber(value: unknown) {
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

function historyValue(item?: PlaylistHistoryItem | null) {
  return (
    toOptionalNumber(item?.growth) ??
    toOptionalNumber(item?.value) ??
    toOptionalNumber(item?.count) ??
    toOptionalNumber(item?.followers) ??
    toOptionalNumber(item?.followers_count) ??
    0
  );
}

function getDailyStatValue(playlist: PlaylistRow, dateKey: string) {
  const dailyGrowth = playlist.daily_growth ?? [];
  const dailyHistory = playlist.daily_history ?? [];

  const growthRow = dailyGrowth.find(
    (item) => normalizeHistoryLabel(item.label || item.date) === dateKey,
  );
  if (growthRow) return historyValue(growthRow);

  const historyRow = dailyHistory.find(
    (item) => normalizeHistoryLabel(item.label || item.date) === dateKey,
  );
  if (historyRow) return historyValue(historyRow);

  return 0;
}

function getPlaylistGrowthForDays(playlist: PlaylistRow, days: number) {
  const today = new Date();
  let total = 0;

  for (let offset = 0; offset < days; offset += 1) {
    total += getDailyStatValue(
      playlist,
      getLocalDateKey(addDays(today, -offset)),
    );
  }

  return total;
}

function getPlaylistName(playlist: PlaylistRow) {
  return String(playlist.name || playlist.title || "Untitled playlist");
}

function getPlaylistIdentifier(playlist: PlaylistRow) {
  return String(
    playlist.spotify_id ||
      playlist.spotify_playlist_id ||
      playlist.playlist_id ||
      playlist.id ||
      "",
  );
}

function getPlaylistHref(playlist?: PlaylistRow | null) {
  if (!playlist) return undefined;
  const identifier = getPlaylistIdentifier(playlist);
  return identifier
    ? `/playlists/${encodeURIComponent(identifier)}`
    : undefined;
}

function getArtistIdentifier(artist?: ArtistRow | null) {
  return String(artist?.artistId || artist?.id || "");
}

function getArtistHref(artist?: ArtistRow | null) {
  const identifier = getArtistIdentifier(artist);
  return identifier
    ? `/my-artists/${encodeURIComponent(identifier)}`
    : undefined;
}

function getReleaseDateKey(release?: ReleaseRow | null) {
  const raw = release?.releaseDate || release?.release_date || null;
  if (!raw) return null;

  const key = String(raw).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;

  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) return null;

  return getLocalDateKey(parsed);
}

function isReleaseWithinPastDays(release: ReleaseRow, days: number) {
  const key = getReleaseDateKey(release);
  if (!key) return false;

  const releaseDate = new Date(`${key}T00:00:00`);
  const today = new Date(`${getLocalDateKey(new Date())}T00:00:00`);
  const diffDays = Math.floor(
    (today.getTime() - releaseDate.getTime()) / (24 * 60 * 60 * 1000),
  );

  return diffDays >= 0 && diffDays <= days;
}

function getReleaseName(release: ReleaseRow) {
  return String(release.name || "Untitled release");
}

function getReleaseUrl(release: ReleaseRow) {
  return String(release.spotifyUrl || release.spotify_url || "");
}

function getReleaseTrackCount(release: ReleaseRow) {
  return toNumber(release.totalTracks ?? release.total_tracks, 0);
}

function formatReleaseDate(release: ReleaseRow) {
  const key = getReleaseDateKey(release);
  if (!key) return "Unknown date";
  return formatDateOnly(key);
}

function getPlaylistAccountName(
  playlist: PlaylistRow,
  accountNameById: Map<string, string>,
) {
  return (
    accountNameById.get(String(playlist.account_id ?? "")) || "Unknown account"
  );
}

function cleanCountryName(value: unknown) {
  return String(value || "").trim();
}

function getPlaylistCountry(playlist: PlaylistRow) {
  return cleanCountryName(
    playlist.ads_meta?.country ||
      playlist.country ||
      (playlist as Record<string, unknown>).country ||
      "",
  );
}

function getAdsSettingsCountry(row: AdsSettingsRow) {
  return cleanCountryName(row.country || row.settings?.country || "");
}

function normalizeAdsSettingsPayload(payload: unknown): AdsSettingsRow[] {
  if (Array.isArray(payload)) return payload as AdsSettingsRow[];

  const record = payload as {
    items?: unknown;
    rows?: unknown;
    data?: unknown;
    settings?: unknown;
  } | null;

  if (Array.isArray(record?.items)) return record.items as AdsSettingsRow[];
  if (Array.isArray(record?.rows)) return record.rows as AdsSettingsRow[];
  if (Array.isArray(record?.data)) return record.data as AdsSettingsRow[];
  if (Array.isArray(record?.settings)) return record.settings as AdsSettingsRow[];

  return [];
}

function getTrackCount(playlist: PlaylistRow) {
  return toNumber(playlist.tracks_count ?? playlist.total_tracks, 0);
}

function getAccountDisplayName(account: SpotifyAccount) {
  const record = account as SpotifyAccount & Record<string, unknown>;
  return String(
    record.display_name || record.name || record.username || "Spotify Account",
  );
}

function monthLabel(dateKey: string) {
  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getMonthlyFollowerTotals(playlists: PlaylistRow[]) {
  const totals = new Map<string, number>();

  playlists.forEach((playlist) => {
    const rows = [
      ...(playlist.daily_growth ?? []),
      ...(playlist.daily_history ?? []),
    ];

    rows.forEach((row) => {
      const key = normalizeHistoryLabel(row.date || row.label);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;

      const monthKey = key.slice(0, 7);
      totals.set(monthKey, (totals.get(monthKey) ?? 0) + historyValue(row));
    });
  });

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, value]) => ({
      key,
      label: monthLabel(`${key}-01`),
      value: Math.round(value),
    }));
}

function GrowthCard({
  label,
  name,
  href,
  value,
  helper,
  tone = "zinc",
}: GrowthCardProps) {
  const dotClass =
    tone === "emerald"
      ? "bg-emerald-400"
      : tone === "amber"
        ? "bg-amber-400"
        : tone === "red"
          ? "bg-red-400"
          : "bg-zinc-500";

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          {label}
        </p>
        <span className={`mt-0.5 h-2 w-2 rounded-full ${dotClass}`} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="min-w-0 flex-1 truncate text-left text-base font-semibold leading-tight tracking-tight text-white">
          {shortenText(name || "—", 34)}
        </p>
        <p className="shrink-0 text-right text-[24px] font-semibold leading-none tracking-tight text-emerald-400">
          {formatSigned(value)}
        </p>
      </div>
      {helper ? (
        <p className="mt-2 truncate text-xs text-zinc-500">{helper}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-emerald-500/40 hover:bg-zinc-950"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      {content}
    </div>
  );
}

function ConnectingIndicator() {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs font-medium text-emerald-300">
      <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
      <span>Connecting…</span>
    </div>
  );
}

function LoadingBar({ progress }: { progress: number }) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="mt-3 overflow-hidden rounded-full border border-emerald-500/15 bg-zinc-900">
      <div
        className="h-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)] transition-all duration-500"
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

async function fetchSettingsSummary() {
  const response = await fetch(
    `${API_BASE_URL}/api/settings/summary?ts=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) return null;
  return (await response.json()) as SettingsSummary;
}

async function fetchPlaylistsForAccount(accountId: number | string) {
  const response = await fetch(
    `${API_BASE_URL}/api/accounts/${accountId}/playlists?ts=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) return [];

  const payload = await response.json();

  if (Array.isArray(payload)) return payload as PlaylistRow[];
  if (Array.isArray(payload?.items)) return payload.items as PlaylistRow[];
  if (Array.isArray(payload?.playlists))
    return payload.playlists as PlaylistRow[];

  return [];
}

async function fetchArtistLibrary() {
  const response = await fetch(
    `${API_BASE_URL}/api/artist-library?ts=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) return [];

  const payload = await response.json();

  if (Array.isArray(payload)) return payload as ArtistRow[];
  if (Array.isArray(payload?.artists)) return payload.artists as ArtistRow[];
  if (Array.isArray(payload?.items)) return payload.items as ArtistRow[];

  return [];
}

async function fetchAdsSettings() {
  const response = await fetch(
    `${API_BASE_URL}/api/ads/settings?ts=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) return [];

  return normalizeAdsSettingsPayload(await response.json());
}

async function syncArtistLibraryMetadata() {
  const response = await fetch(
    `${API_BASE_URL}/api/artist-library/sync-metadata`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || "Failed to sync artist metadata",
    );
  }

  return data as ArtistSyncMetadataResult;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<SpotifyAccount[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [adsSettings, setAdsSettings] = useState<AdsSettingsRow[]>([]);
  const [settingsSummary, setSettingsSummary] =
    useState<SettingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    loading: false,
    progress: 0,
    error: null,
    result: null,
    artistSync: null,
    completedAt: null,
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [accountRows, summary, artistRows, adsRows] = await Promise.all([
        getAccounts(),
        fetchSettingsSummary(),
        fetchArtistLibrary(),
        fetchAdsSettings(),
      ]);

      const playlistGroups = await Promise.all(
        accountRows.map((account) => fetchPlaylistsForAccount(account.id)),
      );

      setAccounts(accountRows);
      setSettingsSummary(summary);
      setArtists(artistRows);
      setAdsSettings(adsRows);
      setPlaylists(playlistGroups.flat());
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to load dashboard";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const lastSync =
    settingsSummary?.lastSync || settingsSummary?.lastDataPush || null;
  const todayKey = getLocalDateKey(new Date());

  const accountNameById = useMemo(() => {
    return new Map(
      accounts.map((account) => [
        String(account.id),
        getAccountDisplayName(account),
      ]),
    );
  }, [accounts]);

  const dashboardStats = useMemo(() => {
    const topToday =
      playlists
        .map((playlist) => ({
          playlist,
          value: getDailyStatValue(playlist, todayKey),
        }))
        .sort((a, b) => b.value - a.value)[0] || null;

    const topThirtyDays =
      playlists
        .map((playlist) => ({
          playlist,
          value: getPlaylistGrowthForDays(playlist, 30),
        }))
        .sort((a, b) => b.value - a.value)[0] || null;

    const topArtist =
      artists
        .map((artist) => ({
          artist,
          value: toNumber(artist.followers7Days, 0),
        }))
        .sort((a, b) => b.value - a.value)[0] || null;

    const accountWeekTotals = new Map<
      string,
      { id: string; name: string; value: number }
    >();

    playlists.forEach((playlist) => {
      const accountId = String(playlist.account_id ?? "unknown");
      const accountName = getPlaylistAccountName(playlist, accountNameById);
      const current = accountWeekTotals.get(accountId) || {
        id: accountId,
        name: accountName,
        value: 0,
      };
      current.value += getPlaylistGrowthForDays(playlist, 7);
      accountWeekTotals.set(accountId, current);
    });

    const topAccountWeek =
      Array.from(accountWeekTotals.values()).sort(
        (a, b) => b.value - a.value,
      )[0] || null;

    const totalToday = playlists.reduce(
      (sum, playlist) => sum + getDailyStatValue(playlist, todayKey),
      0,
    );

    const totalThirtyDays = playlists.reduce(
      (sum, playlist) => sum + getPlaylistGrowthForDays(playlist, 30),
      0,
    );

    const thisWeeksReleases = artists
      .flatMap((artist) => {
        const releases = [
          ...(artist.recentReleases ?? []),
          ...(artist.recent_releases ?? []),
          ...([artist.latestRelease || artist.latest_release].filter(
            Boolean,
          ) as ReleaseRow[]),
        ];

        return releases.map((release) => ({
          artist,
          release,
          releaseId: String(release.id || ""),
          dateKey: getReleaseDateKey(release) || "",
        }));
      })
      .filter((item) => isReleaseWithinPastDays(item.release, 7))
      .reduce(
        (items, item) => {
          const key =
            item.releaseId ||
            `${item.artist.artistId || item.artist.id}-${getReleaseName(item.release)}-${item.dateKey}`;
          if (!items.seen.has(key)) {
            items.seen.add(key);
            items.rows.push(item);
          }
          return items;
        },
        {
          seen: new Set<string>(),
          rows: [] as Array<{
            artist: ArtistRow;
            release: ReleaseRow;
            releaseId: string;
            dateKey: string;
          }>,
        },
      )
      .rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .slice(0, 8);

    const countryPlaylistIds = new Map<string, Set<string>>();

    adsSettings.forEach((row) => {
      const country = getAdsSettingsCountry(row);
      const playlistId = String(row.playlist_id || "").trim();
      if (!country || !playlistId) return;

      const current = countryPlaylistIds.get(country) || new Set<string>();
      current.add(playlistId);
      countryPlaylistIds.set(country, current);
    });

    if (countryPlaylistIds.size === 0) {
      playlists.forEach((playlist) => {
        const country = getPlaylistCountry(playlist);
        const playlistId = getPlaylistIdentifier(playlist);
        if (!country || !playlistId) return;

        const current = countryPlaylistIds.get(country) || new Set<string>();
        current.add(playlistId);
        countryPlaylistIds.set(country, current);
      });
    }

    const worldwideListeners = Array.from(countryPlaylistIds.entries())
      .map(([country, playlistIds]) => ({
        country,
        playlists: playlistIds.size,
      }))
      .sort((a, b) => b.playlists - a.playlists || a.country.localeCompare(b.country))
      .slice(0, 8);

    const topByFollowers = [...playlists]
      .sort((a, b) => toNumber(b.followers, 0) - toNumber(a.followers, 0))
      .slice(0, 5);

    const monthlyTotals = getMonthlyFollowerTotals(playlists);

    return {
      topToday,
      topThirtyDays,
      topArtist,
      topAccountWeek,
      totalToday,
      totalThirtyDays,
      topByFollowers,
      monthlyTotals,
      thisWeeksReleases,
      worldwideListeners,
    };
  }, [accountNameById, adsSettings, artists, playlists, todayKey]);

  const monthlyMax = Math.max(
    1,
    ...dashboardStats.monthlyTotals.map((item) => Math.abs(item.value)),
  );

  const worldwideMax = Math.max(
    1,
    ...dashboardStats.worldwideListeners.map((item) => item.playlists),
  );

  async function handleSyncAll() {
    if (syncState.loading) return;

    setSyncState({
      loading: true,
      progress: 8,
      error: null,
      result: null,
      artistSync: null,
      completedAt: null,
    });

    const progressTimer = window.setInterval(() => {
      setSyncState((current) => {
        if (!current.loading) return current;
        return { ...current, progress: Math.min(88, current.progress + 4) };
      });
    }, 700);

    try {
      const playlistSync = await syncAllAccountPlaylists();
      setSyncState((current) => ({
        ...current,
        progress: 68,
        result: playlistSync,
      }));

      const artistSync = await syncArtistLibraryMetadata();
      setSyncState((current) => ({ ...current, progress: 88, artistSync }));

      await loadDashboard();

      setSyncState((current) => ({
        ...current,
        loading: false,
        progress: 100,
        completedAt: new Date().toISOString(),
      }));
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Sync failed";
      setSyncState((current) => ({
        ...current,
        loading: false,
        error: message,
      }));
    } finally {
      window.clearInterval(progressTimer);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1500px] space-y-6">
        <div className="rounded-3xl border border-emerald-500/15 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.72),rgba(9,9,11,0.92))] p-5 shadow-[0_0_60px_rgba(16,185,129,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400/80">
                Nerd Engine
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Dashboard
              </h1>
              <p className="mt-3 text-sm text-zinc-400">
                Last Sync{" "}
                <span className="font-medium text-white">
                  {formatDateOnly(lastSync)}
                </span>{" "}
                <span className="text-zinc-500">
                  (
                  {settingsSummary?.lastSyncFreshness ||
                    settingsSummary?.lastDataPushFreshness ||
                    formatRelativeTime(lastSync)}
                  )
                </span>
              </p>
            </div>

            <div className="w-full max-w-sm lg:text-right">
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncState.loading}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {syncState.loading ? "Syncing..." : "Sync All"}
              </button>
              {syncState.loading ? (
                <LoadingBar progress={syncState.progress} />
              ) : loading ? (
                <ConnectingIndicator />
              ) : null}
              {syncState.error ? (
                <p className="mt-2 text-xs text-red-400">{syncState.error}</p>
              ) : syncState.completedAt ? (
                <p className="mt-2 text-xs text-emerald-300">
                  Sync completed {formatRelativeTime(syncState.completedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GrowthCard
            label="Top Playlist Growth Today"
            name={
              dashboardStats.topToday
                ? getPlaylistName(dashboardStats.topToday.playlist)
                : "—"
            }
            href={getPlaylistHref(dashboardStats.topToday?.playlist)}
            value={dashboardStats.topToday?.value ?? 0}
            tone={
              dashboardStats.topToday && dashboardStats.topToday.value > 0
                ? "emerald"
                : "amber"
            }
          />
          <GrowthCard
            label="Top Playlist Growth This Month"
            name={
              dashboardStats.topThirtyDays
                ? getPlaylistName(dashboardStats.topThirtyDays.playlist)
                : "—"
            }
            href={getPlaylistHref(dashboardStats.topThirtyDays?.playlist)}
            value={dashboardStats.topThirtyDays?.value ?? 0}
            tone={
              dashboardStats.topThirtyDays &&
              dashboardStats.topThirtyDays.value > 0
                ? "emerald"
                : "amber"
            }
          />
          <GrowthCard
            label="Top Artist Growth This Week"
            name={dashboardStats.topArtist?.artist.name || "—"}
            href={getArtistHref(dashboardStats.topArtist?.artist)}
            value={dashboardStats.topArtist?.value ?? 0}
            tone={
              dashboardStats.topArtist && dashboardStats.topArtist.value > 0
                ? "emerald"
                : "amber"
            }
          />
          <GrowthCard
            label="Top Account Growth This Week"
            name={dashboardStats.topAccountWeek?.name || "—"}
            href={
              dashboardStats.topAccountWeek?.id &&
              dashboardStats.topAccountWeek.id !== "unknown"
                ? `/playlists?account=${encodeURIComponent(dashboardStats.topAccountWeek.id)}`
                : undefined
            }
            value={dashboardStats.topAccountWeek?.value ?? 0}
            tone={
              dashboardStats.topAccountWeek &&
              dashboardStats.topAccountWeek.value > 0
                ? "emerald"
                : "amber"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="flex min-h-[420px] flex-col rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Playlist Performance
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Monthly Follower Growth
                </h2>
              </div>
            </div>

            {dashboardStats.monthlyTotals.length ? (
              <div className="mt-auto h-80 pt-8">
                <div className="flex h-full items-end gap-4 border-b border-zinc-800 pb-7">
                  {dashboardStats.monthlyTotals.map((item) => {
                    const height = Math.max(
                      6,
                      (Math.abs(item.value) / monthlyMax) * 100,
                    );
                    const isPositive = item.value >= 0;
                    return (
                      <div
                        key={item.key}
                        className="flex min-w-0 flex-1 flex-col items-center gap-3"
                      >
                        <div className="flex h-64 w-full items-end rounded-t-xl bg-zinc-900/35 px-2">
                          <div
                            className={`w-full rounded-t-lg ${isPositive ? "bg-emerald-400" : "bg-red-400"} shadow-[0_0_18px_rgba(52,211,153,0.22)]`}
                            style={{ height: `${height}%` }}
                            title={`${item.label}: ${formatSigned(item.value)}`}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-white">
                            {formatSigned(item.value)}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-500">
                            {item.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState label="No monthly follower history yet." />
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Top Rankings
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Playlists by Follower Count
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {dashboardStats.topByFollowers.length ? (
                dashboardStats.topByFollowers.map((playlist, index) => (
                  <Link
                    href={getPlaylistHref(playlist) || "#"}
                    key={`${playlist.account_id ?? "account"}-${playlist.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-black/30 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-950"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-emerald-300">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold text-white"
                          title={getPlaylistName(playlist)}
                        >
                          {shortenText(getPlaylistName(playlist), 40)}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {getPlaylistAccountName(playlist, accountNameById)} ·{" "}
                          {formatInteger(getTrackCount(playlist))} tracks
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[18px] font-semibold leading-none tracking-tight text-emerald-400">
                        {formatInteger(toNumber(playlist.followers, 0))}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">followers</p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState label="No playlists loaded yet." />
              )}
            </div>
          </section>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <section className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                This Week&apos;s
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                New Releases
              </h2>
            </div>

            <div className="mt-5 h-[390px] overflow-y-auto rounded-2xl border border-zinc-800 bg-black/30 pr-1 [scrollbar-color:#10b981_#18181b] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-500">
              {dashboardStats.thisWeeksReleases.length ? (
                <div className="divide-y divide-zinc-900">
                  {dashboardStats.thisWeeksReleases.map((item) => {
                    const releaseUrl = getReleaseUrl(item.release);
                    const imageUrl = String(item.release.image || "");
                    const releaseName = getReleaseName(item.release);
                    const artistName = String(
                      item.artist.name || "Unknown artist",
                    );
                    const trackCount = getReleaseTrackCount(item.release);
                    const subtitle = `${artistName} · ${formatReleaseDate(item.release)} · ${formatInteger(trackCount)} ${trackCount === 1 ? "track" : "tracks"}`;

                    const row = (
                      <div className="flex h-[78px] items-center gap-4 px-4 py-3 transition hover:bg-zinc-950">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt={releaseName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                              Art
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold text-white"
                            title={releaseName}
                          >
                            {shortenText(releaseName, 52)}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-500">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                    );

                    if (releaseUrl) {
                      return (
                        <a
                          key={`${item.artist.artistId || item.artist.id}-${item.releaseId || releaseName}`}
                          href={releaseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          {row}
                        </a>
                      );
                    }

                    return (
                      <div
                        key={`${item.artist.artistId || item.artist.id}-${item.releaseId || releaseName}`}
                      >
                        {row}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState label="No releases found this week." />
              )}
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Worldwide
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Playlist Listeners
              </h2>
            </div>

            <div className="mt-5 h-[390px] rounded-2xl border border-zinc-800 bg-black/30 p-5">
              {dashboardStats.worldwideListeners.length ? (
                <div className="flex h-full items-end justify-between gap-3 px-1 pb-1">
                  {dashboardStats.worldwideListeners.map((item) => {
                    const height = Math.max(
                      16,
                      (item.playlists / worldwideMax) * 100,
                    );

                    return (
                      <div
                        key={item.country}
                        className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                      >
                        <div className="flex h-[260px] w-full items-end justify-center pb-12">
                          <Link
                            href={`/ads?country=${encodeURIComponent(item.country)}`}
                            className="block w-full max-w-[68px] rounded-t-xl bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.38)] transition-all duration-500 hover:bg-emerald-300"
                            style={{ height: `${height}%` }}
                            title={`${item.country}: ${formatInteger(item.playlists)}`}
                            aria-label={`Open Ads filtered by ${item.country}`}
                          />
                        </div>

                        <div className="absolute bottom-0 flex w-full flex-col items-center text-center">
                          <p
                            className="w-full truncate text-xs font-semibold text-white"
                            title={item.country}
                          >
                            {shortenText(item.country, 12)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-emerald-400">
                            {formatInteger(item.playlists)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState label="No country playlist data yet." />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
