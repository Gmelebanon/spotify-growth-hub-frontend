"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SongStatus = "Keep" | "Flagged" | "Review";
type TabKey = "all" | "flagged" | "master";
type SortDirection = "asc" | "desc";

type SortKey =
  | "song"
  | "artist"
  | "released"
  | "days"
  | "streams"
  | "listeners"
  | "saves"
  | "saveRate"
  | "radioRate"
  | "playlists"
  | "completionRate"
  | "status"
  | "masterGroup";

type ArtistOption = {
  id: string;
  name: string;
};

type SongMetric = {
  id: string;
  trackId?: string | null;
  song: string;
  artist: string;
  artistId?: string | null;
  released: string;
  days: number;
  streams: number | null;
  listeners: number | null;
  saves: number | null;
  saveRate: number | null;
  radioRate: number | null;
  playlists: number | null;
  completionRate: number | null;
  status: SongStatus;
  masterGroup: string;
  spotifyUrl?: string | null;
  releaseName?: string | null;
  imageUrl?: string | null;
  duration?: string | null;
  albumId?: string | null;
  source?: string;
};

type SpotifyTrack = {
  id?: string;
  name?: string;
  duration?: string;
  spotifyUrl?: string;
  artists?: string[];
};

type SpotifyRelease = {
  id?: string;
  name?: string;
  releaseDate?: string;
  totalTracks?: number;
  spotifyUrl?: string;
  image?: string;
  tracks?: SpotifyTrack[];
};

const FALLBACK_BACKEND_URL = "https://spotify-growth-hub-backend.onrender.com";

function getBackendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    FALLBACK_BACKEND_URL
  );
}

function formatNumber(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function getDaysSince(value: string) {
  if (!value) return 0;

  const releaseDate = new Date(value);
  if (Number.isNaN(releaseDate.getTime())) return 0;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const startOfRelease = new Date(
    releaseDate.getFullYear(),
    releaseDate.getMonth(),
    releaseDate.getDate()
  );

  return Math.max(
    0,
    Math.floor(
      (startOfToday.getTime() - startOfRelease.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

function normalizeArtist(rawArtist: any): ArtistOption | null {
  const id = rawArtist?.id || rawArtist?.artistId || rawArtist?.artist_id;
  const name = rawArtist?.name || rawArtist?.artistName || rawArtist?.artist;

  if (!id || !name) return null;

  return {
    id: String(id),
    name: String(name),
  };
}

function mergeArtists(...artistGroups: ArtistOption[][]) {
  const artistMap = new Map<string, ArtistOption>();

  artistGroups.flat().forEach((artist) => {
    if (!artist?.id) return;
    artistMap.set(artist.id, artist);
  });

  return Array.from(artistMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function normalizeMasterTitle(title: string) {
  return String(title || "Untitled Track")
    .replace(/\s+-\s+(deep house|techno|garage|acoustic|extended|radio|sped up|slowed|remix|version|edit|cover).*$/i, "")
    .replace(/\s+\((deep house|techno|garage|acoustic|extended|radio|sped up|slowed|remix|version|edit|cover).*\)$/i, "")
    .trim();
}

async function loadSpotifyArtists() {
  const response = await fetch("/api/spotify/artists", {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Could not load Spotify artists."
    );
  }

  return (data.artists || []).map(normalizeArtist).filter(Boolean) as ArtistOption[];
}

async function loadDatabaseArtists() {
  const backendBaseUrl = getBackendBaseUrl();

  const response = await fetch(`${backendBaseUrl}/api/artist-library`, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || "Could not load My Artists database."
    );
  }

  return (data.artists || []).map(normalizeArtist).filter(Boolean) as ArtistOption[];
}

async function loadSavedSongMetrics() {
  const backendBaseUrl = getBackendBaseUrl();

  const response = await fetch(`${backendBaseUrl}/api/song-metrics`, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Could not load song metrics.");
  }

  return (data.rows || []) as SongMetric[];
}

async function saveSongMetrics(rows: SongMetric[]) {
  const backendBaseUrl = getBackendBaseUrl();

  const response = await fetch(`${backendBaseUrl}/api/song-metrics/bulk-upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Could not save song metrics.");
  }

  return data.rows as SongMetric[];
}

async function deleteSongMetric(rowId: string) {
  const backendBaseUrl = getBackendBaseUrl();

  const response = await fetch(
    `${backendBaseUrl}/api/song-metrics/${encodeURIComponent(rowId)}`,
    {
      method: "DELETE",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Could not delete song.");
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchArtistDetailsWithRetry(artist: ArtistOption) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `/api/spotify/artist-details?artistId=${encodeURIComponent(artist.id)}&t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Could not load songs for ${artist.name}.`
        );
      }

      return data;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`Could not load songs for ${artist.name}.`);

      if (attempt < 3) {
        await wait(500 * attempt);
      }
    }
  }

  throw lastError || new Error(`Could not load songs for ${artist.name}.`);
}

async function loadArtistSongs(artist: ArtistOption): Promise<SongMetric[]> {
  const data = await fetchArtistDetailsWithRetry(artist);
  const releases = (data?.releases || []) as SpotifyRelease[];

  return releases.flatMap((release, releaseIndex) => {
    const releaseTracks =
      release.tracks && release.tracks.length > 0
        ? release.tracks
        : [
            {
              id: release.id || `${artist.id}-${releaseIndex}`,
              name: release.name || "Untitled Track",
              spotifyUrl: release.spotifyUrl,
              artists: [artist.name],
            },
          ];

    return releaseTracks.map((track, trackIndex) => {
      const released = release.releaseDate || "";
      const artistNames =
        track.artists && track.artists.length > 0
          ? track.artists.join(", ")
          : artist.name;

      const fallbackId = `${artist.id}-${release.id || releaseIndex}-${trackIndex}`;
      const rowId = track.id || fallbackId;

      return {
        id: rowId,
        trackId: track.id || rowId,
        song: track.name || release.name || "Untitled Track",
        artist: artistNames,
        artistId: artist.id,
        released,
        days: getDaysSince(released),
        streams: null,
        listeners: null,
        saves: null,
        saveRate: null,
        radioRate: null,
        playlists: null,
        completionRate: null,
        status: "Review" as SongStatus,
        masterGroup: normalizeMasterTitle(track.name || release.name || "Untitled Track"),
        spotifyUrl: track.spotifyUrl || release.spotifyUrl || null,
        releaseName: release.name || "Untitled Release",
        imageUrl: release.image || null,
        duration: track.duration || null,
        albumId: release.id || null,
        source: "spotify",
      };
    });
  });
}

async function loadSongsForArtists(artists: ArtistOption[]) {
  const allRows: SongMetric[] = [];
  const failedArtists: string[] = [];

  for (const artist of artists) {
    try {
      await wait(150);
      const rows = await loadArtistSongs(artist);
      allRows.push(...rows);
    } catch (error) {
      console.warn(error);
      failedArtists.push(artist.name);
    }
  }

  const uniqueRows = Array.from(
    new Map(allRows.map((row) => [row.id, row])).values()
  );

  return {
    rows: uniqueRows.sort((a, b) => {
      const aDate = new Date(a.released || 0).getTime();
      const bDate = new Date(b.released || 0).getTime();
      return bDate - aDate;
    }),
    failedArtists,
  };
}

function mergeSpotifyRowsWithSavedRows(spotifyRows: SongMetric[], savedRows: SongMetric[]) {
  const savedById = new Map(savedRows.map((row) => [row.id, row]));

  return spotifyRows.map((spotifyRow) => {
    const savedRow = savedById.get(spotifyRow.id);

    if (!savedRow) return spotifyRow;

    return {
      ...spotifyRow,
      streams: savedRow.streams,
      listeners: savedRow.listeners,
      saves: savedRow.saves,
      saveRate: savedRow.saveRate,
      radioRate: savedRow.radioRate,
      playlists: savedRow.playlists,
      completionRate: savedRow.completionRate,
      status: savedRow.status || spotifyRow.status,
      masterGroup: savedRow.masterGroup || spotifyRow.masterGroup,
      source: "spotify+database",
    };
  });
}

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportToCsv(rows: SongMetric[]) {
  const headers = [
    "Song",
    "Artist",
    "Artist ID",
    "Track ID",
    "Released",
    "Days",
    "Streams",
    "Listeners",
    "Saves",
    "Save%",
    "Radio%",
    "Playlists",
    "Completion%",
    "Status",
    "Master Group",
    "Spotify URL",
    "Release Name",
  ];

  const csvRows = rows.map((row) => [
    row.song,
    row.artist,
    row.artistId || "",
    row.trackId || row.id,
    row.released,
    row.days,
    row.streams ?? "",
    row.listeners ?? "",
    row.saves ?? "",
    row.saveRate ?? "",
    row.radioRate ?? "",
    row.playlists ?? "",
    row.completionRate ?? "",
    row.status,
    row.masterGroup,
    row.spotifyUrl || "",
    row.releaseName || "",
  ]);

  const csv = [headers, ...csvRows]
    .map((line) => line.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "song-metrics.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function toNullableNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUploadedCsv(csvText: string): SongMetric[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase()
  );

  function getValue(values: string[], names: string[]) {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? values[index] || "" : "";
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const song = getValue(values, ["song", "title"]) || "Untitled Track";
    const artist = getValue(values, ["artist", "artists"]) || "Unknown Artist";
    const trackId = getValue(values, ["track id", "trackid", "spotify track id"]);
    const spotifyUrl = getValue(values, ["spotify url", "url"]);
    const released = getValue(values, ["released", "release date", "date"]);
    const statusValue = getValue(values, ["status"]) as SongStatus;
    const fallbackId = trackId || spotifyUrl || `uploaded-${index}-${song}-${artist}`;

    return {
      id: fallbackId,
      trackId: trackId || fallbackId,
      song,
      artist,
      artistId: getValue(values, ["artist id", "artistid"]),
      released,
      days: Number(getValue(values, ["days"])) || getDaysSince(released),
      streams: toNullableNumber(getValue(values, ["streams"])),
      listeners: toNullableNumber(getValue(values, ["listeners"])),
      saves: toNullableNumber(getValue(values, ["saves"])),
      saveRate: toNullableNumber(getValue(values, ["save%", "save rate"])),
      radioRate: toNullableNumber(getValue(values, ["radio%", "radio rate"])),
      playlists: toNullableNumber(getValue(values, ["playlists"])),
      completionRate: toNullableNumber(
        getValue(values, ["completion%", "completion rate"])
      ),
      status: ["Keep", "Flagged", "Review"].includes(statusValue)
        ? statusValue
        : "Review",
      masterGroup:
        getValue(values, ["master group", "mastergroup"]) ||
        normalizeMasterTitle(song),
      spotifyUrl,
      releaseName: getValue(values, ["release name", "release"]),
      source: "csv",
    };
  });
}

function mergeUploadedRows(currentRows: SongMetric[], uploadedRows: SongMetric[]) {
  return uploadedRows.map((uploadedRow) => {
    const match = currentRows.find((row) => {
      const sameTrackId =
        uploadedRow.trackId && row.trackId && uploadedRow.trackId === row.trackId;
      const sameUrl =
        uploadedRow.spotifyUrl &&
        row.spotifyUrl &&
        uploadedRow.spotifyUrl === row.spotifyUrl;
      const sameSongArtist =
        row.song.toLowerCase() === uploadedRow.song.toLowerCase() &&
        row.artist.toLowerCase() === uploadedRow.artist.toLowerCase();

      return sameTrackId || sameUrl || sameSongArtist;
    });

    if (!match) return uploadedRow;

    return {
      ...match,
      streams: uploadedRow.streams ?? match.streams,
      listeners: uploadedRow.listeners ?? match.listeners,
      saves: uploadedRow.saves ?? match.saves,
      saveRate: uploadedRow.saveRate ?? match.saveRate,
      radioRate: uploadedRow.radioRate ?? match.radioRate,
      playlists: uploadedRow.playlists ?? match.playlists,
      completionRate: uploadedRow.completionRate ?? match.completionRate,
      status: uploadedRow.status || match.status,
      masterGroup: uploadedRow.masterGroup || match.masterGroup,
      source: "csv+database",
    };
  });
}

function groupRowsByMaster(rows: SongMetric[]): SongMetric[] {
  const groups = new Map<string, SongMetric[]>();

  rows.forEach((row) => {
    const key = `${row.artistId || row.artist}-${row.masterGroup || normalizeMasterTitle(row.song)}`.toLowerCase();
    const groupRows = groups.get(key) || [];
    groupRows.push(row);
    groups.set(key, groupRows);
  });

  return Array.from(groups.values()).map((groupRows) => {
    const sortedRows = [...groupRows].sort((a, b) => {
      const aDate = new Date(a.released || 0).getTime();
      const bDate = new Date(b.released || 0).getTime();
      return bDate - aDate;
    });

    const primary = sortedRows[0];

    return {
      ...primary,
      id: `master-${primary.artistId || primary.artist}-${primary.masterGroup}`,
      song: primary.masterGroup || normalizeMasterTitle(primary.song),
      streams: sumNullable(sortedRows.map((row) => row.streams)),
      listeners: sumNullable(sortedRows.map((row) => row.listeners)),
      saves: sumNullable(sortedRows.map((row) => row.saves)),
      playlists: sumNullable(sortedRows.map((row) => row.playlists)),
      saveRate: averageNullable(sortedRows.map((row) => row.saveRate)),
      radioRate: averageNullable(sortedRows.map((row) => row.radioRate)),
      completionRate: averageNullable(sortedRows.map((row) => row.completionRate)),
      releaseName: `${groupRows.length} version${groupRows.length === 1 ? "" : "s"}`,
    };
  });
}

function sumNullable(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((total, value) => total + value, 0);
}

function averageNullable(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length === 0) return null;
  return (
    validValues.reduce((total, value) => total + value, 0) / validValues.length
  );
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 0 1-15.3 6.4" />
      <path d="M3 12a9 9 0 0 1 15.3-6.4" />
      <path d="M6 18H3v3" />
      <path d="M18 6h3V3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
        active
          ? "border-green-500 text-white"
          : "border-transparent text-zinc-400 hover:text-white"
      }`}
    >
      {label} ({count})
    </button>
  );
}

function MetricPill({
  value,
  tone,
  suffix = "%",
}: {
  value: number | null;
  tone: "green" | "blue" | "red" | "zinc";
  suffix?: string;
}) {
  const toneClasses = {
    green: "border-green-500/20 bg-green-500/10 text-green-400",
    blue: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    zinc: "border-zinc-700 bg-zinc-800 text-zinc-400",
  };

  return (
    <span
      className={`inline-flex min-w-[68px] items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {value === null ? "-" : `${value.toFixed(1)}${suffix}`}
    </span>
  );
}

function StatusPill({ status }: { status: SongMetric["status"] }) {
  if (status === "Keep") {
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
        Keep
      </span>
    );
  }

  if (status === "Flagged") {
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
        Flagged
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-300">
      Review
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeSortKey;
  const symbol = active ? (sortDirection === "asc" ? "↑" : "↓") : "↕";

  return (
    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 transition hover:text-white ${
          active ? "text-green-400" : "text-zinc-400"
        }`}
      >
        <span>{label}</span>
        <span>{symbol}</span>
      </button>
    </th>
  );
}

function getSortValue(row: SongMetric, sortKey: SortKey) {
  if (sortKey === "song") return row.song || "";
  if (sortKey === "artist") return row.artist || "";
  if (sortKey === "released") return new Date(row.released || 0).getTime();
  if (sortKey === "days") return row.days || 0;
  if (sortKey === "streams") return row.streams ?? -1;
  if (sortKey === "listeners") return row.listeners ?? -1;
  if (sortKey === "saves") return row.saves ?? -1;
  if (sortKey === "saveRate") return row.saveRate ?? -1;
  if (sortKey === "radioRate") return row.radioRate ?? -1;
  if (sortKey === "playlists") return row.playlists ?? -1;
  if (sortKey === "completionRate") return row.completionRate ?? -1;
  if (sortKey === "status") return row.status || "";
  return row.masterGroup || "";
}

export default function SongMetricsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState("all");
  const [rows, setRows] = useState<SongMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("released");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  async function refreshSavedRows() {
    const savedRows = await loadSavedSongMetrics();
    setRows(savedRows);
    setLastUpdated(new Date().toISOString());
    return savedRows;
  }

  const loadPageData = useCallback(async () => {
    setErrorMessage("");

    const [spotifyArtists, databaseArtists, savedRows] = await Promise.all([
      loadSpotifyArtists().catch((error) => {
        console.warn(error);
        return [];
      }),
      loadDatabaseArtists().catch((error) => {
        console.warn(error);
        return [];
      }),
      loadSavedSongMetrics().catch((error) => {
        console.warn(error);
        return [];
      }),
    ]);

    const mergedArtists = mergeArtists(spotifyArtists, databaseArtists);
    setArtists(mergedArtists);
    setRows(savedRows);
    setLastUpdated(new Date().toISOString());
  }, []);

  useEffect(() => {
    async function initialLoad() {
      try {
        setIsLoading(true);
        await loadPageData();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load song metrics."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void initialLoad();
  }, [loadPageData]);

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      setErrorMessage("");
      setSuccessMessage("");

      const [spotifyArtists, databaseArtists, savedRows] = await Promise.all([
        loadSpotifyArtists().catch(() => []),
        loadDatabaseArtists().catch(() => []),
        loadSavedSongMetrics().catch(() => []),
      ]);

      const mergedArtists = mergeArtists(spotifyArtists, databaseArtists);
      setArtists(mergedArtists);

      const { rows: spotifyRows, failedArtists } = await loadSongsForArtists(
        mergedArtists
      );

      const mergedRows = mergeSpotifyRowsWithSavedRows(spotifyRows, savedRows);
      await saveSongMetrics(mergedRows);
      const saved = await refreshSavedRows();

      setSuccessMessage(`Synced and saved ${saved.length} songs to database.`);

      if (failedArtists.length > 0) {
        setErrorMessage(
          `Synced songs, but ${failedArtists.length} artist${
            failedArtists.length === 1 ? "" : "s"
          } failed: ${failedArtists.slice(0, 3).join(", ")}${
            failedArtists.length > 3 ? "..." : ""
          }`
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not refresh songs."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const text = await file.text();
      const uploadedRows = parseUploadedCsv(text);
      const rowsToSave = mergeUploadedRows(rows, uploadedRows);

      await saveSongMetrics(rowsToSave);
      const savedRows = await refreshSavedRows();

      setSuccessMessage(`Uploaded and saved metrics. Database now has ${savedRows.length} songs.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not upload CSV."
      );
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  }

  async function handleDeleteRow(rowId: string) {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await deleteSongMetric(rowId);
      setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
      setSuccessMessage("Song removed from database.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not delete song."
      );
    }
  }

  function handleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(
      ["song", "artist", "status", "masterGroup"].includes(nextSortKey)
        ? "asc"
        : "desc"
    );
  }

  const selectedArtistName = useMemo(() => {
    if (selectedArtistId === "all") return "All My Artists";
    return artists.find((artist) => artist.id === selectedArtistId)?.name || "Artist";
  }, [artists, selectedArtistId]);

  const baseFilteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesArtist =
        selectedArtistId === "all" || row.artistId === selectedArtistId;

      const matchesSearch =
        !normalizedSearch ||
        row.song.toLowerCase().includes(normalizedSearch) ||
        row.artist.toLowerCase().includes(normalizedSearch) ||
        row.masterGroup.toLowerCase().includes(normalizedSearch) ||
        (row.releaseName || "").toLowerCase().includes(normalizedSearch);

      const matchesTab = tab === "flagged" ? row.status === "Flagged" : true;

      return matchesArtist && matchesSearch && matchesTab;
    });
  }, [rows, search, selectedArtistId, tab]);

  const masterRows = useMemo(() => groupRowsByMaster(baseFilteredRows), [baseFilteredRows]);

  const displayedRows = useMemo(() => {
    const nextRows = tab === "master" ? [...masterRows] : [...baseFilteredRows];

    nextRows.sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);

      if (typeof aValue === "string" || typeof bValue === "string") {
        const result = String(aValue).localeCompare(String(bValue));
        return sortDirection === "asc" ? result : -result;
      }

      return sortDirection === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });

    return nextRows;
  }, [baseFilteredRows, masterRows, sortDirection, sortKey, tab]);

  const flaggedCount = useMemo(
    () => rows.filter((row) => row.status === "Flagged").length,
    [rows]
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Song Metrics
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Songs from your My Artists database, saved to Supabase with imported metrics.
            </p>
            {lastUpdated ? (
              <p className="mt-1 text-xs text-zinc-600">
                Last loaded {new Date(lastUpdated).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing || isSaving}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-black text-zinc-300 transition hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60"
              title="Sync and save songs"
              aria-label="Sync and save songs"
            >
              <RefreshIcon spinning={isLoading || isRefreshing} />
            </button>

            <input
              type="text"
              placeholder="Search song, artist, or release..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-green-500"
            />

            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isSaving}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-black text-zinc-300 transition hover:border-green-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60"
              title="Upload CSV and save to database"
              aria-label="Upload CSV and save to database"
            >
              <UploadIcon />
            </button>

            <button
              type="button"
              onClick={() => exportToCsv(displayedRows)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-black text-zinc-300 transition hover:border-green-500 hover:text-green-400"
              title="Download CSV"
              aria-label="Download CSV"
            >
              <DownloadIcon />
            </button>

            <select
              value={selectedArtistId}
              onChange={(event) => setSelectedArtistId(event.target.value)}
              className="h-11 min-w-[230px] rounded-xl border border-green-500 bg-black px-4 text-sm font-semibold text-white outline-none transition focus:border-green-400"
            >
              <option value="all">All My Artists ({artists.length})</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleUploadFile}
              className="hidden"
            />
          </div>

          {successMessage ? (
            <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {successMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mb-5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="mb-5 flex flex-wrap items-center gap-6 border-b border-zinc-800">
            <TabButton
              label="All Songs"
              count={rows.length}
              active={tab === "all"}
              onClick={() => setTab("all")}
            />
            <TabButton
              label="Flagged"
              count={flaggedCount}
              active={tab === "flagged"}
              onClick={() => setTab("flagged")}
            />
            <TabButton
              label="By Master Group"
              count={groupRowsByMaster(rows).length}
              active={tab === "master"}
              onClick={() => setTab("master")}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <div className="scrollbar-spotify overflow-x-auto">
              <table className="min-w-[1300px] w-full">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr className="text-left">
                    <SortableHeader label="Song" sortKey="song" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Artist" sortKey="artist" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Released" sortKey="released" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Days" sortKey="days" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Streams" sortKey="streams" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Listeners" sortKey="listeners" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Saves" sortKey="saves" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Save%" sortKey="saveRate" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Radio%" sortKey="radioRate" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Playlists" sortKey="playlists" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Completion%" sortKey="completionRate" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <SortableHeader label="Status" sortKey="status" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Del
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-12 text-center text-sm text-zinc-500"
                      >
                        Loading saved songs from database...
                      </td>
                    </tr>
                  ) : displayedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-12 text-center text-sm text-zinc-500"
                      >
                        No songs found. Press refresh to sync My Artists songs into the database.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-900 transition hover:bg-zinc-900/50"
                      >
                        <td className="max-w-[260px] px-4 py-4">
                          <div className="truncate text-sm font-medium text-white">
                            {row.spotifyUrl ? (
                              <a
                                href={row.spotifyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-green-400"
                              >
                                {row.song}
                              </a>
                            ) : (
                              row.song
                            )}
                          </div>
                          <div className="truncate text-xs text-zinc-600">
                            {row.releaseName || row.masterGroup}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-300">
                          {row.artist}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-300">
                          {formatDate(row.released)}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-400">
                          {formatNumber(row.days)}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-white">
                          {formatNumber(row.streams)}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-300">
                          {formatNumber(row.listeners)}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-300">
                          {formatNumber(row.saves)}
                        </td>
                        <td className="px-4 py-4">
                          <MetricPill
                            value={row.saveRate}
                            tone={
                              row.saveRate === null
                                ? "zinc"
                                : row.saveRate >= 2
                                  ? "green"
                                  : "red"
                            }
                          />
                        </td>
                        <td className="px-4 py-4">
                          <MetricPill
                            value={row.radioRate}
                            tone={
                              row.radioRate === null
                                ? "zinc"
                                : row.radioRate >= 30
                                  ? "blue"
                                  : "red"
                            }
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-300">
                          {formatNumber(row.playlists)}
                        </td>
                        <td className="px-4 py-4">
                          <MetricPill
                            value={row.completionRate}
                            tone={
                              row.completionRate === null
                                ? "zinc"
                                : row.completionRate >= 85
                                  ? "green"
                                  : "red"
                            }
                          />
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-4">
                          {tab === "master" ? (
                            <span className="text-xs text-zinc-700">-</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 transition hover:border-red-400 hover:text-red-300"
                              title="Delete from database"
                              aria-label="Delete from database"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-xs text-zinc-600">
            Showing {displayedRows.length} rows from {selectedArtistName}. Data is saved in Supabase.
          </div>
        </div>
      </div>
    </div>
  );
}
